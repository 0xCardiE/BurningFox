import {
  generatePrivateKey,
  privateKeyToAccount,
  type PrivateKeyAccount,
} from 'viem/accounts';
import { isAddress, isHex } from 'viem';

const PK_LEN = 66; // 0x + 64 hex

export function generateNewPrivateKey(): `0x${string}` {
  return generatePrivateKey();
}

export function accountFromPrivateKey(
  privateKey: `0x${string}`,
): PrivateKeyAccount {
  return privateKeyToAccount(privateKey);
}

/**
 * Normalise user paste: trim, optional 0x, must be 32 bytes.
 */
export function parseImportPrivateKey(input: string): `0x${string}` {
  const t = input.trim();
  const with0x = t.startsWith('0x') ? t : `0x${t}`;
  if (!isHex(with0x) || with0x.length !== PK_LEN) {
    throw new Error('Private key must be 64 hex characters (32 bytes).');
  }
  const acct = privateKeyToAccount(with0x);
  if (!isAddress(acct.address)) {
    throw new Error('Invalid private key');
  }
  return with0x;
}
