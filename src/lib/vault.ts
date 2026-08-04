/**
 * Encrypts wallet private key(s) with a user password (PBKDF2 + AES-GCM).
 * v1 = single key bytes; v2 = JSON map of accountId → privateKey hex.
 */

const PBKDF2_ITERATIONS = 210_000;
const SALT_LEN = 16;
const IV_LEN = 12;

function toB64(u8: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u8.length; i += 1) s += String.fromCharCode(u8[i]!);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (h.length % 2 !== 0) throw new Error('Invalid hex length');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(u8: Uint8Array): `0x${string}` {
  let s = '0x';
  for (let i = 0; i < u8.length; i += 1) {
    s += u8[i]!.toString(16).padStart(2, '0');
  }
  return s as `0x${string}`;
}

export interface EncryptedVaultV1 {
  v: 1;
  saltB64: string;
  ivB64: string;
  ciphertextB64: string;
}

export interface EncryptedVaultV2 {
  v: 2;
  saltB64: string;
  ivB64: string;
  ciphertextB64: string;
}

export type EncryptedVault = EncryptedVaultV1 | EncryptedVaultV2;

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** @deprecated Prefer encryptLocalKeys — kept for callers that still encrypt a single key. */
export async function encryptPrivateKey(
  privateKey: `0x${string}`,
  password: string,
): Promise<EncryptedVaultV1> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(password, salt);
  const raw = hexToBytes(privateKey);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    raw as BufferSource,
  );
  return {
    v: 1,
    saltB64: toB64(salt),
    ivB64: toB64(iv),
    ciphertextB64: toB64(new Uint8Array(ct)),
  };
}

/** @deprecated Prefer decryptLocalKeys */
export async function decryptPrivateKey(
  vault: EncryptedVault,
  password: string,
): Promise<`0x${string}`> {
  const keys = await decryptLocalKeys(vault, password);
  const first = Object.values(keys)[0];
  if (!first) throw new Error('Vault has no keys');
  return first;
}

export async function encryptLocalKeys(
  keys: Record<string, `0x${string}`>,
  password: string,
): Promise<EncryptedVaultV2> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(password, salt);
  const payload = new TextEncoder().encode(JSON.stringify(keys));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    payload as BufferSource,
  );
  return {
    v: 2,
    saltB64: toB64(salt),
    ivB64: toB64(iv),
    ciphertextB64: toB64(new Uint8Array(ct)),
  };
}

export async function decryptLocalKeys(
  vault: EncryptedVault,
  password: string,
): Promise<Record<string, `0x${string}`>> {
  if (vault.v !== 1 && vault.v !== 2) {
    throw new Error('Unsupported vault version');
  }
  const salt = fromB64(vault.saltB64);
  const iv = fromB64(vault.ivB64);
  const ciphertext = fromB64(vault.ciphertextB64);
  const key = await deriveKey(password, salt);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
  } catch {
    throw new Error('Wrong password or corrupted vault');
  }

  if (vault.v === 1) {
    if (plain.byteLength !== 32) {
      throw new Error('Decrypted key has invalid length');
    }
    const pk = bytesToHex(new Uint8Array(plain));
    return { legacy: pk };
  }

  const text = new TextDecoder().decode(plain);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Corrupted vault payload');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Corrupted vault payload');
  }
  const out: Record<string, `0x${string}`> = {};
  for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== 'string') continue;
    if (!/^0x[0-9a-fA-F]{64}$/.test(value)) continue;
    out[id] = value.toLowerCase() as `0x${string}`;
  }
  if (Object.keys(out).length === 0) {
    throw new Error('Vault has no keys');
  }
  return out;
}
