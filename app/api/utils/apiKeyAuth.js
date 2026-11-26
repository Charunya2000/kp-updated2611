/**
 * API Key Authentication Utility
 * Provides functions to validate API keys for route protection
 * Supports both 'x-api-key' header and 'Bearer' token formats
 */

export function validateApiKey(request, validKey) {
  console.log('Validating API key');

  if (!validKey) {
    console.log('Validating API key: no valid key provided');
    return false;
  }

  // Check for x-api-key header
  const apiKey = request.headers.get('x-api-key');
  if (apiKey) {
    console.log('Validating API key: x-api-key header found');
    return apiKey === validKey;
  }

  // Check for Bearer token in Authorization header (fallback)
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log('Validating API key: Bearer token found');
    return token === validKey;
  }

  console.log('Validating API key: no valid key found');
  return false;
}

export function createUnauthorizedResponse() {
  return new Response(
    JSON.stringify({ error: 'Unauthorized - Invalid or missing API key or Bearer token' }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
