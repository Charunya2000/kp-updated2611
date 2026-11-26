import hdb from 'hdb';


export async function getSapRecords(query) {
    const envName = process.env['envName'] || 'dev';
    const saphost = process.env[`host.${envName}-aiportal-web-2.bcs.sap.host`]
    const client = hdb.createClient({
        host: saphost.trim(),//process.env.SAP_HANA_HOST
        port: process.env[`host.${envName}-aiportal-web-2.bcs.sap.port`],//process.env.SAP_HANA_PORT,
        user: process.env[`host.${envName}-aiportal-web-2.bcs.sap.user`],//process.env.SAP_HANA_USER,
        password: process.env[`host.${envName}-aiportal-web-2.bcs.sap.password`],//process.env.SAP_HANA_PASSWORD

    });


    try {

        await new Promise((resolve, reject) => {
            client.connect((err) => (err ? reject(err) : resolve()));
        });


        // 3. Execute SQL query

        const response = await new Promise((resolve, reject) => {
            client.exec(query, (err, rows) => err ? reject(err) : resolve(rows));
        });

        // 4. Disconnect gracefully
        client.disconnect();

        return response;
    } catch (error) {
        if (client.state() === 'connected') {
            client.disconnect();
        }
        return [];
    }
}