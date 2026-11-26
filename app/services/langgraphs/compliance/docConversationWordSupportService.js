/**
 * Normalized DOCX support producing a structure compatible with PDF fullStructure items:
 * Each node: { heading, headingType, level, page, xPos, yPos, children, parentId, root, content, id }
 * - headingType: h1..h6
 * - level: 0-based (h1 -> 0)
 * - page: synthetic (estimated by cumulative character count; purely for ordering)
 * - xPos / yPos: always null for DOCX
 * - content: "<heading>: <aggregated paragraph text>" (paragraph text trimmed & joined)
 */

import path from 'path';
import os from 'os';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { parseOffice } from 'officeparser';
import { BlobServiceClient } from '@azure/storage-blob';

// Singleton container client (mirrors logic used elsewhere)
let containerClientSingleton = null;
function getContainerClient() {
  if (!containerClientSingleton) {
    const envName = process.env['envName'];
    const connectionStringKey = `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.endpoint`;
    const BLOB_STORAGE_CONNECTION_STRING = process.env[connectionStringKey];
    if (!BLOB_STORAGE_CONNECTION_STRING) {
      throw new Error(`Blob storage connection string not found for key: ${connectionStringKey}`);
    }
    const BLOB_CONTAINER = 'compliance-ai';
    const blobServiceClient = BlobServiceClient.fromConnectionString(BLOB_STORAGE_CONNECTION_STRING);
    containerClientSingleton = blobServiceClient.getContainerClient(BLOB_CONTAINER);
  }
  return containerClientSingleton;
}

// Assign hierarchy similar to PDF logic
function assignHierarchy(nodes) {
  const lastByLevel = {};
  for (const node of nodes) {
    const lvl = node.level;
    let parentId = null;
    for (let pl = lvl - 1; pl >= 0; pl--) {
      if (lastByLevel[pl]) {
        parentId = lastByLevel[pl].id;
        break;
      }
    }
    node.parentId = parentId;
    node.root = !parentId;
    if (parentId) {
      const parent = nodes.find(n => n.id === parentId);
      if (parent) parent.children.push(node.id);
    }
    lastByLevel[lvl] = node;
  }
  return nodes;
}

// Normalize collected heading blocks + body paragraphs into final structure
function finalizeDocxNodes(rawBlocks) {
  const PAGE_CHAR_LIMIT = 8000; // heuristic for synthetic pagination
  let cumulative = 0;
  const nodes = rawBlocks.map((block, index) => {
    const body = block.paragraphs.join(' ').trim();
    const content = body ? `${block.heading}: ${body}` : block.heading;
    cumulative += content.length;
    const page = Math.max(1, Math.floor((cumulative - 1) / PAGE_CHAR_LIMIT) + 1);

    return {
      heading: block.heading,
      headingType: block.headingType,
      level: block.level,
      page,
      xPos: null,
      yPos: null,
      children: [],
      parentId: null,
      root: false,
      content,
      id: uuidv4()
    };
  });

  return assignHierarchy(nodes);
}

/**
 * Determine whether a paragraph AST node is entirely bold text
 * (treated as a heading, mirroring the previous <p><strong>...</strong></p> rule).
 */
function isBoldParagraph(node) {
  const kids = node?.children;
  if (!Array.isArray(kids) || kids.length === 0) return false;
  const textKids = kids.filter(k => (k.text || '').trim().length > 0);
  if (textKids.length === 0) return false;
  return textKids.every(k => k.formatting && k.formatting.bold);
}

/**
 * Core parse: walks the officeparser AST content nodes (heading/paragraph/table/list).
 * Groups body nodes until the next heading into the current heading node.
 */
function parseDocxAstToStructure(ast) {
  const blocks = [];
  let current = null;

  for (const node of (ast?.content || [])) {
    if (node.type === 'heading') {
      const headingText = (node.text || '').trim();
      if (headingText.length === 0) continue;
      const level = Number(node.metadata?.level) || 1;

      // Start new block
      current = {
        heading: headingText,
        headingType: `h${level}`,
        level: level - 1, // h1 -> 0
        paragraphs: []
      };
      blocks.push(current);

    } else if (node.type === 'paragraph' && isBoldParagraph(node)) {
      // Entirely-bold paragraph treated as a heading
      const headingText = (node.text || '').trim();
      if (headingText.length === 0) continue;
      current = {
        heading: headingText,
        headingType: 'strong',
        level: 0,
        paragraphs: []
      };
      blocks.push(current);

    } else if (current) {
      // paragraph / list / table / other -> body text under the current heading
      const text = (node.text || '').trim();
      if (text.length > 0) {
        current.paragraphs.push(text);
      }
    }
  }

  // Fallback: If no headings found, collect all content as a single block.
  if (blocks.length === 0) {
    let allBlocks = (ast?.content || [])
      .map(n => (n.text || '').trim())
      .filter(t => t.length > 0);

    if (allBlocks.length === 0) {
      const flat = (ast?.toText?.() || '').trim();
      if (flat.length > 0) {
        allBlocks = flat.split(/\n\n+/).map(b => b.trim()).filter(b => b.length > 0);
      }
    }

    if (allBlocks.length > 0) {
      blocks.push({
        heading: 'Document Content',
        headingType: 'h1',
        level: 0,
        paragraphs: allBlocks
      });
    }
  }

  return finalizeDocxNodes(blocks);
}

/**
 * Download DOCX blob to temp file and parse to an officeparser AST
 */
async function downloadAndParseDocx(blobName) {
  const startTime = Date.now();

  const containerClient = getContainerClient();
  const blobClient = containerClient.getBlobClient(blobName);

  const downloadResponse = await blobClient.download();

  const tempFilePath = path.join(os.tmpdir(), `${Date.now()}-${path.basename(blobName)}`);

  const downloadStartTime = Date.now();
  await new Promise((resolve, reject) => {
    const writable = fs.createWriteStream(tempFilePath);
    downloadResponse.readableStreamBody.pipe(writable);
    writable.on('finish', resolve);
    writable.on('error', reject);
  });

  const downloadTime = Date.now() - downloadStartTime;
  const fileStats = fs.statSync(tempFilePath);

  let ast = null;
  try {
    const buffer = fs.readFileSync(tempFilePath);
    ast = await parseOffice(buffer);
  } finally {
    try {
      fs.unlinkSync(tempFilePath);
    } catch {
      console.warn(`⚠️  [downloadAndParseDocx] Failed to clean up temp file: ${tempFilePath}`);
    }
  }

  const totalTime = Date.now() - startTime;

  return ast;
}

/**
 * Public: Extract DOCX structure (no heuristics needed)
 * @param {string} blobName
 * @returns {Promise<{ structure: object[] }>}
 */
export async function extractDocxStructure(blobName) {
  const startTime = Date.now();

  try {
    const ast = await downloadAndParseDocx(blobName);

    const structure = parseDocxAstToStructure(ast);

    const totalTime = Date.now() - startTime;

    return { structure };
  } catch (err) {
    const errorTime = Date.now() - startTime;
    console.error(`❌ [extractDocxStructure] Failed after ${errorTime}ms:`, err.message);
    console.error(`   Stack: ${err.stack}`);
    throw err;
  }
}

/**
 * Public: Parity function with PDF variant (heuristics ignored for DOCX)
 * @param {string} blobName
 * @param {object} heuristics (unused)
 * @returns {Promise<{ structure: object[] }>}
 */
export async function extractDocxStructureWithHeuristics(blobName, heuristics = null) {
  console.log(`🚀 [extractDocxStructureWithHeuristics] Starting with heuristics compatibility layer for: ${blobName}`);
  if (heuristics) {
    console.log(`ℹ️  [extractDocxStructureWithHeuristics] Heuristics provided but ignored for DOCX processing`);
  }

  // heuristics kept for signature compatibility; ignored for DOCX
  const result = await extractDocxStructure(blobName);
  console.log(`✅ [extractDocxStructureWithHeuristics] Delegated to extractDocxStructure successfully`);

  return result;
}