'use server';

import https from 'https';

async function setProcessEnvironment() {

  const kpConfigURI = process.env.KPCONFIG_URI;
  const kpConfigPassword = process.env.KPCONFIG_PASSWORD;
  const kpConfigAccessToken = process.env.KPCONFIG_ACCESSTOKEN;
  const kpConfigName = process.env.KPCONFIG_NAME;
  const kpConfigProfile = process.env.KPCONFIG_PROFILE;
  const kpConfigUser = process.env.KPCONFIG_USER;
  const kpConfigLabel = process.env.KPCONFIG_LABEL;
  const localHostStatus = process.env.LOCALHOST_STATUS;

  const ZQ_ENVS = ['dev', 'uat', 'pp'];

  const envName = kpConfigProfile.split('-').pop();

  process.env['envName'] = envName;
  process.env['NEXT_PUBLIC_ENV'] = envName;

  const kpConfigPath = `/${kpConfigName}/${kpConfigProfile}/${kpConfigLabel}`;
  const httpsPrefixIndex = kpConfigURI.indexOf('http://');
  const hostStartIndex = httpsPrefixIndex + 9;
  const kpConfigHost = kpConfigURI.substring(hostStartIndex);
  const credentials = `${kpConfigUser}:${kpConfigPassword}`;
  const base64Credentials = Buffer.from(credentials).toString('base64');
  const kpConfigAuthorization = `Basic ${base64Credentials}`;

  const environmentProperties = [
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.openai.api.key`,
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
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.rbc2.user`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.rbc2.password`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.rbc2.url`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.appuser.jpt.user`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.appuser.jpt.password`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.appuser.jpt.url`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.appuser.perf.user`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.appuser.perf.password`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.appuser.perf.url`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.appuser.rbc2.user`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.appuser.rbc2.password`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.appuser.rbc2.url`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.uat.user`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.uat.password`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.compare_owner.uat.url`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.appuser.uat.user`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.appuser.uat.password`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.datahub.appuser.uat.url`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.pubfamprefix`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.famClientSecret.zq`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.pubfamprefix.zq`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.CC.famClientId`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.CC.famClientSecret`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.CC.pubfamprefix`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.CC.apigeeDomain`,
    `kp.nexusos.org.tokenLimit`,
    `kp.nexusos.org.defaultModel`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.apikey.access.key`, // NPS_API_KEY
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.bcs.apikey.access.key`, // BCS_API_KEY
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.npscmat.apikey.access.key`, // NPSCMAT_API_KEY
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.cac.apikey.access.key`, // CAC_API_KEY
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.apikey.statistics.key`,
    `host.${envName}-aiportal-web-2.qtest.api.token`,
    `host.${envName}-aiportal-web-2.qtest.api.url`,
    `host.${envName}-aiportal-web-2.generateTestMrn.api.user`,
    `host.${envName}-aiportal-web-2.generateTestMrn.api.password`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint.new.t3`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.new.t3.api.key`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.new.t3.api.key`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.mail.smtp.host`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.mail.smtp.port`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.mail.smtp.username`,
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.mail.smtp.password`,
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
    `host.${envName}-aiportal-web-2.splunk.access.token`,
    `host.${envName}-aiportal-web-2.splunk.search.api.url`,
    `host.${envName}-aiportal-web-2.db2.database`,
    `host.${envName}-aiportal-web-2.db2.hostname`,
    `host.${envName}-aiportal-web-2.db2.protocol`,
    `host.${envName}-aiportal-web-2.db2.port`,
    `host.${envName}-aiportal-web-2.db2.id`,
    `host.${envName}-aiportal-web-2.db2.secret`,
    `host.${envName}-aiportal-web-2.github.secret`,
    `platform.services.orchestration.app.url`,
    `host.${envName}-aiportal-web-2.bcs.sap.host`,
    `host.${envName}-aiportal-web-2.bcs.sap.user`,
    `host.${envName}-aiportal-web-2.bcs.sap.password`,
    `host.${envName}-aiportal-web-2.bcs.sap.port`,
    `host.${envName}-aiportal-web-2.bcs.oracle.user`,
    `host.${envName}-aiportal-web-2.bcs.oracle.password`,
    `host.${envName}-aiportal-web-2.bcs.oracle.dsn`,
    `host.${envName}-aiportal-web-2.rcnoa.epds.jdbc.url`,
    `host.${envName}-aiportal-web-2.rcnoa.epds.username`,
    `host.${envName}-aiportal-web-2.rcnoa.epds.password`,
    `host.${envName}-aiportal-web-2.rcnoa.mdw.jdbc.url`,
    `host.${envName}-aiportal-web-2.rcnoa.mdw.username`,
    `host.${envName}-aiportal-web-2.rcnoa.mdw.password`,
    `host.${envName}-aiportal-web-2.rcnoa.sftp.remote.server`,
    `host.${envName}-aiportal-web-2.rcnoa.sftp.remote.folder`,
    `host.${envName}-aiportal-web-2.rcnoa.sftp.username`,
    `host.${envName}-aiportal-web-2.rcnoa.sftp.password`,
    `host.${envName}-aiportal-web-2.rcnoa.sftp.host.key.sha256`,
    `host.${envName}-aiportal-web-2.rcnoa.scheduler.token`,
    `host.${envName}-aiportal-web-2.rcnoa.mock.fixtures.enabled`,
    `host.${envName}-aiportal-web-2.bcs.jira.apikey`,
    `host.${envName}-aiportal-web-2.bcs.emailid`
  ];

  return new Promise((resolve, reject) => {
    const options = {
      hostname: kpConfigHost,
      path: kpConfigPath,
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        'access_token': kpConfigAccessToken,
        'Authorization': kpConfigAuthorization,
        'Accept': '*/*',
        'Host': kpConfigHost,
        'Accept-Encoding': 'gzip, deflate, br'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let { propertySources: [{ source }] } = JSON.parse(data);
        const propertyNames = Object.keys(source);
        propertyNames.forEach(property => {
          if (environmentProperties.includes(property)) {
            process.env[property] = source[property];
          }
        });

        process.env['AUTH_SECRET'] = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.authSecret`];
        process.env['FAM_CLIENT_ID'] = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.famClientId`];
        process.env['FAM_CLIENT_SECRET'] = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.famClientSecret.zq`];
        process.env['NEXT_PUBLIC_FAM_PREFIX'] = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.pubfamprefix.zq`];
        process.env['NPS_API_KEY'] = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.apikey.access.key`];
        process.env['BCS_API_KEY'] = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.bcs.apikey.access.key`];
        process.env['NPSCMAT_API_KEY'] = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.npscmat.apikey.access.key`];

        process.env['CAC_API_KEY'] = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.cac.apikey.access.key`];

        process.env['STATISTICS_LOGGING_API_KEY'] = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.apikey.statistics.key`];
        process.env['ORCHESTRATION_APP_URL'] = `https://${envName}-aiasstsvc-bff-1.aisvc.aksnp.azure.kp.org`;
        process.env['RCNOA_EPDS_JDBC_URL'] = process.env[`host.${envName}-aiportal-web-2.rcnoa.epds.jdbc.url`];
        process.env['RCNOA_EPDS_USERNAME'] = process.env[`host.${envName}-aiportal-web-2.rcnoa.epds.username`];
        process.env['RCNOA_EPDS_PASSWORD'] = process.env[`host.${envName}-aiportal-web-2.rcnoa.epds.password`];
        process.env['RCNOA_MDW_JDBC_URL'] = process.env[`host.${envName}-aiportal-web-2.rcnoa.mdw.jdbc.url`];
        process.env['RCNOA_MDW_USERNAME'] = process.env[`host.${envName}-aiportal-web-2.rcnoa.mdw.username`];
        process.env['RCNOA_MDW_PASSWORD'] = process.env[`host.${envName}-aiportal-web-2.rcnoa.mdw.password`];
        process.env['RCNOA_REMOTE_SERVER'] = process.env[`host.${envName}-aiportal-web-2.rcnoa.sftp.remote.server`];
        process.env['RCNOA_REMOTE_FOLDER'] = process.env[`host.${envName}-aiportal-web-2.rcnoa.sftp.remote.folder`];
        process.env['RCNOA_USERNAME'] = process.env[`host.${envName}-aiportal-web-2.rcnoa.sftp.username`];
        process.env['RCNOA_PASSWORD'] = process.env[`host.${envName}-aiportal-web-2.rcnoa.sftp.password`];
        process.env['RCNOA_SFTP_HOST_KEY_SHA256'] = process.env[`host.${envName}-aiportal-web-2.rcnoa.sftp.host.key.sha256`];
        process.env['RCNOA_SCHEDULER_TOKEN'] = process.env[`host.${envName}-aiportal-web-2.rcnoa.scheduler.token`];
        process.env['RCNOA_MOCK_FIXTURES_ENABLED'] = process.env[`host.${envName}-aiportal-web-2.rcnoa.mock.fixtures.enabled`];

        // ATTENTION: To run locally you must have the following in your .env.local (or manually set in path variables):
        // AUTH_CALLBACK_URL=http://localhost:3000/api/openid/callback
        // AUTH_URL=http://localhost:3000
        // See: https://confluence-aes.kp.org/spaces/HPTSAI/pages/1487476063/Developer+Onboarding for more info

        const isRunningInCluster = !!process.env.KUBERNETES_SERVICE_HOST;

        if (isRunningInCluster) {
          process.env['AUTH_CALLBACK_URL'] = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.callbackURL`];
          process.env['AUTH_URL'] = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.authURL`];

          process.env['ORCHESTRATION_APP_URL'] = process.env['platform.services.orchestration.app.url'];

          // Add logic to check for ZQ envs
          if (!ZQ_ENVS.includes(envName)) {
            process.env['FAM_CLIENT_SECRET'] = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.famClientSecret`];
            process.env['NEXT_PUBLIC_FAM_PREFIX'] = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.pubfamprefix`];
          }
        }
        // process env for LangChain service
        // process.env['AZURE_OPENAI_API_KEY'] = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.openai.api.key`];
        // process.env['AZURE_OPENAI_API_DEPLOYMENT_NAME'] = 'gpt-4o-aisvc';
        // process.env['AZURE_OPENAI_API_VERSION'] = '2024-08-01-preview';
        // process.env['AZURE_OPENAI_BASE_PATH'] = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.completionsEndpoint`];
        resolve(source);
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

export { setProcessEnvironment };
