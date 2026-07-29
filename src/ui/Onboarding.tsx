import { useState } from 'react';
import {
  accountFromPrivateKey,
  generateNewPrivateKey,
  parseImportPrivateKey,
} from '../lib/walletCore';
import { encryptPrivateKey } from '../lib/vault';
import { setVault } from '../lib/storageState';
import { setUnlockedAccount } from '../lib/accountSession';
import { persistSessionPrivateKey } from '../lib/sessionBridge';
import { ScreenHeader } from './ScreenHeader';

type Mode = 'create' | 'import';

export function Onboarding({ onReady }: { onReady: () => void }) {
  const [mode, setMode] = useState<Mode>('create');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [importKey, setImportKey] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [backupKey, setBackupKey] = useState<`0x${string}` | null>(null);

  async function handleCreate() {
    setErr(null);
    if (password.length < 8) {
      setErr('Use a password of at least 8 characters.');
      return;
    }
    if (password !== password2) {
      setErr('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const pk = generateNewPrivateKey();
      const vault = await encryptPrivateKey(pk, password);
      await setVault(vault);
      setUnlockedAccount(accountFromPrivateKey(pk), pk);
      await persistSessionPrivateKey(pk);
      setBackupKey(pk);
      setShowBackup(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    setErr(null);
    if (password.length < 8) {
      setErr('Use a password of at least 8 characters.');
      return;
    }
    if (password !== password2) {
      setErr('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const pk = parseImportPrivateKey(importKey);
      const vault = await encryptPrivateKey(pk, password);
      await setVault(vault);
      setUnlockedAccount(accountFromPrivateKey(pk), pk);
      await persistSessionPrivateKey(pk);
      onReady();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (showBackup && backupKey) {
    return (
      <div className="wallet-shell l33t">
        <ScreenHeader title="1337" />
        <div className="screen-body">
          <h2 style={{ fontSize: '1.1rem', marginBottom: 8 }}>Back up your key</h2>
          <p className="muted">
            This is the only time we show the generated private key. Store it offline. Anyone with
            it controls this wallet.
          </p>
          <div className="mono" style={{ margin: '12px 0' }}>
            {backupKey}
          </div>
          <button
            type="button"
            className="primary"
            style={{ width: '100%' }}
            onClick={() => {
              setShowBackup(false);
              onReady();
            }}
          >
            I have saved it — continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-shell l33t">
      <ScreenHeader title="1337" />
      <div className="screen-body">
        <p className="muted" style={{ marginTop: 0 }}>
          A developer burner wallet for testing. Create or import a private key — not meant for
          securing real funds. Password only encrypts local storage in this browser.
        </p>
        <div className="nav" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className={mode === 'create' ? 'primary' : 'ghost'}
            onClick={() => {
              setMode('create');
              setErr(null);
            }}
          >
            Create
          </button>
          <button
            type="button"
            className={mode === 'import' ? 'primary' : 'ghost'}
            onClick={() => {
              setMode('import');
              setErr(null);
            }}
          >
            Import
          </button>
        </div>
        {mode === 'import' && (
          <>
            <p
              className="muted"
              style={{
                fontSize: 12,
                marginBottom: 10,
                padding: 10,
                borderLeft: '3px solid var(--accent)',
                background: 'rgba(255, 122, 0, 0.08)',
              }}
            >
              Import only keys you created yourself on a trusted device. If anyone else gave you
              this key or a site generated it for you, assume it is compromised.
            </p>
            <label htmlFor="imp">Private key (hex)</label>
            <textarea
              id="imp"
              value={importKey}
              onChange={e => setImportKey(e.target.value)}
              autoComplete="off"
              placeholder="0x…"
              spellCheck={false}
            />
          </>
        )}
        <label htmlFor="pw">Password (encrypts local vault)</label>
        <input
          id="pw"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <label htmlFor="pw2">Confirm password</label>
        <input
          id="pw2"
          type="password"
          value={password2}
          onChange={e => setPassword2(e.target.value)}
          autoComplete="new-password"
        />
        {err && <p className="error">{err}</p>}
        {mode === 'create' ? (
          <button
            type="button"
            style={{ marginTop: 12, width: '100%' }}
            disabled={busy}
            onClick={() => void handleCreate()}
          >
            {busy ? '…' : 'Generate wallet'}
          </button>
        ) : (
          <button
            type="button"
            style={{ marginTop: 12, width: '100%' }}
            disabled={busy}
            onClick={() => void handleImport()}
          >
            {busy ? '…' : 'Import and encrypt'}
          </button>
        )}
      </div>
    </div>
  );
}
