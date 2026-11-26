'use server';

import fetch from 'node-fetch';
import { convert } from 'html-to-text';
import { sendChatCompletionWithImage } from './chatCompletionService2.js';
import sharp from 'sharp';
const fs = require('fs');
const path = require('path');

async function resizeImage(buffer, width = 600) {
  return await sharp(buffer).resize({ width }).toBuffer();
}

async function scrapeWebsiteText(spaceKey, title, teamName, assistantName) {
  try {
    const envName = process.env.envName;
    const token = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.confluence.api.key`];

    // Fetch the page ID from the Confluence API
    const url = `https://confluence-aes.kp.org/rest/api/content?spaceKey=${spaceKey}&title=${title}`;
    const pageIdResponse = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    const pageIdData = await pageIdResponse.json();
    const pageId = pageIdData.results[0].id;

    // Fetch the HTML content of the page using the page ID
    const pageContentResponse = await fetch(`https://confluence-aes.kp.org/rest/api/content/${pageId}?expand=body.storage`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    const pageContentData = await pageContentResponse.json();
    const htmlContent = pageContentData.body.storage.value;

    // Fetch the attachments for the page
    const attachmentsResponse = await fetch(`https://confluence-aes.kp.org/rest/api/content/${pageId}/child/attachment`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    const attachmentsData = await attachmentsResponse.json();

    // Extract image URLs and names from the attachments
    const imageDetails = attachmentsData.results
      .filter((attachment) => attachment.metadata?.mediaType?.startsWith('image/')) // Ensure it's an image
      .map((attachment) => ({
        name: attachment.title,
        url: `https://confluence-aes.kp.org${attachment._links.download}`, // Form the full download URL
      }));

    // Fetch and process each image
    const imageBuffers = await Promise.all(
      imageDetails.map(async (image) => {
        try {
          const response = await fetch(image.url, {
            headers: {
              'Authorization': `Bearer ${token}`, // Include the token for authentication
            },
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${image.url}`);
          }

          // Return the raw image buffer
          return await response.buffer();
        } catch (error) {
          console.error(`Error fetching image ${image.name}:`, error);
          return null; // Handle errors gracefully
        }
      })
    );
    // Save each image to disk

    const saveDirectory = path.join('./images'); // Directory to save images
    if (!fs.existsSync(saveDirectory)) {
      fs.mkdirSync(saveDirectory); // Create the directory if it doesn't exist
    }

    imageBuffers.forEach((buffer, index) => {
      if (buffer) {
        const fileName = `${imageDetails[index].name}`;
        const filePath = path.join(saveDirectory, fileName);

        try {
          fs.writeFileSync(filePath, buffer); // Save the image buffer to disk
        } catch (error) {
          console.error(`Error saving image ${fileName}:`, error);
        }
      }
    });
    // Filter out any null buffers (failed fetches)
    const validImageBuffers = imageBuffers.filter((buffer) => buffer !== null);

    // Resize the image before encoding it
    const resizedBuffers = await Promise.all(
      validImageBuffers.map((buffer) => resizeImage(buffer))
    );

    // Convert resized buffers to Base64
    const dataURLs = resizedBuffers.map((buffer) => {
      const mimeType = 'image/png'; // Adjust MIME type if necessary
      const base64String = buffer.toString('base64');
      return `data:${mimeType};base64,${base64String}`;
    });
    // Send each image individually to the chat completion service
    const imageDescriptions = [];
    for (const [index, dataURL] of dataURLs.entries()) {
      try {
        const message = {
          role: 'user',
          content: dataURL, // Pass the Base64-encoded data URL
          type: 'image_url', // Ensure the type is set to 'image_url'
        };

        const response = await sendChatCompletionWithImage(message, teamName, assistantName); // Pass the message object
        const responseContent = response?.content || 'no description available';
        imageDescriptions.push(`${imageDetails[index].name} describing ${responseContent}`);
      } catch (error) {
        console.error(`Error processing image ${imageDetails[index].name}:`, error);
        imageDescriptions.push(`${imageDetails[index].name} describing no description available`);
      }
    }

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
    const strippedTextContent = cleanedTextContent.split('\n').filter((line) => line.trim().length > 0).join('\n');

    // // Append the image descriptions to the cleaned text content
    const appendedTextContent = `${strippedTextContent}\n\nImage content found in page includes ${imageDescriptions.join(
      ' and '
    )}.`;

    return appendedTextContent;
  } catch (error) {
    console.error('Error scraping website:', error);
    throw error;
  }
}

export { scrapeWebsiteText };