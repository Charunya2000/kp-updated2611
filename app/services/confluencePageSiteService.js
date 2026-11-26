'use server';

import fetch from 'node-fetch';
import { convert } from 'html-to-text';

async function extractConfluenceLinks(htmlContent) {
  const linkRegex = /<a[^>]+href="([^">]+)"[^>]*>(.*?)<\/a>/g;
  const confluenceLinks = [];
  let match;
  while ((match = linkRegex.exec(htmlContent)) !== null) {
    const url = match[1];
    if (url.includes('confluence-aes.kp.org')) {
      confluenceLinks.push(url);
    }
  }
  return confluenceLinks;
}

// Extract content from CDATA sections
function extractCDATA(htmlContent) {

  const cdataRegex = /<!\[CDATA\[([\s\S]*?)\]\]>/g;
  let match;
  let extractedContent = '';

  while ((match = cdataRegex.exec(htmlContent)) !== null) {
    extractedContent += match[1] + '\n';
  }
  return extractedContent || htmlContent;

}

async function scrapeWebsiteTextById(pageId) {
  try {
    const envName = process.env.envName;
    const token = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.confluence.api.key`];

    // Fetch the HTML content of the page using the page ID
    const pageContentResponse = await fetch(`https://confluence-aes.kp.org/rest/api/content/${pageId}?expand=body.storage`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    const pageContentData = await pageContentResponse.json();
    const htmlContent = pageContentData.body.storage.value;

    // Extract CDATA content first (for Confluence markdown macros)
    const cdataContent = extractCDATA(htmlContent);

    // Convert the HTML content to plain text
    const textContent = convert(cdataContent, {

      wordwrap: false,

      preserveNewlines: true,

      selectors: [

        { selector: 'img', format: 'skip' },

        { selector: 'script', format: 'skip' },

        { selector: 'style', format: 'skip' },

        { selector: 'a', options: { ignoreHref: true } },

        { selector: 'table', format: 'dataTable' },

        { selector: 'ul', options: { itemPrefix: ' * ' } },

        { selector: 'ol', options: { itemPrefix: ' ' } },

        { selector: 'h1', options: { uppercase: false } },

        { selector: 'h2', options: { uppercase: false } },

        { selector: 'h3', options: { uppercase: false } },

        { selector: 'code', format: 'inline' },

        { selector: 'pre', format: 'block' }

      ],

    });

    // Clean up the text content (optional)
    // Clean up the text content - remove excessive whitespace but preserve structure
    const cleanedTextContent = textContent
      .replace(/[ \t]+/g, ' ')  // Replace multiple spaces/tabs with single space
      .replace(/\n\s*\n\s*\n/g, '\n\n')  // Replace 3+ newlines with 2
      .trim();

    // Strip empty lines while preserving end-of-line characters for non-empty lines
    const strippedTextContent = cleanedTextContent
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .join('\n');

    return { strippedTextContent };
  } catch (error) {
    console.error('Error scraping website by pageId:', error);
    throw error;
  }
}

async function scrapeWebsiteText(spaceKey, title) {
  try {
    const envName = process.env.envName;
    const token = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.confluence.api.key`];

    // Fetch the page ID from the Confluence API
    const url = `https://confluence-aes.kp.org/rest/api/content?spaceKey=${spaceKey}&title=${title}`;
    const pageIdResponse = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const pageIdData = await pageIdResponse.json();
    const pageId = pageIdData.results[0].id;

    // Fetch the HTML content of the page using the page ID
    const pageContentResponse = await fetch(`https://confluence-aes.kp.org/rest/api/content/${pageId}?expand=body.storage`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const pageContentData = await pageContentResponse.json();
    const htmlContent = pageContentData.body.storage.value;

    // Convert the HTML content to plain text
    const textContent = convert(htmlContent, {
      wordwrap: 130,
      selectors: [
        { selector: 'img', format: 'skip' },
        { selector: 'a', options: { ignoreHref: true } },
      ],
    });

    // Clean up the text content (optional)
    const cleanedTextContent = textContent.replace(/\s+/g, ' ').trim();

    // Strip empty lines while preserving end-of-line characters for non-empty lines
    const strippedTextContent = cleanedTextContent.split('\n').filter(line => line.trim().length > 0).join('\n');

    return { strippedTextContent };
  } catch (error) {
    console.error('Error scraping website:', error);
    throw error;
  }
}

export { scrapeWebsiteText, scrapeWebsiteTextById, extractConfluenceLinks };