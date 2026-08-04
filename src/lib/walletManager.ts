import { getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  createAccountId,
  defaultAccountLabel,
  DEFAULT_ETH_DERIVATION_PATH,
  type AccountKind,
  type WalletAccount,
} from './accounts';
import {
  activateAccount,
  clearAccountSession,
  getAccountsMeta,
  getActiveAccountId,
  getActiveAccountMeta,
  getLocalKeys,
  getSessionPassword,
  setAccountsMeta,
  setLocalKeys,
  setSessionPassword,
  setUnlockedAccount,
} from './accountSession';
import {
  loadPersisted,
  saveAccountsState,
  setActiveAccountId as persistActiveAccountId,
} from './storageState';
import { decryptLocalKeys, encryptLocalKeys } from './vault';
import {
  accountFromPrivateKey,
  generateNewPrivateKey,
  parseImportPrivateKey,
} from './walletCore';
import { persistSessionPrivateKey, clearSessionInBackground } from './sessionBridge';

function normalizeAddress(address: string): `0x${string}` {
  return getAddress(address).toLowerCase() as `0x${string}`;
}

/** Unlock vault, migrate v1→v2 if needed, hydrate session. */
export async function unlockWallet(password: string): Promise<void> {
  const state = await loadPersisted();
  if (!state.vault) throw new Error('No vault found.');

  let keys = await decryptLocalKeys(state.vault, password);
  let accounts = [...state.accounts];
  let activeAccountId = state.activeAccountId;
  let vault = state.vault;

  // Migrate legacy single-key vault into multi-account shape.
  if (vault.v === 1 || accounts.length === 0) {
    const legacyPk = keys.legacy ?? Object.values(keys)[0];
    if (!legacyPk) throw new Error('Vault has no keys');
    const address = normalizeAddress(privateKeyToAccount(legacyPk).address);
    const id = createAccountId('local', address);
    keys = { [id]: legacyPk };
    accounts = [
      {
        id,
        address,
        label: defaultAccountLabel('local', address),
        kind: 'local',
        createdAt: Date.now(),
      },
    ];
    activeAccountId = id;
    vault = await encryptLocalKeys(keys, password);
    await saveAccountsState({ vault, accounts, activeAccountId });
  } else if (vault.v !== 2) {
    // Re-encrypt as v2 if somehow still v1 with accounts already present
    vault = await encryptLocalKeys(keys, password);
    await saveAccountsState({ vault, accounts, activeAccountId });
  }

  setSessionPassword(password);
  setLocalKeys(keys);
  setAccountsMeta(accounts, activeAccountId);
  const active = activateAccount(activeAccountId ?? accounts[0]!.id);
  if (active.kind === 'local') {
    const pk = getLocalKeys().get(active.id);
    if (pk) await persistSessionPrivateKey(pk);
  } else {
    await persistHardwareSession(active);
  }
}

export async function createInitialWallet(password: string): Promise<{
  privateKey: `0x${string}`;
  account: WalletAccount;
}> {
  const pk = generateNewPrivateKey();
  const address = normalizeAddress(accountFromPrivateKey(pk).address);
  const id = createAccountId('local', address);
  const account: WalletAccount = {
    id,
    address,
    label: defaultAccountLabel('local', address),
    kind: 'local',
    createdAt: Date.now(),
  };
  const vault = await encryptLocalKeys({ [id]: pk }, password);
  await saveAccountsState({ vault, accounts: [account], activeAccountId: id });
  setSessionPassword(password);
  setLocalKeys({ [id]: pk });
  setAccountsMeta([account], id);
  activateAccount(id);
  await persistSessionPrivateKey(pk);
  return { privateKey: pk, account };
}

export async function importInitialWallet(
  password: string,
  privateKeyInput: string,
): Promise<WalletAccount> {
  const pk = parseImportPrivateKey(privateKeyInput);
  const address = normalizeAddress(accountFromPrivateKey(pk).address);
  const id = createAccountId('local', address);
  const account: WalletAccount = {
    id,
    address,
    label: defaultAccountLabel('local', address),
    kind: 'local',
    createdAt: Date.now(),
  };
  const vault = await encryptLocalKeys({ [id]: pk }, password);
  await saveAccountsState({ vault, accounts: [account], activeAccountId: id });
  setSessionPassword(password);
  setLocalKeys({ [id]: pk });
  setAccountsMeta([account], id);
  activateAccount(id);
  await persistSessionPrivateKey(pk);
  return account;
}

export async function addLocalAccount(opts: {
  privateKeyInput?: string;
  label?: string;
}): Promise<WalletAccount> {
  const password = getSessionPassword();
  if (!password) throw new Error('Unlock the wallet to add an account.');

  const pk = opts.privateKeyInput
    ? parseImportPrivateKey(opts.privateKeyInput)
    : generateNewPrivateKey();
  const address = normalizeAddress(accountFromPrivateKey(pk).address);
  const id = createAccountId('local', address);
  const existing = getAccountsMeta();
  if (existing.some(a => a.address === address || a.id === id)) {
    throw new Error('That account is already imported.');
  }

  const account: WalletAccount = {
    id,
    address,
    label: opts.label?.trim() || defaultAccountLabel('local', address),
    kind: 'local',
    createdAt: Date.now(),
  };

  const nextKeys: Record<string, `0x${string}`> = Object.fromEntries(getLocalKeys());
  nextKeys[id] = pk;
  const vault = await encryptLocalKeys(nextKeys, password);
  const accounts = [...existing, account];
  await saveAccountsState({ vault, accounts, activeAccountId: id });
  setLocalKeys(nextKeys);
  setAccountsMeta(accounts, id);
  activateAccount(id);
  await persistSessionPrivateKey(pk);
  return account;
}

export async function addHardwareAccount(opts: {
  kind: 'ledger' | 'trezor';
  address: string;
  derivationPath?: string;
  label?: string;
}): Promise<WalletAccount> {
  const address = normalizeAddress(opts.address);
  const id = createAccountId(opts.kind, address);
  const existing = getAccountsMeta();
  if (existing.some(a => a.address === address || a.id === id)) {
    throw new Error('That account is already imported.');
  }
  const account: WalletAccount = {
    id,
    address,
    label: opts.label?.trim() || defaultAccountLabel(opts.kind, address),
    kind: opts.kind,
    derivationPath: opts.derivationPath || DEFAULT_ETH_DERIVATION_PATH,
    createdAt: Date.now(),
  };
  const accounts = [...existing, account];
  await saveAccountsState({
    accounts,
    activeAccountId: id,
  });
  setAccountsMeta(accounts, id);
  activateAccount(id);
  await persistHardwareSession(account);
  return account;
}

export async function switchActiveAccount(accountId: string): Promise<WalletAccount> {
  await persistActiveAccountId(accountId);
  const meta = activateAccount(accountId);
  setAccountsMeta(getAccountsMeta(), accountId);
  if (meta.kind === 'local') {
    const pk = getLocalKeys().get(meta.id);
    if (!pk) throw new Error('Local key missing — unlock again.');
    await persistSessionPrivateKey(pk);
  } else {
    await persistHardwareSession(meta);
  }
  return meta;
}

export async function removeAccount(accountId: string): Promise<void> {
  const password = getSessionPassword();
  const existing = getAccountsMeta();
  const target = existing.find(a => a.id === accountId);
  if (!target) throw new Error('Account not found.');
  if (existing.length === 1) {
    throw new Error('Cannot remove the last account. Wipe the wallet instead.');
  }

  const accounts = existing.filter(a => a.id !== accountId);
  const nextActive = accounts[0]!.id;

  if (target.kind === 'local') {
    if (!password) throw new Error('Unlock the wallet to remove a local account.');
    const nextKeys: Record<string, `0x${string}`> = Object.fromEntries(getLocalKeys());
    delete nextKeys[accountId];
    const vault = await encryptLocalKeys(nextKeys, password);
    await saveAccountsState({ vault, accounts, activeAccountId: nextActive });
    setLocalKeys(nextKeys);
  } else {
    await saveAccountsState({ accounts, activeAccountId: nextActive });
  }

  setAccountsMeta(accounts, nextActive);
  await switchActiveAccount(nextActive);
}

export async function renameAccount(accountId: string, label: string): Promise<void> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error('Label required.');
  const accounts = getAccountsMeta().map(a =>
    a.id === accountId ? { ...a, label: trimmed } : a,
  );
  await saveAccountsState({
    accounts,
    activeAccountId: getActiveAccountId(),
  });
  setAccountsMeta(accounts, getActiveAccountId());
}

export async function lockManagedWallet(): Promise<void> {
  await clearSessionInBackground();
  clearAccountSession();
  setUnlockedAccount(null, null);
}

async function persistHardwareSession(account: WalletAccount): Promise<void> {
  await chrome.runtime.sendMessage({
    type: 'SET_SESSION',
    session: {
      kind: account.kind,
      accountId: account.id,
      address: account.address,
      derivationPath: account.derivationPath || DEFAULT_ETH_DERIVATION_PATH,
    },
  });
}

export type { AccountKind, WalletAccount };
