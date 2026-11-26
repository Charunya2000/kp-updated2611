import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { marked } from 'marked';

const defaultInput = path.join('docs', 'rcnoa', 'RCNO-RCNA-834-Detailed-Design.md');
const defaultOutput = path.join('docs', 'rcnoa', 'RCNO-RCNA-834-Detailed-Design.docx');

const inputPath = process.argv[2] || defaultInput;
const outputPath = process.argv[3] || defaultOutput;
const templatePath = process.argv[4] || outputPath;

const WORD_NAMESPACE = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function run(text, options = {}) {
  const properties = [
    options.bold ? '<w:b/>' : '',
    options.italic ? '<w:i/>' : '',
    options.strike ? '<w:strike/>' : '',
    options.code ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:shd w:fill="F3F6FB"/>' : '',
    options.color ? `<w:color w:val="${options.color}"/>` : '',
    options.size ? `<w:sz w:val="${options.size}"/>` : '',
  ].join('');
  const preserve = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : '';
  return `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ''}<w:t${preserve}>${escapeXml(text)}</w:t></w:r>`;
}

function inlineRuns(tokens = [], inherited = {}) {
  return tokens.map((token) => {
    switch (token.type) {
      case 'text':
        return token.tokens ? inlineRuns(token.tokens, inherited) : run(token.text, inherited);
      case 'strong':
        return inlineRuns(token.tokens, { ...inherited, bold: true });
      case 'em':
        return inlineRuns(token.tokens, { ...inherited, italic: true });
      case 'del':
        return inlineRuns(token.tokens, { ...inherited, strike: true });
      case 'codespan':
        return run(token.text, { ...inherited, code: true });
      case 'link':
        return inlineRuns(token.tokens, { ...inherited, color: '0F5EA8' });
      case 'br':
        return '<w:r><w:br/></w:r>';
      case 'escape':
        return run(token.text, inherited);
      default:
        return token.raw ? run(token.raw, inherited) : '';
    }
  }).join('');
}

function paragraph(content, options = {}) {
  const properties = [
    options.style ? `<w:pStyle w:val="${options.style}"/>` : '',
    options.keepNext ? '<w:keepNext/>' : '',
    options.pageBreakBefore ? '<w:pageBreakBefore/>' : '',
    options.indent ? `<w:ind w:left="${options.indent}" w:hanging="${options.hanging || 0}"/>` : '',
    options.spacing ? `<w:spacing w:before="${options.spacing.before || 0}" w:after="${options.spacing.after || 0}"/>` : '',
    options.border ? '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="D9DFEB"/></w:pBdr>' : '',
  ].join('');
  return `<w:p>${properties ? `<w:pPr>${properties}</w:pPr>` : ''}${content || run('')}</w:p>`;
}

function tableCell(cell, header, width) {
  const fill = header ? '<w:shd w:fill="F7F9FC"/>' : '';
  const content = inlineRuns(cell.tokens || [{ type: 'text', text: cell.text || '' }], header ? { bold: true } : {});
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${fill}<w:vAlign w:val="top"/></w:tcPr>${paragraph(content, { spacing: { after: 40 } })}</w:tc>`;
}

function renderTable(token) {
  const columnCount = Math.max(token.header.length, 1);
  const cellWidth = Math.floor(9360 / columnCount);
  const borders = '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9DFEB"/><w:left w:val="single" w:sz="4" w:color="D9DFEB"/><w:bottom w:val="single" w:sz="4" w:color="D9DFEB"/><w:right w:val="single" w:sz="4" w:color="D9DFEB"/><w:insideH w:val="single" w:sz="4" w:color="D9DFEB"/><w:insideV w:val="single" w:sz="4" w:color="D9DFEB"/></w:tblBorders>';
  const row = (cells, header = false) => `<w:tr>${cells.map((cell) => tableCell(cell, header, cellWidth)).join('')}</w:tr>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblLayout w:type="autofit"/>${borders}</w:tblPr>${row(token.header, true)}${token.rows.map((cells) => row(cells)).join('')}</w:tbl>`;
}

function renderList(token, depth = 0) {
  let number = token.start || 1;
  return token.items.map((item) => {
    const marker = token.ordered ? `${number++}.` : '•';
    const primaryTokens = item.tokens?.[0]?.tokens || item.tokens || [];
    const primary = paragraph(
      `${run(`${marker} `, { bold: token.ordered })}${inlineRuns(primaryTokens)}`,
      { indent: 360 + (depth * 360), hanging: 260, spacing: { after: 40 } },
    );
    const nested = (item.tokens || [])
      .filter((child) => child.type === 'list')
      .map((child) => renderList(child, depth + 1))
      .join('');
    return primary + nested;
  }).join('');
}

function renderTokens(tokens) {
  return tokens.map((token) => {
    switch (token.type) {
      case 'heading':
        return paragraph(inlineRuns(token.tokens), {
          style: `Heading${Math.min(token.depth, 4)}`,
          keepNext: true,
          spacing: { before: token.depth === 1 ? 0 : 180, after: 80 },
        });
      case 'paragraph':
        return paragraph(inlineRuns(token.tokens), { spacing: { after: 120 } });
      case 'list':
        return renderList(token);
      case 'table':
        return renderTable(token);
      case 'code':
        return token.text.split('\n').map((line) => paragraph(run(line || ' ', {
          code: true,
          size: 18,
        }), { indent: 240, spacing: { after: 0 } })).join('');
      case 'blockquote':
        return paragraph(inlineRuns(token.tokens?.[0]?.tokens || []), {
          indent: 360,
          spacing: { before: 80, after: 120 },
        });
      case 'hr':
        return paragraph('', { border: true, spacing: { before: 120, after: 120 } });
      case 'space':
        return '';
      default:
        return token.tokens ? paragraph(inlineRuns(token.tokens)) : '';
    }
  }).join('');
}

function getSectionProperties(documentXml) {
  const match = documentXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
  return match?.[0] || '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>';
}

async function main() {
  const [markdown, template] = await Promise.all([
    fs.readFile(inputPath, 'utf8'),
    fs.readFile(templatePath),
  ]);
  const zip = await JSZip.loadAsync(template);
  const existingDocumentXml = await zip.file('word/document.xml').async('string');
  const tokens = marked.lexer(markdown, { gfm: true });
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${WORD_NAMESPACE}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>${renderTokens(tokens)}${getSectionProperties(existingDocumentXml)}</w:body>
</w:document>`;

  zip.file('word/document.xml', documentXml);
  const output = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
  await fs.writeFile(outputPath, output);
  console.log(`Rendered DOCX: ${outputPath}`);
}

main().catch((error) => {
  console.error('Failed to render markdown as DOCX:', error);
  process.exitCode = 1;
});