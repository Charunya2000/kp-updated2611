import { NextResponse } from 'next/server';
import {
  runRcnoaWorkerOnce,
  verifyRcnoaSchedulerToken,
} from '@/app/services/rcnoa/rcnoaOperationsService';
import { rcnoaErrorResponse, rcnoaParams } from '../../routeUtils';

export async function POST(req, { params }) {
  try {
    await rcnoaParams(params);
    if (!verifyRcnoaSchedulerToken(req.headers.get('authorization'))) {
      return NextResponse.json({ success: false, error: 'Unauthorized scheduler request' }, { status: 401 });
    }
    const result = await runRcnoaWorkerOnce();
    return NextResponse.json({ success: true, ...result }, { status: result.processedRun ? 200 : 202 });
  } catch (error) {
    return rcnoaErrorResponse(error, 'RCNOA scheduler trigger failed');
  }
}