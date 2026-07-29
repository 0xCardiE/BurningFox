import { useEffect, useState } from 'react';
import { decryptPrivateKey } from '../lib/vault';
import { loadPersisted } from '../lib/storageState';
import { unlockWithPersistedSession } from '../lib/sessionBridge';
import type { EncryptedVault } from '../lib/vault';
import { L33tMark } from './L33tMark';

export function Unlock({ onUnlocked }: { onUnlocked: () => void }) {
  const [vault, setVault] = useState<EncryptedVault | null | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadPersisted().then((s) => setVault(s.vault));
  }, []);

  async function submit() {
    if (!vault) return;
    setErr(null);
    setBusy(true);
    try {
      const pk = await decryptPrivateKey(vault, password);
      await unlockWithPersistedSession(pk);
      onUnlocked();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (vault === undefined) {
    return (
      <div className="unlock-screen unlock-screen--loading">
        <p className="unlock-loading">Loading…</p>
      </div>
    );
  }
  if (vault === null) {
    return (
      <p className="panel error">No vault found. Reload the extension.</p>
    );
  }

  return (
    <div className="unlock-screen">
      <div className="unlock-brand">
        <L33tMark className="unlock-logo" size={88} />
        <h1 className="unlock-title">1337</h1>
        <p className="unlock-lead">
          Developer burner wallet — unlock to sign swaps, multi-sends, and dapp transactions
          locally. Not for securing real funds.
        </p>
      </div>

      <div className="unlock-form">
        <label htmlFor="upw" className="unlock-label">
          Password
        </label>
        <input
          id="upw"
          type="password"
          className="unlock-input"
          value={password}
          placeholder="Enter your password"
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
          autoComplete="current-password"
        />
        {err && <p className="unlock-error">{err}</p>}
        <button
          type="button"
          className="unlock-submit"
          disabled={busy || !password}
          onClick={() => void submit()}
        >
          {busy ? '…' : 'Unlock'}
        </button>
      </div>

      <div className="unlock-footer-art" aria-hidden="true" />
    </div>
  );
}
