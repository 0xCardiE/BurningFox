import { isAddress, isHex, toHex } from 'viem';
import {
  english,
  generateMnemonic,
  generatePrivateKey,
  mnemonicToAccount,
  privateKeyToAccount,
  type PrivateKeyAccount,
} from 'viem/accounts';

const PK_LEN = 66; // 0x + 64 hex

export function generateNewPrivateKey(): `0x${string}` {
  return generatePrivateKey();
}

export function generateNewMnemonic(): string {
  return generateMnemonic(english);
}

export function accountFromPrivateKey(
  privateKey: `0x${string}`,
): PrivateKeyAccount {
  return privateKeyToAccount(privateKey);
}

export function ethDerivationPath(addressIndex: number): string {
  if (!Number.isInteger(addressIndex) || addressIndex < 0) {
    throw new Error('Address index must be a non-negative integer.');
  }
  return `m/44'/60'/0'/0/${addressIndex}`;
}

/**
 * Normalise a BIP-39 phrase: trim, collapse whitespace, lowercase.
 */
export function normalizeMnemonic(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

/**
 * Validate and return a normalised English BIP-39 mnemonic (12/15/18/21/24 words).
 */
export function parseImportMnemonic(input: string): string {
  const mnemonic = normalizeMnemonic(input);
  const words = mnemonic.split(' ');
  if (![12, 15, 18, 21, 24].includes(words.length)) {
    throw new Error('Seed phrase must be 12, 15, 18, 21, or 24 words.');
  }
  try {
    // Throws if checksum / wordlist invalid
    mnemonicToAccount(mnemonic);
  } catch {
    throw new Error('Invalid seed phrase. Check the words and order.');
  }
  return mnemonic;
}

export function privateKeyFromMnemonic(
  mnemonic: string,
  addressIndex = 0,
): `0x${string}` {
  const normalized = parseImportMnemonic(mnemonic);
  const account = mnemonicToAccount(normalized, { addressIndex });
  const hd = account.getHdKey();
  if (!hd.privateKey) {
    throw new Error('Could not derive private key from seed phrase.');
  }
  return toHex(hd.privateKey);
}

/**
 * Normalise user paste: trim, optional 0x, must be 32 bytes.
 */
export function parseImportPrivateKey(input: string): `0x${string}` {
  const t = input.trim();
  const with0x = (t.startsWith('0x') ? t : `0x${t}`) as `0x${string}`;
  if (!isHex(with0x) || with0x.length !== PK_LEN) {
    throw new Error('Private key must be 64 hex characters (32 bytes).');
  }
  const acct = privateKeyToAccount(with0x);
  if (!isAddress(acct.address)) {
    throw new Error('Invalid private key');
  }
  return with0x;
}

/** True if the paste looks like a mnemonic rather than a hex private key. */
export function looksLikeMnemonic(input: string): boolean {
  const words = input.trim().split(/\s+/).filter(Boolean);
  return words.length >= 12 && !/^0x?[0-9a-fA-F]{64}$/.test(input.trim());
}
