const pdfParse = require('pdf-parse');

/**
 * Parse PDF buffer and extract text content and metadata
 * @param {Buffer} buffer - PDF file buffer
 * @returns {Promise<{text: string, metadata: object}>}
 */
async function parsePdfWithPdfParse(buffer) {
  const data = await pdfParse(buffer);
  return {
    text: data.text,
    metadata: {
      numpages: data.numpages,
      info: data.info,
      metadata: data.metadata,
      version: data.version
    }
  };
}

module.exports = { parsePdfWithPdfParse };
