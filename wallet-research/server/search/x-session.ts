import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SESSION_FILE } from '../search/x.js';

const sessionPath = fileURLToPath(SESSION_FILE);

export function buildXStorageState(authToken: string, ct0: string) {
  const baseCookie = {
    domain: '.x.com',
    path: '/',
    expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    httpOnly: true,
    secure: true,
    sameSite: 'None' as const,
  };

  return {
    cookies: [
      { ...baseCookie, name: 'auth_token', value: authToken },
      { ...baseCookie, name: 'ct0', value: ct0, httpOnly: false },
    ],
    origins: [],
  };
}

export async function saveXSession(authToken: string, ct0: string): Promise<string> {
  if (!authToken.trim() || !ct0.trim()) {
    throw new Error('Both auth_token and ct0 are required');
  }
  await mkdir(dirname(sessionPath), { recursive: true });
  await writeFile(sessionPath, JSON.stringify(buildXStorageState(authToken.trim(), ct0.trim()), null, 2), 'utf8');
  return sessionPath;
}

export { sessionPath };
