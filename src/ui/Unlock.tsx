import { useEffect, useState } from 'react';
import { loadPersisted } from '../lib/storageState';
import { unlockWallet } from '../lib/walletManager';
import { ScreenHeader } from './ScreenHeader';

export function Unlock({ onUnlocked }: { onUnlocked: () => void }) {
  const [hasVault, setHasVault] = useState<boolean | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadPersisted().then(s => setHasVault(s.vault != null));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasVault) return;
    setBusy(true);
    setErr(null);
    try {
      await unlockWallet(password);
      onUnlocked();
    } catch (error) {
      setErr(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  if (hasVault === undefined) {
    return (
      <div className="wallet-shell bfox">
        <ScreenHeader title="BurnBox" />
        <p className="muted panel">Loading…</p>
      </div>
    );
  }

  if (!hasVault) {
    return (
      <p className="panel error">No vault found. Reload the extension.</p>
    );
  }

  return (
    <div className="wallet-shell bfox">
      <ScreenHeader title="Unlock" />
      <form className="screen-body" onSubmit={e => void submit(e)}>
        <p className="muted" style={{ marginBottom: 12 }}>
          Enter your password to decrypt local keys. Hardware accounts are available after unlock.
        </p>
        <label htmlFor="unlock-pw">Password</label>
        <input
          id="unlock-pw"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoFocus
        />
        {err ? <p className="error">{err}</p> : null}
        <button
          type="submit"
          className="primary"
          style={{ width: '100%', marginTop: 12 }}
          disabled={busy || !password}
        >
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
