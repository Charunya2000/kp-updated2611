import fetch from 'node-fetch';
import { validateAndAcquireToken } from './sharepointGetAccessToken.js';
import { setProcessEnvironment } from '../../scripts/configActions.js';

let accessToken = null;

async function getFilesInFolder(siteUrl, folderRelativeUrl) {
  const endpoint = `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${folderRelativeUrl}')/Files`;
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json;odata=verbose'
    }
  });

  if (!response.ok) {
    throw new Error(`Error fetching files: ${response.statusText}`);
  }

  const data = await response.json();
  const uris = data.d.results.map(item => item.ServerRelativeUrl);
  console.log(`uris: ${JSON.stringify(uris)}`);
  return { result: "success" };
};

async function main() {
  try {
    setProcessEnvironment();
    accessToken = validateAndAcquireToken(accessToken);
  } catch (error) {
    console.error('Error reading access token from file:', error);
    return;
  }
  const siteUrl = 'https://sp-cloud.kp.org/sites/genAIPortalTestSite';
  const folderRelativeUrl = 'Shared Documents'; // Replace with your folder's relative URL

  try {
    const files = await getFilesInFolder(siteUrl, folderRelativeUrl);
    console.log(files);
  } catch (error) {
    console.error(`Error fetching files: ${error.message}`);
    console.error(`Error name: ${error.name}`);
    console.error(`Error stack: ${error.stack}`);
  }
}

main();
