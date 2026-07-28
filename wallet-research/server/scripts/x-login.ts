import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SESSION_FILE } from '../search/x.js';

const sessionPath = fileURLToPath(SESSION_FILE);

async function main() {
  await mkdir(dirname(sessionPath), { recursive: true });

  console.log('Opening browser — log in to X, then press Enter in this terminal when done.');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://x.com/login');

  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => resolve());
  });

  await context.storageState({ path: sessionPath });
  console.log(`Saved session to ${sessionPath}`);
  await browser.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
