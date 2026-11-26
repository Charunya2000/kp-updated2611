import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        // Parse FormData instead of JSON
        const formData = await request.formData();
        const file = formData.get('file');
        const sasUrl = formData.get('sasUrl');

        if (!sasUrl) {
            return NextResponse.json(
                { error: 'SAS URL is required' },
                { status: 400 }
            );
        }

        if (!file) {
            return NextResponse.json(
                { error: 'File is required' },
                { status: 400 }
            );
        }

        console.log('Uploading file to SAS URL:', sasUrl);
        console.log('File size:', file.size);

        // Convert File to Buffer
        const fileBuffer = await file.arrayBuffer();

        // Upload to Azure Blob Storage using the SAS URL
        const uploadResp = await fetch(sasUrl, {
            method: 'PUT',
            headers: {
                'x-ms-blob-type': 'BlockBlob',
                'Content-Length': String(fileBuffer.byteLength),
            },
            body: fileBuffer,
        });

        console.log('Azure upload response status:', uploadResp.status);

        if (!uploadResp.ok && uploadResp.status !== 201) {
            const text = await uploadResp.text();
            console.error('Azure upload error:', text);
            return NextResponse.json(
                { error: `Upload to Azure failed: ${uploadResp.status}`, details: text },
                { status: uploadResp.status }
            );
        }

        return NextResponse.json({ success: true, status: uploadResp.status });
    } catch (error) {
        console.error('Error in upload route:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        return NextResponse.json(
            { error: 'Failed to upload file', details: error.message },
            { status: 500 }
        );
    }
}

export async function OPTIONS(request) {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
