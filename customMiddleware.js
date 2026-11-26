import { NextResponse } from 'next/server';

export function withBodySizeLimit(handler, sizeLimit = '50mb') {
  return async (req, res) => {
    if (req.method === 'POST') {
      const contentLength = req.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > parseSizeLimit(sizeLimit)) {
        return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
      }
    }
    return handler(req, res);
  };
}

function parseSizeLimit(sizeLimit) {
  const units = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
  const match = sizeLimit.toLowerCase().match(/^(\d+)(b|kb|mb|gb)$/);
  if (!match) throw new Error('Invalid size limit format');
  return parseInt(match[1], 10) * units[match[2]];
}