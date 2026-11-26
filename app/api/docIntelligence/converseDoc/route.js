'use server';

import { NextResponse } from 'next/server';
// import { prepareSharePointPdfsForConversation, findGeisingerConversationsByInferredLobAndStatus } from '@/app/services/langgraphs/compliance/docConveresationService2.js';
import { findGeisingerConversationsByInferredLobAndStatus } from '@/app/services/langgraphs/compliance/docConversationService3.js';

function logConverseDocEvent(name, detail = {}) {
  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name,
      detail,
    }
  }));
}

export async function POST(req) {
  void req;
  return NextResponse.json(
    { error: 'Direct conversation preparation is disabled. Use admin Geisinger preparation workflow.' },
    { status: 403 }
  );
}

export async function GET(req) {
  try {
    // Extract inferredLob from query params if provided
    const { searchParams } = new URL(req.url);
    const inferredLob = searchParams.get('inferredLob');
    const status = searchParams.get('status');
    const teamName = searchParams.get('teamName');

    logConverseDocEvent('converseDocGetRequest', {
      inferredLob: inferredLob || null,
      status: status || null,
      teamName: teamName || null,
    });

    if (!inferredLob || !status) {
      return NextResponse.json({ error: 'Missing required query parameters: inferredLob and status' }, { status: 400 });
    }
    const result = await findGeisingerConversationsByInferredLobAndStatus(inferredLob, status, {
      teamName,
    });

    logConverseDocEvent('converseDocGetResult', {
      inferredLob,
      status,
      teamName: teamName || null,
      totalReturned: Array.isArray(result) ? result.length : 0,
      returnedDocuments: Array.isArray(result)
        ? result.slice(0, 20).map((doc) => ({
          id: doc?.id,
          fileAName: doc?.fileAName,
          relativeAUrl: doc?.relativeAUrl,
          lob: doc?.lob,
          status: doc?.status,
          preparationVersion: doc?.preparationVersion,
          preparedAt: doc?.preparedAt,
        }))
        : [],
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'converseDocGetError',
        detail: {
          error: error?.message,
        },
      }
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
