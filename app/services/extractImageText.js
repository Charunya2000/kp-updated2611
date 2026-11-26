
'use server';

// ======================= IMPORTS =======================
import path from 'path';
import { PDFDocument, PDFName } from 'pdf-lib';
import { extractPdfText } from '@services/pdfTextExtraction';
import { sendChatCompletionWithImage2 } from '@services/chatCompletionService2';
import { getFeatureFlag } from '@services/featureFlagService';
import { parseOffice } from 'officeparser';
import { PNG } from 'pngjs';
import zlib from 'zlib';
import { v4 as uuidv4 } from 'uuid';

import yauzl from 'yauzl';
import { getServerSession } from "@/utils/getSession";
import { recordImageProcessed } from './statisticsService';
// import { PassThrough } from 'stream';



// ======================= CONSTANTS =======================
// File size limits
const MAX_PDF_SIZE_MB = parseInt(process.env.MAX_PDF_SIZE_MB ?? '50', 10);
const MAX_DOCX_SIZE_MB = parseInt(process.env.MAX_DOCX_SIZE_MB ?? '50', 10);

// Image processing limits
const MAX_IMAGE_PIXELS = parseInt(process.env.MAX_IMAGE_PIXELS ?? '9000000', 10);
const MAX_DECOMPRESSED_SIZE = parseInt(process.env.MAX_DECOMPRESSED_SIZE ?? String(20 * 1024 * 1024), 10); // bytes
const MAX_IMAGE_DIMENSION = parseInt(process.env.MAX_IMAGE_DIMENSION ?? '2048', 10);
const MAX_IMAGES_PER_PDF = parseInt(process.env.MAX_IMAGES_PER_PDF ?? '20', 10);

// Memory budget tracking
const MAX_MEMORY_BUDGET_MB = parseInt(process.env.MAX_MEMORY_BUDGET_MB ?? '300', 10);
let currentMemoryUsageMB = 0;

// OpenAI limits
const OPENAI_LIMIT = 20 * 1024 * 1024;
const CONCURRENT_IMAGES = 2;

// ======================= MEMORY TRACKING =======================

function trackMemory(sizeMB, operation = 'unknown') {
  currentMemoryUsageMB += sizeMB;
  if (currentMemoryUsageMB > MAX_MEMORY_BUDGET_MB) {
    throw new Error(
      `Memory budget exceeded: ${currentMemoryUsageMB.toFixed(1)}MB / ${MAX_MEMORY_BUDGET_MB}MB during ${operation}`
    );
  }
  console.log(`Memory tracking: ${currentMemoryUsageMB.toFixed(1)}MB / ${MAX_MEMORY_BUDGET_MB}MB (${operation})`);
}

function releaseMemory(sizeMB) {
  currentMemoryUsageMB = Math.max(0, currentMemoryUsageMB - sizeMB);
}

function resetMemoryTracking() {
  currentMemoryUsageMB = 0;
}

function forceGarbageCollection() {
  if (global.gc) {
    global.gc();
    console.log('Forced garbage collection');
  }
}

// ======================= HELPERS =======================

// Stream-safe decompression with limit (FIXED - now actually used!)
async function decompressWithLimit(data, limitBytes) {
  return new Promise((resolve, reject) => {
    const inflater = zlib.createInflate();
    const chunks = [];
    let size = 0;
    let exceeded = false;

    inflater.on('data', chunk => {
      size += chunk.length;
      if (size > limitBytes) {
        exceeded = true;
        inflater.destroy();
        reject(new Error(`Decompressed size exceeded limit: ${(size / (1024 * 1024)).toFixed(1)}MB`));
        return;
      }
      chunks.push(chunk);
    });

    inflater.on('end', () => {
      if (!exceeded) {
        resolve(Buffer.concat(chunks));
      }
    });

    inflater.on('error', reject);

    inflater.end(data);
  });
}

// Validate image dimensions before processing
function validateImageDimensions(width, height, pageNum) {
  if (width <= 0 || height <= 0) {
    console.warn(`Invalid dimensions on page ${pageNum}: ${width}x${height}`);
    return false;
  }

  const totalPixels = width * height;
  if (totalPixels > MAX_IMAGE_PIXELS) {
    console.warn(
      `Image too large on page ${pageNum}: ${width}x${height} = ${totalPixels.toLocaleString()} pixels ` +
      `(max: ${MAX_IMAGE_PIXELS.toLocaleString()}). Skipping.`
    );
    return false;
  }

  return true;
}

// Resize image buffer if dimensions exceed maximum
function resizeImageBuffer(buffer, width, height, targetMaxDimension = MAX_IMAGE_DIMENSION) {
  if (width <= targetMaxDimension && height <= targetMaxDimension) {
    return { buffer, width, height, resized: false };
  }

  const scale = targetMaxDimension / Math.max(width, height);
  const newWidth = Math.floor(width * scale);
  const newHeight = Math.floor(height * scale);

  console.log(`Resizing image from ${width}x${height} to ${newWidth}x${newHeight}`);

  // Simple nearest-neighbor downsampling
  const bytesPerPixel = 4; // RGBA
  const resized = Buffer.alloc(newWidth * newHeight * bytesPerPixel);

  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      const srcX = Math.floor(x / scale);
      const srcY = Math.floor(y / scale);
      const srcPos = (srcY * width + srcX) * bytesPerPixel;
      const dstPos = (y * newWidth + x) * bytesPerPixel;

      buffer.copy(resized, dstPos, srcPos, srcPos + bytesPerPixel);
    }
  }

  return { buffer: resized, width: newWidth, height: newHeight, resized: true };
}

// Apply predictor correction for FlateDecode
function applyPredictor(buffer, predictor, columns, colors) {
  if (predictor < 10 || predictor > 15) return buffer;

  const bytesPerPixel = colors;
  const rowLength = columns * bytesPerPixel;
  const rows = Math.floor(buffer.length / (rowLength + 1));
  const corrected = Buffer.alloc(rows * rowLength);

  let src = 0, dst = 0;
  for (let r = 0; r < rows; r++) {
    const filterType = buffer[src++];
    for (let i = 0; i < rowLength; i++) {
      const left = i >= bytesPerPixel ? corrected[dst + i - bytesPerPixel] : 0;
      const up = r > 0 ? corrected[dst + i - rowLength] : 0;
      const val = buffer[src++];

      if (filterType === 1) corrected[dst + i] = (val + left) & 0xff;
      else if (filterType === 2) corrected[dst + i] = (val + up) & 0xff;
      else corrected[dst + i] = val;
    }
    dst += rowLength;
  }
  return corrected;
}
//
function logObject(obj, prefix = '', seen = new WeakSet()) {
  if (obj && typeof obj === 'object') {
    if (seen.has(obj)) {
      console.log(`${prefix}: [Circular Reference]`);
      return;
    }
    seen.add(obj);
  }

  if (!obj) {
    console.log(`${prefix}: (null/undefined)`);
    return;
  }

  if (obj instanceof Map) {
    for (const [key, value] of obj.entries()) {
      const keyStr = typeof key === 'object' && key.encodedName ? key.encodedName : JSON.stringify(key);
      logObject(value, `${prefix}[${keyStr}]`, seen);
    }
  } else if (typeof obj === 'object' && !Array.isArray(obj)) {
    for (const key of Object.keys(obj)) {
      try {
        logObject(obj[key], prefix ? `${prefix}.${key}` : key, seen);
      } catch (err) {
        console.log(`${prefix}.${key}: <Error reading value>`);
      }
    }
  } else {
    // Primitive values
    console.log(`${prefix}: ${obj}`);
  }
}

// ======================= Array of image objects =======================
function getImagesFromPage(page) {
  const images = [];
  // Fetch the Resources dictionary, trying all plausible access patterns
  const resources =
    (typeof page.node.Resources === 'function' && page.node.Resources()) ||
    page.node.dict?.get?.(PDFName.of('Resources')) ||
    page.node.dict?.Resources;

  console.log('[PDF][getImagesFromPage] resources:', resources);

  // Find the XObject dictionary within Resources
  let xObjects = undefined;
  if (resources && resources.dict instanceof Map) {
    for (const [key, value] of resources.dict.entries()) {
      if (key.encodedName === '/XObject') {
        xObjects = value;
        console.log("[PDF][getImagesFromPage] Found XObject:", xObjects, key);
        break;
      }
    }
  }
  console.log("[PDF][getImagesFromPage] xObjects:", xObjects);


  // Traverse the map of XObject references
  if (xObjects && xObjects.dict instanceof Map) {
    for (const [key, ref] of xObjects.dict.entries()) {
      // Look up the actual object in the PDF context
      const xObjectActual = page.doc.context.lookup(ref);
      console.log('[PDF][getImagesFromPage] resolved xObject:', xObjectActual);
      console.log('[PDF][getImagesFromPage] Available keys in xObjectActual.dict:',
        Array.from(xObjectActual.dict.keys()).map(k => k?.encodedName));

      let subtypeName = '';

      if (xObjectActual && xObjectActual.dict && typeof xObjectActual.dict.get === 'function') {
        const subtypeObj = xObjectActual.dict.get(PDFName.of('Subtype'));
        // Prefer .name, fall back to .encodedName, or toString()
        if (subtypeObj) {
          if (subtypeObj.name) {
            subtypeName = subtypeObj.name;
          } else if (subtypeObj.encodedName) {
            subtypeName = subtypeObj.encodedName.replace('/', ''); // Remove leading slash
          } else if (typeof subtypeObj === 'string') {
            subtypeName = subtypeObj;
          } else if (subtypeObj.toString) {
            subtypeName = subtypeObj.toString();
          }
        }
        console.log('[PDF][getImagesFromPage] subtypeName from dict.get:', subtypeName);
      } else {
        console.warn('[PDF][getImagesFromPage] xObjectActual missing dict or get:', xObjectActual);
      }

      // Filter for image-like subtypes
      const widthObj = xObjectActual.dict.get(PDFName.of('Width'));
      const width = widthObj?.value ? widthObj.value() : undefined;

      const heightObj = xObjectActual.dict.get(PDFName.of('Height'));
      const height = heightObj?.value ? heightObj.value() : undefined;

      const bitsObj = xObjectActual.dict.get(PDFName.of('BitsPerComponent'));
      const bitsPerComponent = bitsObj?.value ? bitsObj.value() : undefined;

      const colorSpaceObj = xObjectActual.dict.get(PDFName.of('ColorSpace'));
      const colorSpace = colorSpaceObj?.name || colorSpaceObj?.encodedName?.replace('/', '') || colorSpaceObj?.toString();

      const filterObj = xObjectActual.dict.get(PDFName.of('Filter'));
      const filter = filterObj?.name || filterObj?.encodedName?.replace('/', '') || filterObj?.toString();
      if (/^(Image|Imag|Img)/i.test(subtypeName)) {
        images.push({
          ref,
          width,
          height,
          bitsPerComponent,
          colorSpace,
          filter,
        });
      }
    }
  }
  return images;
}
// ======================= IMAGE DECODER WITH SAFETY LIMITS =======================
/**
 * Decode and normalize an embedded PDF image stream.
 * @returns {Promise<{name:string, width:number, height:number, mime:string, data:string|null, skipped:boolean, reason?:string}|null>}
 */
async function decodeImage(obj, imgMeta, base, pageNum, imageCount) {
  // imgMeta: { ref, width, height, bitsPerComponent, colorSpace, filter }
  if (imageCount >= MAX_IMAGES_PER_PDF) {
    console.warn(`[PDF][decodeImage] Maximum image limit reached (${MAX_IMAGES_PER_PDF}) at page ${pageNum}. Skipping image.`);
    return null;
  }

  // Resolve reference to the actual image object
  let imageObj = obj;
  if (!imageObj) {
    console.error(`[PDF][decodeImage] Unable to resolve image ref at page ${pageNum}`);
    return null;
  }

  const width = imgMeta.width || 0;
  const height = imgMeta.height || 0;
  const filter = imgMeta.filter || '';
  const colorSpace = imgMeta.colorSpace || 'DeviceRGB';
  const bitsPerComponent = imgMeta.bitsPerComponent || 8;

  console.log(`[PDF][decodeImage] validateImageDimensions input: width=${width}, height=${height}, pageNum=${pageNum}`);

  if (!validateImageDimensions(width, height, pageNum)) {
    console.warn(`[PDF][decodeImage] Invalid image dimensions at page ${pageNum}, skipping.`);
    return null;
  }

  if (!imageObj.contents) {
    console.error(`[PDF][decodeImage] Image object missing contents at page ${pageNum}`);
    return null;
  }
  const streamData = Buffer.from(imageObj.contents);
  const compressedSizeMB = streamData.length / (1024 * 1024);
  console.log(`[PDF][decodeImage] Image stream loaded (compressed: ${compressedSizeMB.toFixed(2)}MB) at page ${pageNum}`);

  let mime = 'image/png';
  let bufferOut;

  try {
    if (filter.includes('DCTDecode')) {
      mime = 'image/jpeg';
      bufferOut = streamData;
      trackMemory(compressedSizeMB, `JPEG image page ${pageNum}`);
      console.log(`[PDF][decodeImage] JPEG image (DCTDecode) detected at page ${pageNum}`);
    } else if (filter.includes('JPXDecode')) {
      mime = 'image/jp2';
      bufferOut = streamData;
      trackMemory(compressedSizeMB, `JPEG2000 image page ${pageNum}`);
      console.log(`[PDF][decodeImage] JPEG2000 image (JPXDecode) detected at page ${pageNum}`);
    } else if (filter.includes('FlateDecode')) {
      console.log(`[PDF][decodeImage] Decompressing FlateDecode image on page ${pageNum} (compressed: ${compressedSizeMB.toFixed(2)}MB)...`);
      let inflated, decompressedSizeMB;
      try {
        inflated = await decompressWithLimit(streamData, MAX_DECOMPRESSED_SIZE);
        decompressedSizeMB = inflated.length / (1024 * 1024);
        console.log(`[PDF][decodeImage] Decompressed size: ${decompressedSizeMB.toFixed(2)}MB (${(decompressedSizeMB / compressedSizeMB).toFixed(1)}x expansion) on page ${pageNum}`);
        trackMemory(decompressedSizeMB, `FlateDecode decompress page ${pageNum}`);
      } catch (err) {
        console.error(`[PDF][decodeImage] Decompression failed on page ${pageNum}: ${err.message}`);
        return null;
      }

      // Defaults for PNG
      const predictor = 1;  // Typically extracted from DecodeParms if needed
      const columns = width;
      const colors = colorSpace.includes('CMYK') ? 4 : colorSpace.includes('Gray') ? 1 : 3;

      const fixed = applyPredictor(inflated, predictor, columns, colors);
      console.log(`[PDF][decodeImage] Predictor applied (predictor=${predictor}, columns=${columns}, colors=${colors}) on page ${pageNum}`);

      const bytesPerPixel = colors;
      let rgba = Buffer.alloc(width * height * 4);

      for (let i = 0, j = 0; i < fixed.length && j < rgba.length; i += bytesPerPixel, j += 4) {
        if (bytesPerPixel === 1) {
          const v = fixed[i];
          rgba[j] = rgba[j + 1] = rgba[j + 2] = v;
        } else {
          rgba[j] = fixed[i];
          rgba[j + 1] = fixed[i + 1] || fixed[i];
          rgba[j + 2] = fixed[i + 2] || fixed[i];
        }
        rgba[j + 3] = 255;
      }

      const resizeResult = resizeImageBuffer(rgba, width, height);
      rgba = resizeResult.buffer;
      const finalWidth = resizeResult.width;
      const finalHeight = resizeResult.height;

      console.log(`[PDF][decodeImage] Image resized to ${finalWidth}x${finalHeight} on page ${pageNum}`);

      const png = new PNG({ width: finalWidth, height: finalHeight });
      png.data = rgba;
      bufferOut = PNG.sync.write(png);

      releaseMemory(decompressedSizeMB);
      const pngSizeMB = bufferOut.length / (1024 * 1024);
      trackMemory(pngSizeMB, `PNG encode page ${pageNum}`);
      console.log(`[PDF][decodeImage] PNG encoded image size: ${pngSizeMB.toFixed(2)}MB on page ${pageNum}`);
    } else {
      console.warn(`[PDF][decodeImage] Unsupported image filter ${filter} on page ${pageNum}, skipping.`);
      return null;
    }

    const estimatedBase64Size = bufferOut.length * 1.34;
    if (estimatedBase64Size > OPENAI_LIMIT) {
      console.warn(`[PDF][decodeImage] Image too large for OpenAI on page ${pageNum}: ${(estimatedBase64Size / (1024 * 1024)).toFixed(1)}MB. Skipping AI analysis.`);
      return {
        name: `${base}-page${pageNum}-${uuidv4()}.${mime.split('/')[1]}`,
        width,
        height,
        mime,
        data: null,
        skipped: true,
        reason: 'Too large for AI analysis'
      };
    }

    const base64Data = bufferOut.toString('base64');
    const base64SizeMB = base64Data.length / (1024 * 1024);
    trackMemory(base64SizeMB, `base64 encode page ${pageNum}`);
    console.log(`[PDF][decodeImage] Base64 encoded image size: ${base64SizeMB.toFixed(2)}MB on page ${pageNum}`);

    return {
      name: `${base}-page${pageNum}-${uuidv4()}.${mime.split('/')[1]}`,
      width,
      height,
      mime,
      data: base64Data,
      skipped: false,
    };
  } catch (err) {
    console.error(`[PDF][decodeImage] Error decoding image on page ${pageNum}: ${err.message}`);
    return null;
  }
}




// ======================= AI ANALYSIS WITH SAFETY =======================

async function analyzeWithOpenAI(base64data, fileName, mime, teamName, assistantName) {
  if (!base64data) {
    return '[Image skipped - too large for analysis]';
  }

  const sizeMB = base64data.length / (1024 * 1024);
  if (sizeMB > OPENAI_LIMIT / (1024 * 1024)) {
    console.warn(`Image ${fileName} too large for OpenAI: ${sizeMB.toFixed(1)}MB`);
    return '[Image too large for AI analysis]';
  }

  try {
    const messages = [
      {
        role: "system",
        content: "Extract all visible text and describe detailed visual elements, including diagrams, figures, and UI components. Provide structured descriptions. Provide a title for the image."
      },
      {
        role: "user",
        content: [
          { type: "text", text: `Analyze ${fileName} and extract all text and visual elements.` },
          { type: "image_url", image_url: { url: `data:${mime};base64,${base64data}` } }
        ]
      }
    ];
    const res = await sendChatCompletionWithImage2(messages, teamName, assistantName);
    return res?.content || '[No AI response]';
  } catch (err) {
    console.error(`OpenAI analysis failed`);
    return `[AI analysis error]`;
  }
}

// ======================= PDF EXTRACTION WITH LIMITS =======================

export async function extractPdfContent(fileBuffer, baseName = 'document', teamName, assistantName, options = {}) {
  // PDF size validation
  const fileSizeMB = fileBuffer.length / (1024 * 1024);
  if (fileSizeMB > MAX_PDF_SIZE_MB) {
    throw new Error(
      `PDF file too large: ${fileSizeMB.toFixed(1)}MB exceeds maximum of ${MAX_PDF_SIZE_MB}MB`
    );
  }

  console.log(`[PDF] Processing PDF: ${fileSizeMB.toFixed(2)}MB`);
  resetMemoryTracking();

  const skipImages = Boolean(options.skipImages);

  // Load PDF and extract text
  const pdf = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
  const pages = pdf.getPages();

  // Page count warning
  if (pages.length > 100) {
    console.warn(`PDF has ${pages.length} pages - this may take a while`);
  }

  const { text } = await extractPdfText(fileBuffer);
  const textChunks = text.split(/\f|\n\s*Page\s*\d+\s*\n/);

  let enrichedText = '';
  let totalImagesExtracted = 0;
  let totalImagesSkipped = 0;
  const pageAudit = [];

  // Page processing loop
  for (let p = 0; p < pages.length; p++) {
    const pageNum = p + 1;
    const page = pages[p];
    console.log(`[PDF] Processing page ${pageNum}/${pages.length} ===`);

    // Extract page text
    let pageText = (textChunks[p] || '').trim();

    // Extract image metadata
    const imgMetas = skipImages ? [] : getImagesFromPage(page);
    if (skipImages) {
      console.log(`[PDF] Image extraction skipped for page ${pageNum}`);
    } else {
      console.log(`[PDF] Found ${imgMetas.length} image(s) on page ${pageNum}`);
    }

    let pageImages = [];

    // Image extraction only if images exist
    if (imgMetas.length > 0) {
      for (let idx = 0; idx < imgMetas.length; idx++) {
        const meta = imgMetas[idx];

        // Optionally resolve image reference
        const obj = typeof meta.ref === 'object' && meta.ref.objectNumber
          ? page.doc.context.lookup(meta.ref)
          : meta.ref;

        console.log('[PDF] decodeImage initialization with meta');
        const img = await decodeImage(obj, meta, baseName, pageNum, totalImagesExtracted);

        if (img) {
          pageImages.push(img);
          totalImagesExtracted++;
          if (img.skipped) totalImagesSkipped++;
        }

        if (totalImagesExtracted >= MAX_IMAGES_PER_PDF) {
          console.warn(`Reached maximum image limit (${MAX_IMAGES_PER_PDF}). Stopping image extraction.`);
          break;
        }
      }
    }

    // Build page output segment
    let pageSegment = `\n\n=== Page ${pageNum} ===\n${pageText || '[No text content found]'}\n`;

    if (pageImages.length > 0) {
      pageSegment += `\n--- Extracted ${pageImages.length} image(s) on this page ---\n`;
      for (const [idx, img] of pageImages.entries()) {
        if (img.skipped) {
          pageSegment += `\n[Image ${idx + 1}: ${img.name}]\nSkipped: ${img.reason}\n--- End of image ${idx + 1} ---\n`;
        } else {
          let desc = '';
          try {
            desc = await analyzeWithOpenAI(img.data, img.name, img.mime, teamName, assistantName);
            // Clear base64 data after AI analysis to free memory
            img.data = null;
            const clearedMB = (img.width * img.height * 4 * 1.34) / (1024 * 1024);
            releaseMemory(clearedMB);
          } catch (err) {
            desc = `Error analyzing image: ${err.message}`;
          }
          pageSegment += `\n[Image ${idx + 1}: ${img.name}]\nAI description: ${desc}\n--- End of image ${idx + 1} ---\n`;
        }
      }
    }

    enrichedText += pageSegment;

    // Periodic garbage collection
    if (pageNum % 2 === 0) forceGarbageCollection();
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log('PDF Page Audit Summary:', pageAudit);
  console.log(`\n=== PDF Processing Complete ===`);
  console.log(`[PDF] Total images extracted: ${totalImagesExtracted}`);
  console.log(`[PDF] Total images skipped: ${totalImagesSkipped}`);
  console.log(`[PDF] Extracted text length: ${text.length}, enriched length: ${enrichedText.length}`);
  console.log(`[PDF] Peak memory usage: ${currentMemoryUsageMB.toFixed(1)}MB`);

  return {
    text: enrichedText,
    totalImagesExtracted: totalImagesExtracted,
    totalImagesSkipped: totalImagesSkipped
  };
}


// ======================= DOCX EXTRACTION WITH LIMITS =======================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Extract header and footer text from DOCX XML
async function extractDocxHeadersAndFooters(docBuffer) {
  return new Promise((resolve, reject) => {
    const headers = [];
    const footers = [];

    yauzl.fromBuffer(docBuffer, { lazyEntries: true }, (err, zipFile) => {
      if (err) {
        console.error('[DOCX] Failed to open buffer for header/footer extraction:', err);
        resolve({ headers: [], footers: [] });
        return;
      }

      zipFile.readEntry();

      zipFile.on('entry', (entry) => {
        // Look for header or footer XML files
        const isHeader = entry.fileName.startsWith('word/header') && entry.fileName.endsWith('.xml');
        const isFooter = entry.fileName.startsWith('word/footer') && entry.fileName.endsWith('.xml');

        if (isHeader || isFooter) {
          const type = isHeader ? 'header' : 'footer';
          console.log(`[DOCX] Found ${type}: ${entry.fileName}`);

          zipFile.openReadStream(entry, (err, readStream) => {
            if (err) {
              console.error(`[DOCX] Error opening ${type} stream:`, err);
              zipFile.readEntry();
              return;
            }

            const chunks = [];
            readStream.on('data', chunk => chunks.push(chunk));

            readStream.on('end', () => {
              const xmlContent = Buffer.concat(chunks).toString('utf8');
              // Extract text from XML tags
              const textMatches = xmlContent.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
              const extractedText = textMatches
                .map(match => match.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1'))
                .join(' ')
                .trim();

              if (extractedText) {
                const item = {
                  fileName: entry.fileName,
                  text: extractedText
                };

                if (isHeader) {
                  headers.push(item);
                } else {
                  footers.push(item);
                }

                console.log(`[DOCX] Extracted ${type} text: ${extractedText.substring(0, 100)}...`);
              }
              zipFile.readEntry();
            });

            readStream.on('error', (err) => {
              console.error(`[DOCX] ${type} stream error:`, err);
              zipFile.readEntry();
            });
          });
        } else {
          zipFile.readEntry();
        }
      });

      zipFile.on('end', () => {
        console.log(`[DOCX] Extraction complete. Found ${headers.length} header(s) and ${footers.length} footer(s)`);
        resolve({ headers, footers });
      });

      zipFile.on('error', (err) => {
        console.error('[DOCX] ZIP error during header/footer extraction:', err);
        resolve({ headers, footers });
      });
    });
  });
}


export async function* extractDocxImagesFromBufferStream(docBuffer, baseName, maxImages = 100) {
  const queue = [];
  let done = false;
  let error = null;

  await new Promise((resolve, reject) => {
    yauzl.fromBuffer(docBuffer, { lazyEntries: true }, (err, zipFile) => {
      if (err) {
        error = err;
        done = true;
        console.error('[DOCX] Failed to open buffer as ZIP:', err);
        reject(err);
        return;
      }

      let imageCount = 0;
      zipFile.readEntry();

      zipFile.on('entry', (entry) => {
        console.log(`[DOCX] Found entry: ${entry.fileName}`);

        if (imageCount >= maxImages) {
          console.warn(`[DOCX] Max image limit (${maxImages}) reached, closing ZIP.`);
          zipFile.close();
          done = true;
          resolve();
          return;
        }
        if (!entry.fileName.startsWith('word/media/')) {
          console.log(`[DOCX] Skip non-image entry: ${entry.fileName}`);
          zipFile.readEntry();
          return;
        }

        console.log(`[DOCX] Processing image entry: ${entry.fileName}`);
        zipFile.openReadStream(entry, (err, readStream) => {
          if (err) {
            error = err;
            done = true;
            console.error(`[DOCX] Error opening image stream for ${entry.fileName}:`, err);
            zipFile.close();
            reject(err);
            return;
          }

          const chunks = [];
          let totalLength = 0;

          readStream.on('data', chunk => {
            totalLength += chunk.length;
            chunks.push(chunk);
          });

          readStream.on('end', () => {
            const buf = Buffer.concat(chunks);
            const name = `${baseName}-${path.basename(entry.fileName)}`;
            const ext = path.extname(entry.fileName).toLowerCase();
            let mime = 'image/png';
            if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
            else if (ext === '.gif') mime = 'image/gif';

            // Debug: Log size and type
            const sizeMB = (buf.length / (1024 * 1024)).toFixed(2);
            console.log(`[DOCX] Image ${name} (${mime}): ${sizeMB} MB`);

            // Skip overly large images
            if (buf.length > 10 * 1024 * 1024) {
              console.warn(`[DOCX] Skipping image ${name}: size ${sizeMB} MB exceeds 10MB`);
              zipFile.readEntry();
              return;
            }

            queue.push({ name, mime, data: buf.toString('base64'), sizeMB });
            imageCount++;
            zipFile.readEntry();
          });

          readStream.on('error', (err) => {
            error = err;
            done = true;
            console.error(`[DOCX] Stream error for ${entry.fileName}:`, err);
            zipFile.close();
            reject(err);
          });
        });
      });

      zipFile.on('end', () => {
        done = true;
        console.log('[DOCX] Extractor: reached end of file.');
        resolve();
      });
      zipFile.on('error', (err) => {
        error = err;
        done = true;
        console.error('[DOCX] ZIP error:', err);
        reject(err);
      });
    });
  });

  // Yield images from queue
  while (!done || queue.length) {
    while (queue.length) {
      const img = queue.shift();
      console.log(`[DOCX] Yielding image: ${img.name} (${img.sizeMB} MB, ${img.mime})`);
      yield img;
    }
    if (!done) await sleep(10);
    if (error) throw error;
  }

  console.log('[DOCX] All images yielded.');
}

// ======================= MAIN DOCUMENT PROCESSOR =======================

export async function extractImageText(fileBuffer, fileName, opts = {}, teamName, assistantName) {
  const session = await getServerSession();
  const nuid = session.nuid;
  const ext = path.extname(fileName).toLowerCase();
  const base = path.basename(fileName, ext);
  const includeAI = opts.includeImageDescriptions ?? true;
  const skipPdfImages = Boolean(opts.skipPdfImages);

  resetMemoryTracking();

  let text = '';
  let images = [];
  let enrichedText = '';
  const descriptions = [];

  try {
    if (ext === '.pdf') {
      const result = await extractPdfContent(fileBuffer, base, teamName, assistantName, { skipImages: skipPdfImages });
      enrichedText = result.text || '';
      text = enrichedText;

      if ((result.totalImagesExtracted).length > 0) {
        let params = {
          imageType: 'pdf',
          fileFormat: '',
          count: result.totalImagesExtracted || 0,
        }
        recordImageProcessed(nuid, null, teamName, assistantName, params);
      }
    } else if (ext === '.docx') {
      // Validate DOCX size
      const fileSizeMB = fileBuffer.length / (1024 * 1024);
      if (fileSizeMB > MAX_DOCX_SIZE_MB) {
        throw new Error(
          `DOCX file too large: ${fileSizeMB.toFixed(1)}MB exceeds maximum of ${MAX_DOCX_SIZE_MB}MB`
        );
      }

      const docxAst = await parseOffice(fileBuffer);
      const rawText = (docxAst.toText() || '').trim();

      const extractHeadersFootersFlag = await getFeatureFlag('extract-docx-headers-footers');
      let headers = [];
      let footers = [];

      if (extractHeadersFootersFlag && extractHeadersFootersFlag.enabled) {
        const extracted = await extractDocxHeadersAndFooters(fileBuffer);
        headers = extracted.headers;
        footers = extracted.footers;
        console.log(`[DOCX] Feature flag enabled: Extracted ${headers.length} header(s) and ${footers.length} footer(s)`);
      } else {
        console.log(`[DOCX] Feature flag disabled: Skipping header/footer extraction`);
      }

      // Async generator for images
      const imagesByDocx = [];
      for await (const img of extractDocxImagesFromBufferStream(fileBuffer, base)) {
        imagesByDocx.push(img);
      }
      if (imagesByDocx.length > 0) {
        let params = {
          imageType: 'word',
          fileFormat: '',
          count: imagesByDocx.length
        }
        recordImageProcessed(nuid, null, teamName, assistantName, params);
      }
      // Start with headers at the top of the document
      enrichedText = '';
      if (headers.length > 0) {
        enrichedText += '=== Document Headers ===\n';
        headers.forEach((header, idx) => {
          enrichedText += `Header ${idx + 1}: ${header.text}\n`;
        });
        enrichedText += '\n';
      }

      enrichedText += '=== Document Sections ===\n';
      const docParagraphs = rawText.split(/\n\s*\n/).filter(Boolean);

      if (includeAI && imagesByDocx.length > 0) {
        for (let i = 0; i < imagesByDocx.length; i++) {
          if (i % CONCURRENT_IMAGES === 0) {
            await new Promise(resolve => setTimeout(resolve, 800));
          }

          try {
            const desc = await analyzeWithOpenAI(
              imagesByDocx[i].data,
              imagesByDocx[i].name,
              imagesByDocx[i].mime,
              teamName,
              assistantName
            );
            descriptions.push({
              imageName: imagesByDocx[i].name,
              description: desc
            });
          } catch (err) {
            descriptions.push({
              imageName: imagesByDocx[i].name,
              description: `Error analyzing image: ${err.message}`
            });
          }
        }

        const paragraphsPerImage = Math.max(
          1,
          Math.floor(docParagraphs.length / (imagesByDocx.length || 1))
        );

        for (let i = 0, imgIdx = 0; i < docParagraphs.length; i++) {
          enrichedText += `${docParagraphs[i]}\n\n`;

          if (imgIdx < descriptions.length && (i + 1) % paragraphsPerImage === 0) {
            enrichedText += `--- Image ${imgIdx + 1}: ${descriptions[imgIdx].imageName} ---\n`;
            enrichedText += `${descriptions[imgIdx].description}\n--- End of image ---\n\n`;
            imgIdx++;
          }
        }

        for (let j = docParagraphs.length; j < descriptions.length; j++) {
          enrichedText += `\n[Extra Image ${j + 1}: ${descriptions[j].imageName}]\n`;
          enrichedText += `${descriptions[j].description}\n--- End of image ---\n`;
        }
      } else {
        enrichedText += `${rawText}\n\n=== Embedded Images ===\n` +
          imagesByDocx.map((img, i) => `Image ${i + 1}: ${img.name}`).join('\n');
      }

      // Append footers at the end of the document
      if (footers.length > 0) {
        enrichedText += '\n\n=== Document Footers ===\n';
        footers.forEach((footer, idx) => {
          enrichedText += `Footer ${idx + 1}: ${footer.text}\n`;
        });
      }

      text = rawText;
      images = imagesByDocx;

      console.log(`DOCX processed: text ${rawText.length} chars, ${imagesByDocx.length} images`);
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    return {
      enrichedText,
      metadata: {
        file: fileName,
        textLength: text.length,
        imageCount: images.length,
        aiDescriptions: descriptions.length,
      },
    };

  } catch (err) {
    console.error(`Error processing ${fileName}: ${err.message}`);
    throw err;
  } finally {
    // Cleanup
    forceGarbageCollection();
    resetMemoryTracking();
  }
}
