import { ConfidentialClientApplication } from '@azure/msal-node';
import jwt from 'jsonwebtoken';

const tokenCache = {
  graph: null,
  sharePoint: null
};

function getScopeConfig() {
  const useVault = process.env.USE_VAULT === 'true';
  return {
    useVault,
    scope: useVault ? 'https://graph.microsoft.com/.default' : 'https://sp-cloud.kp.org/.default',
    cacheKey: useVault ? 'graph' : 'sharePoint'
  };
}

async function getAccessToken(msalClient, usedScope) {
  const request = {
    scopes: [usedScope]
  };

  try {
    const tokenResponse = await msalClient.acquireTokenByClientCredential(request);
    if (!tokenResponse?.accessToken) {
      throw new Error(`No access token returned for scope ${usedScope}`);
    }
    return tokenResponse.accessToken;
  } catch (error) {
    console.error('Error acquiring token:', error);
    throw error;
  }
}

function isTokenExpired(token) {
  try {
    const decodedToken = jwt.decode(token);
    if (!decodedToken || !decodedToken.exp) {
      throw new Error('Invalid token');
    }
    const currentTime = Math.floor(Date.now() / 1000);
    return decodedToken.exp < currentTime;
  } catch (error) {
    console.error('Error decoding token:', error);
    return true;
  }
}

export async function validateAndAcquireToken() {
  let msalConfig;
  const { useVault, scope, cacheKey } = getScopeConfig();
  const envName = process.env.envName;
  const clientId = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.sharepoint.clientid`];
  const tenantId = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.sharepoint.tenantId`];

  if (!envName || !clientId || !tenantId) {
    throw new Error('Missing required SharePoint/MS Graph token environment configuration');
  }

  if (useVault) {
    const authority = `https://login.microsoftonline.com/${tenantId}`;
    const clientSecret = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.sharepoint.clientsecret`];
    if (!clientSecret) {
      throw new Error('Missing client secret for USE_VAULT=true token acquisition');
    }

    msalConfig = {
      auth: {
        clientId,
        authority,
        clientSecret
      }
    };
  } else {
    const certificate = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.sharepoint.cert`];
    const privateKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.sharepoint.privatekey`];
    const thumbprint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.sharepoint.thumbprint`];

    if (!certificate || !privateKey || !thumbprint) {
      throw new Error('Missing certificate auth configuration for USE_VAULT=false token acquisition');
    }

    const authority = `https://login.microsoftonline.com/${tenantId}`;

    msalConfig = {
      auth: {
        clientId,
        authority,
        clientCertificate: {
          thumbprint,
          x509Cert: certificate,
          privateKey
        }
      }
    };
  }


  if (!tokenCache[cacheKey] || isTokenExpired(tokenCache[cacheKey])) {
    const msalClient = new ConfidentialClientApplication(msalConfig);
    tokenCache[cacheKey] = await getAccessToken(msalClient, scope);
  }

  return tokenCache[cacheKey];
}
