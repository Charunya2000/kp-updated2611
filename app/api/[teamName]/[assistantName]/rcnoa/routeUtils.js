import { NextResponse } from 'next/server';
import { assertRcnoaScope } from '@/app/services/rcnoa/rcnoaCore';

export async function rcnoaParams(params) {
  const resolved = await params;
  assertRcnoaScope(resolved.teamName, resolved.assistantName);
  return resolved;
}

export function rcnoaErrorResponse(error, fallback = 'RCNOA request failed') {
  const message = String(error?.message || fallback);
  let status = 500;
  if (error?.code === 'RCNOA_SCOPE_NOT_FOUND' || message.includes('not found')) status = 404;
  else if (message.includes('owned by another user')) status = 403;
  else if (/required|invalid|must|cannot be started|current state/i.test(message)) status = 400;
  else if (/configuration|contract|mapping/i.test(message)) status = 409;
  return NextResponse.json({ success: false, error: message }, { status });
}