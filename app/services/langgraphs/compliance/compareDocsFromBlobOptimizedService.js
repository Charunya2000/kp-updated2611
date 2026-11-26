'use server';

import { BlobServiceClient } from '@azure/storage-blob';
import officeParser from 'officeparser';
import pdfParse from 'pdf-parse';
import { MongoClient } from 'mongodb';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Anchor-based diff: sliding window of N words to find first matching sequence, then record non-matching content before each anchor
function anchorBasedDiff(textA, textB, options = {}) {
  const windowSize = options.windowSize || 50;
  const wordsA = textA.match(/\S+/g) || [];
  const wordsB = textB.match(/\S+/g) || [];
  let posA = 0, posB = 0;
  const differences = [];
  let lastA = 0, lastB = 0;
  while (posA < wordsA.length && posB < wordsB.length) {
    let found = false;
    for (; posA <= wordsA.length - windowSize; posA++) {
      const windowA = wordsA.slice(posA, posA + windowSize).join(' ');
      let matchB = -1;
      for (let b = posB; b <= wordsB.length - windowSize; b++) {
        const windowB = wordsB.slice(b, b + windowSize).join(' ');
        if (windowA === windowB) {
          matchB = b;
          break;
        }
      }
      if (matchB !== -1) {
        if (posA > lastA || matchB > lastB) {
          const diffA = wordsA.slice(lastA, posA).join(' ');
          const diffB = wordsB.slice(lastB, matchB).join(' ');
          if (diffA) differences.push({ type: 'docA', value: diffA });
          if (diffB) differences.push({ type: 'docB', value: diffB });
        }
        const anchor = wordsA.slice(posA, posA + windowSize).join(' ');
        differences.push({ type: 'match', value: anchor });
        lastA = posA + windowSize;
        lastB = matchB + windowSize;
        posA = lastA;
        posB = lastB;
        found = true;
        break;
      }
    }
    if (!found) {
      if (lastA < wordsA.length) {
        const diffA = wordsA.slice(lastA).join(' ');
        if (diffA) differences.push({ type: 'docA', value: diffA });
      }
      if (lastB < wordsB.length) {
        const diffB = wordsB.slice(lastB).join(' ');
        if (diffB) differences.push({ type: 'docB', value: diffB });
      }
      break;
    }
  }
  return differences;
}
// scripts/compareDocsFromBlobOptimized.js
// Memory-optimized version: streams large files from Azure Blob Storage and processes in chunks


// Main function for CLI usage
async function main() {

  if (process.argv[1] && process.argv[1].endsWith('compareDocsFromBlobOptimized.js') && process.argv.length >= 7) {
    const [, , container, fileA, fileB, env, jobId] = process.argv;
    try {
      const result = await compareDocsFromBlobOptimized({
        container,
        fileA,
        fileB,
        meta: { env, jobId }
      });

    } catch (err) {
      console.error('Error running compareDocsFromBlobOptimized:', err);
      process.exit(1);
    }
  }
}

// Only run main if this file is executed directly
if (import.meta && import.meta.url && import.meta.url.endsWith('compareDocsFromBlobOptimized.js')) {
  main();
}

// Helper: Download blob to a temp file (streaming)
async function downloadBlobToTempFile(containerName, blobName, connectionString) {
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(blobName);
  const downloadResponse = await blobClient.download();
  const tempFilePath = path.join(os.tmpdir(), `${Date.now()}-${blobName}`);
  const writable = fs.createWriteStream(tempFilePath);
  await new Promise((resolve, reject) => {
    downloadResponse.readableStreamBody.pipe(writable);
    writable.on('finish', resolve);
    writable.on('error', reject);
  });
  return tempFilePath;
}


// Parse PDF in chunks (page by page) using pdf-parse, with defensive checks
async function* parsePdfByPage(filePath) {
  const buffer = fs.readFileSync(filePath);
  let data;
  try {
    data = await pdfParse(buffer);
  } catch (err) {
    console.error('Error parsing PDF:', err);
    yield { page: 1, content: '[PDF PARSE ERROR]' };
    return;
  }
  if (!data || typeof data.text !== 'string') {
    console.error('pdf-parse failed or returned no text. Full data:', data);
    yield { page: 1, content: '[PDF PARSE ERROR OR EMPTY]' };
    return;
  }
  // Heuristic: split by double newlines for pages
  const pages = data.text.split(/\n\n+/);
  for (let idx = 0; idx < pages.length; idx++) {
    yield { page: idx + 1, content: pages[idx] ? pages[idx].trim() : '' };
  }
}


// Parse DOCX in chunks (section by section) using officeparser
async function* parseDocxBySection(filePath) {
  // officeparser returns all text as a string, so we split by headings/paragraphs heuristically
  const buffer = fs.readFileSync(filePath);
  const text = await new Promise((resolve, reject) => {
    officeParser.parseOffice(buffer, (ast, err) => {
      if (err) reject(err);
      else resolve(ast.toText());
    });
  });
  // Heuristic: split by double newlines for sections, single newline for paragraphs
  const sections = text.split(/\n\n+/);
  for (let idx = 0; idx < sections.length; idx++) {
    const section = sections[idx];
    const paragraphs = section.split(/\n/).filter(Boolean);
    yield { heading: paragraphs[0] || null, paragraphs: paragraphs.slice(1) };
  }
}

// Compare two iterators chunk by chunk
async function compareChunks(genA, genB, type) {
  const differences = [];
  let idx = 0;
  let chunkA = await genA.next();
  let chunkB = await genB.next();
  while (!chunkA.done || !chunkB.done) {
    if (type === 'pdf') {
      if (chunkA.done || chunkB.done || chunkA.value.content !== chunkB.value.content) {
        differences.push({
          type: 'page',
          page: idx + 1,
          docA: chunkA.done ? null : chunkA.value.content,
          docB: chunkB.done ? null : chunkB.value.content,
        });
      }
    } else if (type === 'docx') {
      if (chunkA.done || chunkB.done || chunkA.value.heading !== chunkB.value.heading) {
        differences.push({
          type: 'section-heading',
          section: idx,
          docA: chunkA.done ? null : chunkA.value.heading,
          docB: chunkB.done ? null : chunkB.value.heading,
        });
      }
      // Compare paragraphs if both exist
      if (!chunkA.done && !chunkB.done) {
        const parasA = chunkA.value.paragraphs;
        const parasB = chunkB.value.paragraphs;
        const maxLen = Math.max(parasA.length, parasB.length);
        for (let pIdx = 0; pIdx < maxLen; pIdx++) {
          if (parasA[pIdx] !== parasB[pIdx]) {
            differences.push({
              type: 'paragraph',
              section: idx,
              subsection: pIdx,
              docA: parasA[pIdx],
              docB: parasB[pIdx],
            });
          }
        }
      }
    }
    idx++;
    chunkA = await genA.next();
    chunkB = await genB.next();
  }
  return differences;
}


// Store differences in MongoDB
async function storeDifferences(differences, meta, mongoUri) {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db('doccompare');
  const collection = db.collection('differences');
  await collection.insertOne({ meta, differences, createdAt: new Date() });
  await client.close();
}

// Main function
async function compareDocsFromBlobOptimized({ container, fileA, fileB, meta }) {
  const envName = process.env['envName'];

  const blobAccountName = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.accountName`];
  const blobAccountKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.accountKey`];


  const blobStoreConnectionString = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.endpoint`];

  // const blobStoreConnectionString = process.env['host.' + meta.env + '-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.endpoint'];
  const mongoEndpoint = process.env['host.' + meta.env + '-aiportal-web-2.aisvc.aksnp.azure.kp.org.mongodb.endpoint'];




  // const connectionString = `DefaultEndpointsProtocol=https;AccountName=${blobAccountName};AccountKey=${blobAccountKey};EndpointSuffix=core.windows.net`;





  // Download blobs to temp files (streamed)
  const tempA = await downloadBlobToTempFile(container, fileA, blobStoreConnectionString);
  const tempB = await downloadBlobToTempFile(container, fileB, blobStoreConnectionString);



  let differences = [];
  if (fileA.endsWith('.pdf') && fileB.endsWith('.pdf')) {
    // Windowed, chunked (3-sentence) comparison within each page for PDFs
    const pagesA = [];
    for await (const page of parsePdfByPage(tempA)) pagesA.push(page.content || '');
    const pagesB = [];
    for await (const page of parsePdfByPage(tempB)) pagesB.push(page.content || '');
    const maxPages = Math.max(pagesA.length, pagesB.length);
    differences = [];
    for (let i = 0; i < maxPages; i++) {
      function splitSentences(text) {
        // Capture sentences with original whitespace preserved
        const regex = /[^.!?]+[.!?]+(\s|$)/g;
        let match;
        let sentences = [];
        while ((match = regex.exec(text || '')) !== null) {
          sentences.push(match[0]);
        }
        return sentences;
      }
      const origSentencesA = splitSentences(pagesA[i] || '');
      const origSentencesB = splitSentences(pagesB[i] || '');
      // For matching, use normalized versions, but for context, use original
      const sentencesA = origSentencesA.map(s => s.replace(/\s+/g, ' ').trim());
      const sentencesB = origSentencesB.map(s => s.replace(/\s+/g, ' ').trim());
      const usedA = new Array(sentencesA.length).fill(false);
      const usedB = new Array(sentencesB.length).fill(false);
      const WINDOW_SIZE = 10;
      const fuzzyThreshold = 0.15;
      function jaccard(a, b) {
        const setA = new Set(a.split(' '));
        const setB = new Set(b.split(' '));
        const intersection = new Set([...setA].filter(x => setB.has(x)));
        const union = new Set([...setA, ...setB]);
        return union.size === 0 ? 0 : intersection.size / union.size;
      }
      // Helper to get context window for a sentence index
      function getContext(origSentences, idx) {
        const before = [];
        const after = [];
        for (let j = Math.max(0, idx - 3); j < idx; j++) before.push(origSentences[j]);
        for (let j = idx + 1; j < Math.min(origSentences.length, idx + 4); j++) after.push(origSentences[j]);
        return {
          before: before.join('').trim(),
          after: after.join('').trim()
        };
      }
      let aIdx = 0, bIdx = 0;
      while (aIdx < sentencesA.length || bIdx < sentencesB.length) {
        // Skip empty
        while (aIdx < sentencesA.length && !sentencesA[aIdx].trim()) aIdx++;
        while (bIdx < sentencesB.length && !sentencesB[bIdx].trim()) bIdx++;
        if (aIdx >= sentencesA.length && bIdx >= sentencesB.length) break;

        let found = false;
        let bestSim = 0;
        let bestB = -1;
        // Try to match A[aIdx] to B in window
        if (aIdx < sentencesA.length) {
          const sentA = sentencesA[aIdx];
          const start = Math.max(0, bIdx - WINDOW_SIZE);
          const end = Math.min(sentencesB.length, bIdx + WINDOW_SIZE + 1);
          for (let bWin = start; bWin < end; bWin++) {
            if (!usedB[bWin]) {
              const sentB = sentencesB[bWin];
              if (sentA === sentB) {
                const contextDocA = getContext(origSentencesA, aIdx);
                const contextDocB = getContext(origSentencesB, bWin);
                differences.push({
                  type: 'match',
                  page: i + 1,
                  sentenceA: aIdx + 1,
                  sentenceB: bWin + 1,
                  docA: origSentencesA[aIdx],
                  docB: origSentencesB[bWin],
                  contextDocA,
                  contextDocB
                });
                usedA[aIdx] = true;
                usedB[bWin] = true;
                aIdx++;
                bIdx = bWin + 1;
                found = true;
                break;
              } else {
                const sim = jaccard(sentA, sentB);
                if (sim > fuzzyThreshold && sim > bestSim) {
                  bestSim = sim;
                  bestB = bWin;
                }
              }
            }
          }
          if (!found && bestB !== -1) {
            const contextDocA = getContext(origSentencesA, aIdx);
            const contextDocB = getContext(origSentencesB, bestB);
            differences.push({
              type: 'fuzzy',
              similarity: bestSim,
              page: i + 1,
              sentenceA: aIdx + 1,
              sentenceB: bestB + 1,
              docA: origSentencesA[aIdx],
              docB: origSentencesB[bestB],
              contextDocA,
              contextDocB
            });
            usedA[aIdx] = true;
            usedB[bestB] = true;
            aIdx++;
            bIdx = bestB + 1;
            found = true;
          }
        }
        if (!found) {
          // Find the max sentence length in this page for normalization
          const allWordCountsA = origSentencesA.map(s => (s || '').split(/\s+/).filter(Boolean).length);
          const allWordCountsB = origSentencesB.map(s => (s || '').split(/\s+/).filter(Boolean).length);
          const maxWords = Math.max(1, ...allWordCountsA, ...allWordCountsB); // Avoid divide by zero
          if (aIdx < sentencesA.length && (bIdx >= sentencesB.length || aIdx <= bIdx)) {
            const contextDocA = getContext(origSentencesA, aIdx);
            const contextDocB = { before: '', after: '' };
            const docA = origSentencesA[aIdx];
            const docB = '';
            const wordsA = (docA || '').split(/\s+/).filter(Boolean).length;
            const diffRating = wordsA / maxWords;
            differences.push({
              type: 'diff',
              page: i + 1,
              sentenceA: aIdx + 1,
              sentenceB: null,
              docA,
              docB,
              diffRating,
              contextDocA,
              contextDocB
            });
            usedA[aIdx] = true;
            aIdx++;
          } else if (bIdx < sentencesB.length) {
            const contextDocA = { before: '', after: '' };
            const contextDocB = getContext(origSentencesB, bIdx);
            const docA = '';
            const docB = origSentencesB[bIdx];
            const wordsB = (docB || '').split(/\s+/).filter(Boolean).length;
            const diffRating = wordsB / maxWords;
            differences.push({
              type: 'diff',
              page: i + 1,
              sentenceA: null,
              sentenceB: bIdx + 1,
              docA,
              docB,
              diffRating,
              contextDocA,
              contextDocB
            });
            usedB[bIdx] = true;
            bIdx++;
          }
        }
      }
    }
  } else if (fileA.endsWith('.docx') && fileB.endsWith('.docx')) {
    // Binary section-by-section comparison for DOCX
    const sectionsA = [];
    for await (const section of parseDocxBySection(tempA)) {
      let text = '';
      if (section.heading) text += section.heading + ' ';
      if (section.paragraphs) text += section.paragraphs.join(' ');
      sectionsA.push(text.trim());
    }
    const sectionsB = [];
    for await (const section of parseDocxBySection(tempB)) {
      let text = '';
      if (section.heading) text += section.heading + ' ';
      if (section.paragraphs) text += section.paragraphs.join(' ');
      sectionsB.push(text.trim());
    }
    const maxSections = Math.max(sectionsA.length, sectionsB.length);
    differences = [];
    for (let i = 0; i < maxSections; i++) {
      const normA = (sectionsA[i] || '').replace(/\s+/g, ' ').trim();
      const normB = (sectionsB[i] || '').replace(/\s+/g, ' ').trim();
      if (normA === normB) {
        differences.push({ type: 'match', section: i + 1 });
      } else {
        differences.push({ type: 'diff', section: i + 1, docA: sectionsA[i] || '', docB: sectionsB[i] || '' });
      }
    }
  } else {
    throw new Error('File types must match and be either .pdf or .docx');
  }

  // await storeDifferences(differences, meta, mongoEndpoint);
  storeDifferencesInFile(differences, meta); // For evaluation

  // Clean up temp files
  fs.unlinkSync(tempA);
  fs.unlinkSync(tempB);

  return differences;
}

// Example usage (uncomment and fill in values to run directly)
// (async () => {
//   const result = await compareDocsFromBlobOptimized({
//     container: 'your-container',
//     fileA: 'doc1.docx',
//     fileB: 'doc2.docx',
//     meta: { env: 'uat', jobId: 'job-123' }
//   });

// })();

export { compareDocsFromBlobOptimized };
