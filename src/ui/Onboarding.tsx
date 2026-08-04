import { useState } from 'react';
import { createInitialWallet, importInitialWallet } from '../lib/walletManager';
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
      const { privateKey } = await createInitialWallet(password);
      setBackupKey(privateKey);
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
      await importInitialWallet(password, importKey);
      onReady();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (showBackup && backupKey) {
    return (
      <div className="wallet-shell bfox">
        <ScreenHeader title="BurnBox" />
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
    <div className="wallet-shell bfox">
      <ScreenHeader title="BurnBox" />
      <div className="screen-body">
        <p className="muted" style={{ marginBottom: 14 }}>
          Developer burner wallet. Create or import a private key — encrypted locally with your
          password. You can add more accounts (including Ledger / Trezor) later in Settings.
        </p>

        <div className="row" style={{ marginBottom: 14 }}>
          <button
            type="button"
            className={mode === 'create' ? 'primary' : 'ghost'}
            onClick={() => setMode('create')}
          >
            Create
          </button>
          <button
            type="button"
            className={mode === 'import' ? 'primary' : 'ghost'}
            onClick={() => setMode('import')}
          >
            Import key
          </button>
        </div>

        <label htmlFor="pw">Password (encrypts local vault)</label>
        <input
          id="pw"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <label htmlFor="pw2">Confirm password</label>
        <input
          id="pw2"
          type="password"
          autoComplete="new-password"
          value={password2}
          onChange={e => setPassword2(e.target.value)}
        />

        {mode === 'import' ? (
          <>
            <label htmlFor="pk">Private key</label>
            <textarea
              id="pk"
              className="mono"
              rows={3}
              placeholder="0x… or 64 hex chars"
              value={importKey}
              onChange={e => setImportKey(e.target.value)}
              spellCheck={false}
            />
          </>
        ) : null}

        {err ? <p className="error">{err}</p> : null}

        <button
          type="button"
          className="primary"
          style={{ width: '100%', marginTop: 12 }}
          disabled={busy}
          onClick={() => void (mode === 'create' ? handleCreate() : handleImport())}
        >
          {busy ? 'Working…' : mode === 'create' ? 'Create wallet' : 'Import wallet'}
        </button>
      </div>
    </div>
  );
}
