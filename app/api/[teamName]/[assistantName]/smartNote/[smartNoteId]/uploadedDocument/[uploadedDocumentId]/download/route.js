import { NextResponse } from 'next/server';
import { generateTemporaryDownloadLink } from '@/app/services/blobStorageService';
import { getUploadedDocument } from '@/app/services/uploadedDocumentService';
import { getContentType } from '@/utils/constants';
import { getServerSession } from "@/utils/getSession";
import { recordBlobDownload } from '@/app/services/statisticsService';

export async function GET(request, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, uploadedDocumentId } = await params;

    const session = await getServerSession();
    const nuid = session.nuid;

    // Record the download event in statistics
    await recordBlobDownload(nuid, null, teamName, assistantName);

    // Get document from database
    const doc = await getUploadedDocument(teamName, assistantName, smartNoteId, uploadedDocumentId);

    const { container, directory, fileName } = doc.blobStorageLocation;
    const blobPath = `${directory}/${fileName}`;

    // Generate SAS URL
    const downloadUrl = await generateTemporaryDownloadLink(container, blobPath, 60);

    // Fetch file from Azure
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch from Azure: ${response.status} ${response.statusText}`);
    }

    // Get file as ArrayBuffer
    const arrayBuffer = await response.arrayBuffer();

    // Get content type
    const contentType = response.headers.get('content-type') || getContentType(fileName);

    // ✅ Return NextResponse with ArrayBuffer and proper headers
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'GET- Document from Blob Storage',
        detail: {
          error: error?.message || 'Failed to download document'
        }
      }
    }));
    return NextResponse.json(
      { error: 'Download failed', details: error.message },
      { status: 500 }
    );
  }
}

