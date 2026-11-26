let accessToken = null;
let accessTokenExpiration = 0;

let snowAccessToken = null;
let snowAccessTokenExpiration = 0;
let snowServiceToken = null;
let snowServiceTokenExpiration = 0;

/**
 * Generates a Bearer token using Client Credentials flow.
 * @returns The Bearer token for the application Client (7232)
 */
export async function getClientCredentialsAuthToken() {
  if (accessToken && accessTokenExpiration > Date.now() + 60000) { // Refresh 1 minute before expiry
    return accessToken;
  }

  const envName = process.env.envName || 'dev'
  const famClientId = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.CC.famClientId`];
  const famClientSecret = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.CC.famClientSecret`];
  const pubfamprefix = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.CC.pubfamprefix`];

  const response = await fetch(`${pubfamprefix}/as/token.oauth2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      'client_id': famClientId,
      'client_secret': famClientSecret,
      'grant_type': 'client_credentials'
    })
  });

  const responseData = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to obtain auth token: ${responseData.error_description || response.statusText}`);
  }

  accessToken = responseData.access_token;
  accessTokenExpiration = Date.now() + responseData.expires_in * 1000;
  return responseData.access_token;

}

/**
 * Generates a Bearer token for the client with ServiceNow access, using Client Credentials flow.
 * @returns The Bearer token for the ServiceNow access client
 */
export async function getSNOWClientCredentialsAuthToken() {
  if (snowAccessToken && snowAccessTokenExpiration > Date.now() + 60000) { // Refresh 1 minute before expiry
    return snowAccessToken;
  }

  const envName = process.env.envName || 'dev'
  const pubfamprefix = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.CC.pubfamprefix`];
  const kp_servicenow_fam_apigee_clientId = process.env['kp.servicenow.fam.apigee.clientId'];
  const kp_servicenow_fam_apigee_secret = process.env['kp.servicenow.fam.apigee.secret'];

  const response = await fetch(`${pubfamprefix}/as/token.oauth2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      'client_id': kp_servicenow_fam_apigee_clientId,
      'client_secret': kp_servicenow_fam_apigee_secret,
      'grant_type': 'client_credentials'
    })
  });

  const responseData = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to obtain auth token: ${responseData.error_description || response.statusText}`);
  }

  snowAccessToken = responseData.access_token;
  snowAccessTokenExpiration = Date.now() + responseData.expires_in * 1000;
  return responseData.access_token;

}

/**
 * Generates a Bearer token for ServiceNow API access using Resource Owner Password Credentials flow.
 * @returns The Bearer token for ServiceNow API access
 */
export async function getSNOWClientToken() {
  if (snowServiceToken && snowServiceTokenExpiration > Date.now() + 60000) { // Refresh 1 minute before expiry
    return snowServiceToken;
  }

  const kp_servicenow_incident_apigee_username = process.env['kp.servicenow.incident.apigee.username'];
  const kp_servicenow_incident_apigee_password = process.env['kp.servicenow.incident.apigee.password'];
  const kp_servicenow_token_apigee_url = process.env['kp.servicenow.token.apigee.url'];
  const kp_servicenow_token_apigee_clientId = process.env['kp.servicenow.token.apigee.clientId'];
  const kp_servicenow_token_apigee_secret = process.env['kp.servicenow.token.apigee.secret'];
  const response = await fetch(`${kp_servicenow_token_apigee_url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Bearer ' + await getSNOWClientCredentialsAuthToken()
    },
    body: new URLSearchParams({
      'username': kp_servicenow_incident_apigee_username,
      'password': kp_servicenow_incident_apigee_password,
      grant_type: 'password',
      'client_id': kp_servicenow_token_apigee_clientId,
      'client_secret': kp_servicenow_token_apigee_secret,
    })
  });

  const responseData = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to obtain ServiceNow token: ${responseData.error_description || response.statusText}`);
  }

  snowServiceToken = responseData.access_token;
  snowServiceTokenExpiration = Date.now() + responseData.expires_in * 1000;
  return responseData.access_token;
}
