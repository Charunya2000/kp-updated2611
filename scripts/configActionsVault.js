'use server';


import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

async function setProcessEnvironment() {

  const vaultName = process.env['AZURE_KEY_VAULT_NAME'] || 'genai-kv-dev';

  const envName = process.env['envName'] || 'geisingerDev';
  process.env['NEXT_PUBLIC_ENV'] = envName;

  const environmentProperties = [`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.openai.api.key`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.postgresdb.password`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.jira.api.key`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.mongodb.endpoint`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.api.key`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.api.key`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.completionsEndpoint`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.embeddingsEndpoint`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.famClientId`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.famClientSecret`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.authSecret`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.callbackURL`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.authURL`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.confluence.api.key`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.sharepoint.cert`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.sharepoint.privatekey`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.sharepoint.thumbprint`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.sharepoint.clientid`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.sharepoint.tenantId`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.accountName`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.accountKey`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.endpoint`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.privateEndpoint`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aksservice.serviceName`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aksservice.namespace`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.user`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.password`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.url`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.jpt.user`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.jpt.password`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.jpt.url`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.perf.user`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.perf.password`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.perf.url`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.uat.user`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.uat.password`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.uat.url`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.pubfamprefix`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.famClientSecret.zq`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.pubfamprefix.zq`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.CC.famClientId`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.CC.famClientSecret`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.CC.pubfamprefix`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.CC.apigeeDomain`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.apikey.access.key`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.apikey.statistics.key`,
  `host.${envName}-aiportal-web-2.qtest.api.token`,
  `host.${envName}-aiportal-web-2.qtest.api.url`,
  `host.${envName}-aiportal-web-2.generateTestMrn.api.user`,
  `host.${envName}-aiportal-web-2.generateTestMrn.api.password`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint.new.t3`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.new.t3.api.key`,
  `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.new.t3.api.key`,
    `servicenow.host.id`,
    `kp.servicenow.oauthtoken.url`,
    `kp.servicenow.incident.createupdate.url`,
    `kp.servicenow.incident.tableget.url`,
    `kp.servicenow.incident.direct.url`,
    `kp.servicenow.incident.apigee.url`,
    `kp.servicenow.incident.apigee.cmdb.ci`,
    `kp.servicenow.incident.apigee.assign.group`,
    `kp.servicenow.incident.apigee.username`,
    `kp.servicenow.incident.apigee.password`,
    `kp.servicenow.fam.apigee.url`,
    `kp.servicenow.fam.apigee.clientId`,
    `kp.servicenow.fam.apigee.secret`,
    `kp.servicenow.token.apigee.url`,
    `kp.servicenow.token.apigee.clientId`,
    `kp.servicenow.token.apigee.secret`,
    `kp.servicenow.reporting.database.host`,
    `kp.servicenow.reporting.database.user`,
    `kp.servicenow.reporting.database.password`,
  `host.${envName}-aiportal-web-2.splunk.token.url`,
  `host.${envName}-aiportal-web-2.splunk.client.id`,
  `host.${envName}-aiportal-web-2.splunk.client.secret`,
  `host.${envName}-aiportal-web-2.splunk.auth.api.url`,
  `host.${envName}-aiportal-web-2.splunk.access.token`];

  const secretToEnvPropertyMap = {
    'openai-gpt4o-key': `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.openai.api.key`,
    'mongodb-con-string': `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.mongodb.endpoint`,
    'cognitive-search-manquery-key': `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.api.key`,
    'cognitive-search-pri-key': `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.api.key`, // adjust if needed
    'cognitive-search-endpoint-string': `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`, // adjust if needed
    'openai-gpt4o-uri': `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.completionsEndpoint`,
    'openai-text-embedding-ada-002-key': `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.embeddingsEndpoint`, // adjust if needed
    'openai-text-embedding-ada-002-uri': `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.embeddingsEndpoint`, // adjust if needed
    'blob-storage-endpoint': `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.endpoint`, // adjust if needed
    'blob-storage-account-key': `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.accountKey`, // adjust if needed
    'blob-storage-account-name': `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.accountName`,
    'sharepoint-cert': `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.sharepoint.cert`,
    'sharepoint-privatekey': `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.sharepoint.privatekey`,
    'sharepoint-thumbprint': `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.sharepoint.thumbprint`,
    'sharepoint-clientid': `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.sharepoint.clientid`,
    'sharepoint-tenantId': `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.sharepoint.tenantId`,
    'sharepoint-clientsecret-id': `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.sharepoint.clientsecretId`,
    'sharepoint-clientsecret-value': `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.sharepoint.clientsecret`,
    'pingfederate-famprefix': `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.pubfamprefix`,
    'pingfederate-clientid': `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.famClientId`,
    'pingfederate-clientsecret': `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.famClientSecret`,
    'pingfederate-authsecret': `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.authSecret`,
    'pingfederate-callbackurl': `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.callbackURL`,
    'pingfederate-authurl': `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.authURL`,
  };

  // If AZURE_KEY_VAULT_NAME is set, use Azure Key Vault for secrets
  if (envName && vaultName) {
    const vaultName = process.env['AZURE_KEY_VAULT_NAME'];
    const url = `https://${vaultName}.vault.azure.net`;
    const credential = new DefaultAzureCredential();
    const client = new SecretClient(url, credential);
    // Example: retrieve a single secret, e.g. 'my-app-secret'
    // Extend this array for more keys as needed
    const secretNames = ['cognitive-search-manquery-key',
      'cognitive-search-pri-key',
      'cognitive-search-endpoint-string',
      'mongodb-con-string',
      'openai-gpt4o-key',
      'openai-gpt4o-uri',
      'openai-text-embedding-ada-002-key',
      'openai-text-embedding-ada-002-uri',
      'blob-storage-endpoint',
      'blob-storage-account-key',
      'blob-storage-account-name',
      'sharepoint-cert',
      'sharepoint-privatekey',
      'sharepoint-thumbprint',
      'sharepoint-clientid',
      'sharepoint-tenantId',
      'sharepoint-clientsecret-id',
      'sharepoint-clientsecret-value',
      'pingfederate-famprefix',
      'pingfederate-clientid',
      'pingfederate-clientsecret',
      'pingfederate-authsecret',
      'pingfederate-callbackurl',
      'pingfederate-authurl',
    ];
    return Promise.all(secretNames.map(async (name) => {
      try {
        const secret = await client.getSecret(name);
        const envProperty = secretToEnvPropertyMap[name] || name;
        process.env[envProperty] = secret.value;
        return { [envProperty]: secret.value };
      } catch (err) {
        // Optionally log or handle missing secret
        const envProperty = secretToEnvPropertyMap[name] || name;
        console.error(`Error retrieving secret ${name} from Key Vault:`, err.message);
        return { [envProperty]: null };
      }
    })).then(results => {
      // Set remaining environmentProperties to default string if not already set
      const foundEnvProperties = results.map(r => Object.keys(r)[0]);
      environmentProperties.forEach(envProp => {
        if (!process.env[envProp]) {
          process.env[envProp] = 'No Azure Vault Value for Key';
        }
      });

      process.env['AUTH_SECRET'] = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.authSecret`];
      process.env['FAM_CLIENT_ID'] = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.famClientId`];
      process.env['AUTH_CALLBACK_URL'] = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.callbackURL`];
      process.env['AUTH_URL'] = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.authURL`];
      process.env['FAM_CLIENT_SECRET'] = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.famClientSecret`];
      process.env['NEXT_PUBLIC_FAM_PREFIX'] = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.pubfamprefix`];

      // Optionally merge all secrets into one object
      return results.reduce((acc, cur) => Object.assign(acc, cur), {});
    });
  } else {
    console.error('AZURE_KEY_VAULT_NAME is not set. Cannot retrieve secrets.');
  }
}

export { setProcessEnvironment };
