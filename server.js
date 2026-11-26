import { createServer } from 'http';
import { parse } from 'url';
import { existsSync } from 'fs';
import { join } from 'path';
import next from 'next';
import { setProcessEnvironment } from './scripts/configActions.js';
import { setProcessEnvironment as setProcessEnvironmentVault } from './scripts/configActionsVault.js';
import { preloadGeisingerConfig } from './utils/geisingerBootScript.js';



const dev = process.env.NODE_ENV !== 'production';
const port = process.env.PORT || 3000;
if (process.env['USE_VAULT'] === 'true') {
  await setProcessEnvironmentVault();
  // await adminRoleBootScript();
  const configPath = join(process.cwd(), 'geisingerConfigs.json');
  if (existsSync(configPath)) {
    await preloadGeisingerConfig();
  }
  // const geisingerIndexPath = join(process.cwd(), 'geisingerIndex.json');
  // if (existsSync(geisingerIndexPath)) {
  //   await validateOrCreateNeededIndexes();
  // }
  // await validateClients();
} else {
  await setProcessEnvironment();
}

const app = next({ dev, turbopack: process.env.TURBO_ON !== 'false' }); // Use turbopack by default unless TURBO_ON is 'false'
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    if (parsedUrl.pathname === '/health' || parsedUrl.pathname === '/livenessprobe') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'UP' }));
    } else {
      handle(req, res, parsedUrl);
    }
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on ${process.env.AUTH_URL}`);
  });

});
