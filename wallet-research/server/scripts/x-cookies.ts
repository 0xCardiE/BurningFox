import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { saveXSession, sessionPath } from '../search/x-session.js';

async function main() {
  const authFromEnv = process.env.X_AUTH_TOKEN;
  const ct0FromEnv = process.env.X_CT0;

  let authToken = authFromEnv ?? '';
  let ct0 = ct0FromEnv ?? '';

  if (!authToken || !ct0) {
    console.log(`
Paste X cookies from DevTools → Application → Cookies → x.com
You need: auth_token and ct0

Or set env vars: X_AUTH_TOKEN=... X_CT0=...
`);
    const rl = readline.createInterface({ input, output });
    authToken = (await rl.question('auth_token: ')).trim();
    ct0 = (await rl.question('ct0: ')).trim();
    rl.close();
  }

  await saveXSession(authToken, ct0);
  console.log(`Saved X session to ${sessionPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
