'use server';

import { selectGeisingerConfigContextDocuments } from '@/app/services/geisingerConfigService.js';
import { withTeamPermissionGuard } from "@/app/api/guards";
import { PERMISSIONS } from '@/app/config/permissions';
import { writeFileBufferToBlobStorage, generateTemporaryDownloadLink } from '@/app/services/blobStorageService';
import { NextResponse } from 'next/server';

export const GET = withTeamPermissionGuard(PERMISSIONS.REGULATORY_CONFIG_MANAGE)(getHandler);

// GET /api/admin/geisingerConfig/export?filename=optionalName.json&collectionName=Foo&purpose=Background
// Fetches matching GeisingerConfig documents, uploads JSON file to blob storage, returns metadata + SAS download URL.
async function getHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const paramsObj = {};
    for (const [key, value] of searchParams.entries()) {
      if (key !== 'filename') {
        paramsObj[key] = value;
      }
    }

    // Always enforce type filter for safety if not provided
    if (!paramsObj.type) {
      paramsObj.type = 'GeisingerConfig';
    }

    const filenameRaw = searchParams.get('filename') || 'geisinger-config-export.json';
    const safeFilename = sanitizeFilename(filenameRaw);

    const { data } = await selectGeisingerConfigContextDocuments(paramsObj);

    // Remove top-level id and _id properties from each document for portability
    const sanitizedItems = Array.isArray(data)
      ? data.map(doc => {
        if (!doc || typeof doc !== 'object') return doc;
        // Destructure to drop id and _id
        // If _id is an object (e.g., Mongo ObjectId), excluding it suffices.
        const { id, _id, ...rest } = doc;
        return rest;
      })
      : [];

    // Serialize to JSON and upload to blob storage
    const jsonString = JSON.stringify({
      exportedAt: new Date().toISOString(),
      filter: paramsObj,
      count: sanitizedItems.length,
      items: sanitizedItems
    }, null, 2);

    const fileBuffer = Buffer.from(jsonString, 'utf-8');
    const containerName = 'geisinger-config-exports';
    // Use a timestamped filename inside blob storage to avoid collisions even if user reuses same filename param.
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const blobName = `${safeFilename.replace(/\.json$/i, '')}-${timestamp}.json`;

    const uploaded = await writeFileBufferToBlobStorage(fileBuffer, containerName, blobName, 'application/json; charset=utf-8');
    if (!uploaded) {
      throw new Error('Failed to upload export file to blob storage.');
    }

    // Generate SAS link valid for 15 minutes by default
    const sasUrl = await generateTemporaryDownloadLink(containerName, blobName, 15);

    const responsePayload = {
      success: true,
      blobContainer: containerName,
      blobName,
      originalRequestedFilename: safeFilename,
      count: sanitizedItems.length,
      filter: paramsObj,
      downloadUrl: sasUrl
    };

    return NextResponse.json(responsePayload, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('Error exporting GeisingerConfig documents:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function sanitizeFilename(name) {
  try {
    // Remove path separators and trim whitespace
    let cleaned = name.replace(/[\\/]/g, '_').trim();
    if (!cleaned.toLowerCase().endsWith('.json')) {
      cleaned += '.json';
    }
    // Basic allowlist: letters, numbers, dash, underscore, dot
    cleaned = cleaned.replace(/[^A-Za-z0-9._-]/g, '_');
    if (cleaned.length === 0) {
      return 'geisinger-config-export.json';
    }
    return cleaned;
  } catch {
    return 'geisinger-config-export.json';
  }
}

