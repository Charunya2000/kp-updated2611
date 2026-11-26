const express = require('express');
const { BlobServiceClient } = require('@azure/storage-blob');
const { AzureOpenAI } = require('@azure/openai');
const PDFParser = require('pdf2json');
const app = express();
const port = process.env.PORT || 3000;

// Azure setups
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_DEPLOYMENT = 'gpt-4o-deployment';
const containerName = 'pdfs';

const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(containerName);
const openaiClient = new AzureOpenAI({
  endpoint: AZURE_OPENAI_ENDPOINT,
  apiKey: AZURE_OPENAI_API_KEY,
  apiVersion: '2024-10-21'
});

app.get('/extract-structure/:blobName', async (req, res) => {
  try {
    const blobName = req.params.blobName;
    const blobClient = containerClient.getBlobClient(blobName);
    const downloadResponse = await blobClient.download();
    const pdfStream = downloadResponse.readableStreamBody;

    if (!pdfStream) {
      return res.status(404).json({ error: 'Blob not found' });
    }

    // Step 1: Extract 5–10 pages with pdf2json
    const parser = new PDFParser();
    let rawData = [];
    parser.on('pdfParser_dataReady', pdfData => {
      rawData = pdfData.Pages.slice(0, 10).flatMap((page, pageIndex) => // Limit to 10 pages
        page.Texts.map(text => ({
          content: decodeURIComponent(text.R[0].T),
          fontSize: text.R[0].S?.size || 10,
          yPos: text.y,
          page: pageIndex + 1
        }))
      );
    });
    parser.on('pdfParser_dataError', err => {
      throw new Error(`Parsing error: ${err.message}`);
    });
    pdfStream.pipe(parser);
    await new Promise(resolve => parser.once('pdfParser_dataReady', resolve));

    // Step 2: Infer heuristics with GPT-4o
    const prompt = `
Analyze this PDF data (text, positions, fonts) from 5–10 pages to infer heuristics for identifying titles, chapters, sections, and subsections. Output JSON rules with fields like font_size_min, y_position_max, regex, bold, etc. Example:
{
  "title": {"font_size_min": 16, "y_position_max": 100, "bold": true},
  "chapter": {"regex": "^Chapter\\\\s+\\\\d+", "font_size_min": 14},
  "section": {"regex": "^\\\\d+\\\\.\\\\s", "font_size_min": 12},
  "subsection": {"regex": "^\\\\d+\\\\.\\\\d+\\\\.\\\\s", "font_size_min": 10}
}
Data: ${JSON.stringify(rawData.slice(0, 1000))} // Limit for token efficiency
`;
    const completion = await openaiClient.getChatCompletions(AZURE_OPENAI_DEPLOYMENT, [
      { role: 'system', content: 'You are a PDF structure expert. Respond with JSON heuristics.' },
      { role: 'user', content: prompt }
    ], {
      maxTokens: 500,
      response_format: { type: 'json_object' }
    });
    const heuristics = JSON.parse(completion.choices[0].message.content);

    // Step 3: Apply heuristics to extract structure
    const structure = rawData.map(item => {
      if (heuristics.title && item.fontSize >= heuristics.title.font_size_min && item.yPos <= heuristics.title.y_position_max) {
        return { type: 'Title', text: item.content, page: item.page };
      } else if (heuristics.chapter && item.content.match(new RegExp(heuristics.chapter.regex, 'i'))) {
        return { type: 'Chapter', text: item.content, page: item.page };
      } else if (heuristics.section && item.content.match(new RegExp(heuristics.section.regex))) {
        return { type: 'Section', text: item.content, page: item.page };
      } else if (heuristics.subsection && item.content.match(new RegExp(heuristics.subsection.regex))) {
        return { type: 'Subsection', text: item.content, page: item.page };
      }
      return null;
    }).filter(Boolean);

    res.json({ heuristics, structure });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Processing failed' });
  }
});

