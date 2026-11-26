import { parseOffice } from 'officeparser';
import { getOfficeParserConfig } from '@services/officeParserConfig';

/**
 * Extract plain text from a PDF buffer using officeparser.
 *
 * Returns the same `{ text, numpages }` shape that callers previously
 * consumed, with a form-feed (\f) character inserted between pages so that
 * downstream per-page splitting (e.g. `text.split(/\f|\n\s*Page\s*\d+\s*\n/)`)
 * aligns text with the correct page.
 *
 * officeparser produces a structured AST whose top-level `content` entries are
 * `page` nodes for PDF input; each page node's `text` is the concatenation of
 * all child text on that page. We join those page texts with `\f` to preserve
 * per-page alignment for the image-interleaving logic in extractImageText.
 *
 * @param {Buffer|Uint8Array|ArrayBuffer} fileBuffer - Raw PDF bytes.
 * @returns {Promise<{ text: string, numpages: number }>}
 */
export async function extractPdfText(fileBuffer) {
  // Normalize to a Node Buffer so officeparser's file-type detection works on the bytes.
  const data = Buffer.isBuffer(fileBuffer)
    ? fileBuffer
    : Buffer.from(fileBuffer);

  try {
    const ast = await parseOffice(data, getOfficeParserConfig({ newlineDelimiter: '\n' }));

    const pageNodes = (ast.content || []).filter((node) => node.type === 'page');
    const pages = pageNodes.length > 0
      ? pageNodes.map((node) => node.text || '')
      : [ast.toText() || ''];
    const numpages = pages.length;

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'extractPdfText',
        detail: { numpages, bytes: data.byteLength },
      },
    }));

    // Form-feed between pages preserves per-page alignment for downstream splitting.
    return { text: pages.join('\f'), numpages };
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'extractPdfText',
        detail: { bytes: data.byteLength, error: error.message },
      },
    }));
    throw error;
  }
}

export default extractPdfText;
