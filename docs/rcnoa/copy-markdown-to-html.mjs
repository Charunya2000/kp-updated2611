import fs from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';

const defaultInput = path.join('docs', 'rcnoa', 'RCNO-RCNA-834-Detailed-Design.md');
const defaultOutput = path.join('docs', 'rcnoa', 'RCNO-RCNA-834-Detailed-Design.html');

const inputPath = process.argv[2] || defaultInput;
const outputPath = process.argv[3] || defaultOutput;

marked.setOptions({
  gfm: true,
  breaks: false,
});

function buildHtmlDocument(title, bodyHtml) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root {
      --text: #1d2433;
      --muted: #5d677a;
      --line: #d9dfeb;
      --panel: #f7f9fc;
      --accent: #0f5ea8;
    }

    body {
      margin: 0;
      background: #eef2f8;
      color: var(--text);
      font-family: "Segoe UI", Calibri, "Trebuchet MS", sans-serif;
      line-height: 1.55;
    }

    .page {
      max-width: 980px;
      margin: 24px auto;
      background: #ffffff;
      border: 1px solid var(--line);
      box-shadow: 0 8px 26px rgba(20, 39, 71, 0.08);
      border-radius: 10px;
      padding: 32px 36px;
    }

    h1, h2, h3, h4 {
      color: #12233f;
      margin-top: 1.2em;
      margin-bottom: 0.45em;
      line-height: 1.25;
      page-break-after: avoid;
    }

    h1 {
      border-bottom: 2px solid var(--line);
      padding-bottom: 0.3em;
    }

    p, li {
      font-size: 14px;
    }

    a {
      color: var(--accent);
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    code {
      font-family: Consolas, "Courier New", monospace;
      background: #f3f6fb;
      border: 1px solid #e1e7f2;
      border-radius: 4px;
      padding: 0.1em 0.3em;
      font-size: 0.92em;
    }

    pre {
      background: #0f1724;
      color: #e8edf6;
      border-radius: 8px;
      padding: 12px 14px;
      overflow-x: auto;
      page-break-inside: avoid;
    }

    pre code {
      background: transparent;
      border: 0;
      color: inherit;
      padding: 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 13px;
    }

    th, td {
      border: 1px solid var(--line);
      padding: 8px 10px;
      vertical-align: top;
    }

    th {
      background: var(--panel);
      text-align: left;
    }

    blockquote {
      margin: 1em 0;
      border-left: 4px solid #c8d4e8;
      background: #f8fbff;
      color: var(--muted);
      padding: 10px 14px;
    }

    hr {
      border: 0;
      border-top: 1px solid var(--line);
      margin: 24px 0;
    }

    @media print {
      body {
        background: #ffffff;
      }

      .page {
        max-width: none;
        margin: 0;
        border: 0;
        box-shadow: none;
        border-radius: 0;
        padding: 0;
      }

      a {
        color: #000000;
        text-decoration: underline;
      }
    }
  </style>
</head>
<body>
  <main class="page">
${bodyHtml}
  </main>
</body>
</html>
`;
}

async function main() {
  const markdown = await fs.readFile(inputPath, 'utf8');
  const htmlBody = marked.parse(markdown);
  const title = path.basename(inputPath, path.extname(inputPath));
  const html = buildHtmlDocument(title, htmlBody);

  await fs.writeFile(outputPath, html, 'utf8');
  console.log(`Rendered HTML: ${outputPath}`);
}

main().catch((error) => {
  console.error('Failed to render markdown as HTML:', error);
  process.exitCode = 1;
});
