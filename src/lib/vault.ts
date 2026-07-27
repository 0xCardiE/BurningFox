/**
 * Encrypts the wallet private key with a user password (PBKDF2 + AES-GCM).
 * No mock data — decrypt fails with a clear error if the password is wrong.
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

export interface EncryptedVault {
  v: 1;
  saltB64: string;
  ivB64: string;
  ciphertextB64: string;
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
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
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptPrivateKey(
  privateKey: `0x${string}`,
  password: string,
): Promise<EncryptedVault> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(password, salt);
  const raw = hexToBytes(privateKey);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    raw,
  );
  return {
    v: 1,
    saltB64: toB64(salt),
    ivB64: toB64(iv),
    ciphertextB64: toB64(new Uint8Array(ct)),
  };
}

export async function decryptPrivateKey(
  vault: EncryptedVault,
  password: string,
): Promise<`0x${string}`> {
  if (vault.v !== 1) throw new Error('Unsupported vault version');
  const salt = fromB64(vault.saltB64);
  const iv = fromB64(vault.ivB64);
  const ciphertext = fromB64(vault.ciphertextB64);
  const key = await deriveKey(password, salt);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    );
  } catch {
    throw new Error('Wrong password or corrupted vault');
  }
  if (plain.byteLength !== 32) {
    throw new Error('Decrypted key has invalid length');
  }
  return bytesToHex(new Uint8Array(plain));
}
