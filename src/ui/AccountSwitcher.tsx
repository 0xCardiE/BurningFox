import { useState } from 'react';
import {
  getAccountsMeta,
  getActiveAccountId,
  getActiveAccountMeta,
} from '../lib/accountSession';
import { accountKindLabel, shortAddress } from '../lib/accounts';
import { switchActiveAccount } from '../lib/walletManager';

export function AccountSwitcher({ onChanged }: { onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const accounts = getAccountsMeta();
  const active = getActiveAccountMeta();
  const activeId = getActiveAccountId();

  if (!active || accounts.length === 0) return null;

  async function select(id: string) {
    if (id === activeId || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await switchActiveAccount(id);
      setOpen(false);
      onChanged?.();
      // Force UI that reads session singletons to re-render.
      window.dispatchEvent(new Event('burnbox-account-changed'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bfox-account-switcher">
      <button
        type="button"
        className="bfox-main-header__addr mono"
        onClick={() => setOpen(v => !v)}
        title={active.address}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {active.label || shortAddress(active.address)}
        <span className="bfox-account-switcher__kind muted">
          {accountKindLabel(active.kind)}
          {accounts.length > 1 ? ' ▾' : ''}
        </span>
      </button>
      {open && accounts.length > 1 ? (
        <ul className="bfox-account-menu" role="listbox">
          {accounts.map(account => (
            <li key={account.id}>
              <button
                type="button"
                className={`bfox-account-menu__item${account.id === activeId ? ' is-active' : ''}`}
                disabled={busy}
                onClick={() => void select(account.id)}
              >
                <span className="bfox-account-menu__label">{account.label}</span>
                <span className="muted mono">
                  {accountKindLabel(account.kind)} · {shortAddress(account.address)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {err ? <p className="error" style={{ margin: '4px 0 0', fontSize: 11 }}>{err}</p> : null}
    </div>
  );
}
