'use server';

import fetch from 'node-fetch';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const searchParams = new URLSearchParams(url.search);
    const imageUrl = searchParams.get('imageUrl');

    if (!imageUrl) {
      return new Response('Missing imageUrl parameter', { status: 400 });
    }

    const envName = process.env.envName;
    const token = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.confluence.api.key`];

    // Fetch the image data from the Confluence API
    const response = await fetch(imageUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return new Response('Failed to fetch image from Confluence', { status: response.status });
    }

    const imageBuffer = await response.arrayBuffer();

    // Return the image data as a response
    return new Response(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/png',
        'Cache-Control': 'public, max-age=3600', // Cache the image for 1 hour
      },
    });
  } catch (error) {
    console.error('Error proxying image:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}