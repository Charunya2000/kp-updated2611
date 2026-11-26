
export async function getSplunkLogs(identifier) {




  // const { identifier } = await req.json();
  let oAuthtoken = '';

  let searchindexToken = '';

  const envName = process.env['envName'] || 'dev';
  const prefix = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.pubfamprefix.zq`];
  const TOKEN_URL = `${prefix}/as/token.oauth2`;
  const CLIENT_ID = process.env[`host.${envName}-aiportal-web-2.splunk.client.id`];
  const CLIENT_SECRET = process.env[`host.${envName}-aiportal-web-2.splunk.client.secret`];

  // Base64 encode the client ID and secret
  const authHeader = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const headers = {
    "Authorization": `Basic ${authHeader}`,
    "Content-Type": "application/x-www-form-urlencoded"
  };

  const payload = new URLSearchParams({
    "grant_type": "client_credentials"
  });

  console.log("\n[DEBUG] Calling OAuth token endpoint...");

  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: headers,
      body: payload
    });

    console.log("[DEBUG] OAuth Status Code:", response.status);
    const responseData = await response.json();
    console.log("[DEBUG] OAuth Response:", responseData);

    if (!response.ok) {
      throw new Error(`Failed to fetch token: ${responseData.error_description || "Unknown error"}`);
    }

    oAuthtoken = responseData.access_token;
    //console.log("[DEBUG] OAuth Token (last 20 chars):", token.slice(-20));

    // res.status(200).json({ token });
  } catch (error) {
    console.error("[ERROR] Failed to get OAuth token:", error);
    // res.status(500).json({ error: error.message });
  }


  const AuthAPI_URL = process.env[`host.${envName}-aiportal-web-2.splunk.auth.api.url`]; //"https://api-gtwy-dev.kp.org/api/itops/siae/kpsplunkcloudapi/v1r/-/-/authorization/tokens?output_mode=json";
  const ACCESS_TOKEN = process.env[`host.${envName}-aiportal-web-2.splunk.access.token`]; // Ensure this is secured via environment variables

  // Retrieve the OAuth token from the request body or headers


  const splunkAuthheaders = {
    "Authorization": `Bearer ${ACCESS_TOKEN}`,
    "ESB-OAuth": `Bearer ${oAuthtoken}`,
    "Content-Type": "application/x-www-form-urlencoded"
  };

  const authPayload = new URLSearchParams({
    "name": 'svc_nps_splunk_cloud',
    "audience": 'Splunk Rest API',
    "type": 'ephemeral'
  });

  console.log("\n[DEBUG] Calling Splunk Auth API...");

  try {
    const response = await fetch(AuthAPI_URL, {
      method: 'POST',
      headers: splunkAuthheaders,

      body: authPayload.toString()
    });

    console.log("[DEBUG] Status Code:", response.status);
    console.log("[DEBUG] Status Code:", response);
    const responseData = await response.json();
    console.log("[DEBUG] Response:", responseData);

    if (!response.ok) {
      throw new Error(`Failed to fetch Splunk token: ${responseData.message || "Unknown error"}`);
    }

    // Access the token from the response
    searchindexToken = responseData.entry[0].content.token;
    console.log("[DEBUG] Status Code:", searchindexToken);
    // res.status(200).json({ token });
  } catch (error) {
    console.error("[ERROR] Failed to get Splunk token:", error);
    //   res.status(500).json({ error: error.message });
  }
  //earliest
  //const searchAPI_URL = `https://api-gtwy-dev.kp.org/api/itops/siae/kpsplunkcloudapi/v1r/-/-/search/jobs/export`;
  const searchAPI_URL = process.env[`host.${envName}-aiportal-web-2.splunk.search.api.url`];

  // Retrieve the OAuth token from the request body or headers


  const searchAuthheaders = {
    "Authorization": `Bearer ${searchindexToken}`,
    "ESB-OAuth": `Bearer ${oAuthtoken}`,
    "Content-Type": "application/x-www-form-urlencoded"
  };

  const searchPayload = new URLSearchParams({
    "output_mode": 'json',
    "search": `${identifier} `
    //`search index="kube_kp-hpbio-aks-nps2_phi_idx" ${identifier} "success=false" earliest=-25d latest=now | fields _raw _time source sourcetype | sample 20 | head 500`,

  });

  console.log("\n[DEBUG] Calling Splunk Search API...");

  try {
    const response = await fetch(searchAPI_URL, {
      method: 'POST',
      headers: searchAuthheaders,

      body: searchPayload.toString()
    });

    const contentType = response.headers.get('content-type');

    // Debugging: Log the raw response
    const rawResponse = await response.text();
    //     const searchResponse = rawResponse
    //     .split("\n")
    //   .filter(Boolean)
    //   .map(line => JSON.parse(line))
    //   .filter(e => e.result && e.result._raw)
    //   .map(e => {
    //     const raw = JSON.parse(e.result._raw);
    //     return raw?.log_details?.msg;
    //   })
    //   .filter(Boolean);

    const searchResponse = rawResponse
      .split("\n")
      .filter(Boolean)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(e => {
        try {
          return e?.result?._raw && JSON.parse(e.result._raw)?.log_details?.msg;
        } catch {
          return false;
        }
      })
      .map(e => {
        const raw = JSON.parse(e.result._raw);
        return {
          source: e.result.source,
          sourcetype: e.result.sourcetype,
          time: e.result._time,
          message: raw.log_details.msg
        };
      });
    console.log("[DEBUG] Raw Response:", searchResponse);

    console.log("[DEBUG] Status Code:", response.status);

    if (!response.ok) {
      throw new Error(`Failed to fetch Splunk token: ${response.message || "Unknown error"}`);
    }

    // Access the token from the response

    return Response.json({ success: true, results: searchResponse });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }


}