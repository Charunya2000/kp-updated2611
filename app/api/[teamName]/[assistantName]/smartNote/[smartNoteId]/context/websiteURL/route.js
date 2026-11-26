'use server';

import { NextResponse } from 'next/server';
import { processScrapedData as processWebURLScrapedData } from '@services/processScrapedData';
import { createWebsiteURL, updateWebsiteURL } from '@services/websiteURLService';
import { processScrapedData as processConfluenceURLScrapedData } from '@services/processConfluenceSite';
import { processQTestData } from '@services/processQTestData';

let clients = [];

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;

    const document = await req.json();
    if (!document.type || document.type !== 'WebsiteURL') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    createWebsiteURL(document, teamName, assistantName);
    const variant = document.variant;
    const { url, nuid, content } = document;
    if ('WebURL' === variant) {
      processWebURLScrapedData({ url, nuid, smartNoteId })
        .then((_) => {
          const indexedDocument = { ...document, status: 'INDEXED' };
          updateWebsiteURL(indexedDocument, teamName)
            .then(_ => {
              // Notify all connected clients
              clients.forEach(client => client.res.write(`data: ${JSON.stringify({ action: 'websiteURL', id: indexedDocument.id })}\n\n`));
            });
        });
    } else if ('ConfluenceURL' === variant) {
      processConfluenceURLScrapedData({ url, nuid, smartNoteId })
        .then((_) => {
          const indexedDocument = { ...document, status: 'INDEXED' };
          updateWebsiteURL(indexedDocument, teamName)
            .then(_ => {
              // Notify all connected clients
              clients.forEach(client => client.res.write(`data: ${JSON.stringify({ action: 'websiteURL', id: indexedDocument.id })}\n\n`));
            });
        });
    } else if ('QTestURL' === variant) {
      processQTestData({ content, nuid, smartNoteId })
        .then((_) => {
          const indexedDocument = { ...document, status: 'INDEXED' };
          updateWebsiteURL(indexedDocument, teamName)
            .then(_ => {
              // Notify all connected clients
              clients.forEach(client => client.res.write(`data: ${JSON.stringify({ action: 'websiteURL', id: indexedDocument.id })}\n\n`));
            });
        })
        .catch(error => {
          const errorDocument = { ...document, status: 'ERROR' };
          updateWebsiteURL(errorDocument, teamName);
        });
    }

    const response = { result: 'added' };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  writer.write(new TextEncoder().encode('data: Connected\n\n'));
  writer.releaseLock();

  const clientId = Date.now();
  const newClient = {
    id: clientId,
    writer
  };
  clients.push(newClient);

  req.signal.addEventListener('abort', () => {
    clients = clients.filter(client => client.id !== clientId);
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
