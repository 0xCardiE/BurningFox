import type { PrivateKeyAccount } from 'viem/accounts';

let unlocked: PrivateKeyAccount | null = null;
let sessionPrivateKey: `0x${string}` | null = null;

export function setUnlockedAccount(
  account: PrivateKeyAccount | null,
  privateKey?: `0x${string}` | null,
): void {
  unlocked = account;
  if (privateKey !== undefined) {
    sessionPrivateKey = privateKey;
  } else if (account === null) {
    sessionPrivateKey = null;
  }
}

export function getUnlockedAccount(): PrivateKeyAccount | null {
  return unlocked;
}

export function getSessionPrivateKey(): `0x${string}` | null {
  return sessionPrivateKey;
}

export function isUnlocked(): boolean {
  return unlocked !== null;
}
