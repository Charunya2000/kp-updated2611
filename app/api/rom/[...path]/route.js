import { NextResponse } from 'next/server';

const DEPLOY_ENV = (
  process.env.DEPLOY_ENV ||
  process.env.NEXT_PUBLIC_ENV ||
  process.env.APP_ENV ||
  'dev'
).toLowerCase();

const ROM_BACKEND_TEMPLATE =
  process.env.ROM_BACKEND_TEMPLATE ||
  process.env.ORCHESTRATION_APP_URL || '';

const ROM_LOCAL_URL = (process.env.ROM_API_LOCAL_URL || 'http://0.0.0.0:8080').replace(/\/$/, '');
const ROM_USE_LOCAL = process.env.ROM_API_USE_LOCAL === 'true';

const DEPLOYED_ROM_BACKEND_BASE_URL = (
  process.env.ROM_API_BASE_URL ||
  ROM_BACKEND_TEMPLATE
).replace(/\/$/, '');

const isLocalUiRequest = (request) => {
  const host = (
    request?.headers.get('x-forwarded-host') ||
    request?.headers.get('host') ||
    ''
  ).toLowerCase();

  return (
    host.includes('localhost') ||
    host.includes('127.0.0.1') ||
    host.includes('0.0.0.0')
  );
};

const resolveRomBackendBaseUrl = (request) => {
  const useLocalBackend = ROM_USE_LOCAL && isLocalUiRequest(request);
  return (useLocalBackend ? ROM_LOCAL_URL : DEPLOYED_ROM_BACKEND_BASE_URL).replace(/\/$/, '');
};

const buildRomApiUrl = (request, path, queryParams = '') => {
  return `${resolveRomBackendBaseUrl(request)}/api/rom/${path}${queryParams}`;
};

// API route handler for ROM API proxy
export async function GET(request, { params }) {
  let { path } = await params;
  path = path.join('/');
  const url = new URL(request.url);
  const queryParams = url.search;

  try {
    const apiUrl = buildRomApiUrl(request, path, queryParams);
    // console.log(`Proxying GET request to: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('API proxy error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to proxy request' },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  let { path } = await params;
  path = path.join('/');

  try {
    const apiUrl = buildRomApiUrl(request, path);
    // console.log(`🔄 Proxying POST request to: ${apiUrl}`);

    // Check if the request is multipart/form-data
    const contentType = request.headers.get('content-type') || '';
    let requestBody;

    if (contentType.includes('multipart/form-data')) {
      // Handle form data
      requestBody = await request.formData();
      // console.log('📎 Form data request detected');
    } else {
      // Handle JSON data
      try {
        const json = await request.json();
        requestBody = JSON.stringify(json);
        // console.log('JSON request data:', json);
      } catch (e) {
        // If no JSON body, send empty body
        requestBody = null;
        // console.log('Empty request body');
      }
    }

    const options = {
      method: 'POST',
      headers: {},
      body: requestBody,
    };

    // Don't set content-type for FormData - the browser will set it correctly with boundary
    if (!contentType.includes('multipart/form-data') && requestBody) {
      options.headers['Content-Type'] = 'application/json';
    }

    // console.log('Making request to backend...');
    const response = await fetch(apiUrl, options);

    // console.log(`Backend response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      // console.error(`Backend error (${response.status}):`, errorText);

      // Try to parse as JSON, fallback to text
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || 'Unknown backend error' };
      }

      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    // console.log('Backend response data:', data);

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('API proxy error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to proxy request',
        details: error.stack
      },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  let { path } = await params;
  path = path.join('/');

  try {
    const apiUrl = buildRomApiUrl(request, path);
    // console.log(`🔄 Proxying PUT request to: ${apiUrl}`);

    // Handle JSON data
    let requestBody;
    try {
      const json = await request.json();
      requestBody = JSON.stringify(json);
      // console.log('PUT request data:', json);
    } catch (e) {
      requestBody = null;
    }

    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });

    // console.log(`Backend PUT response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      // console.error(`Backend PUT error (${response.status}):`, errorText);

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || 'Unknown backend error' };
      }

      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    // console.log('Backend PUT response data:', data);

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('API PUT proxy error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to proxy PUT request',
        details: error.stack
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  let { path } = await params;
  path = path.join('/');

  try {
    const apiUrl = buildRomApiUrl(request, path);
    // console.log(`🗑️ Proxying DELETE request to: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // console.log(`📥 Backend DELETE response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      // console.error(`Backend DELETE error (${response.status}):`, errorText);

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || 'Unknown backend error' };
      }

      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    // console.log('Backend DELETE response data:', data);

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('API DELETE proxy error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to proxy DELETE request',
        details: error.stack
      },
      { status: 500 }
    );
  }
}