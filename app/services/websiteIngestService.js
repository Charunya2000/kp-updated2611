'use server';

import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { convert } from 'html-to-text';

async function scrapeWebsiteText(url) {
  try {
    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar }));

    let response = await client.get(url, {
      maxRedirects: 5, // Limit redirects to a maximum of 5
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        // Add other necessary headers here, such as authentication headers
        // 'Authorization': 'Bearer YOUR_ACCESS_TOKEN',
      }
    });

    const data = response.data;

    // Convert the HTML content to plain text
    const textContent = convert(data, {
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

    return strippedTextContent;
  } catch (error) {
    console.error('Error scraping website:', error);
    throw error;
  }
}

export { scrapeWebsiteText };