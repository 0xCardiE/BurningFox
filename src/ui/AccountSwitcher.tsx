import { useEffect, useState } from 'react';
import {
  getAccountsMeta,
  getActiveAccountId,
  getActiveAccountMeta,
} from '../lib/accountSession';
import { accountKindLabel, shortAddress } from '../lib/accounts';
import { switchActiveAccount } from '../lib/walletManager';

function ChevronDownIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function AccountSwitcher({ onChanged }: { onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const accounts = getAccountsMeta();
  const active = getActiveAccountMeta();
  const activeId = getActiveAccountId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!active || accounts.length === 0) return null;

  async function select(id: string) {
    if (id === activeId || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await switchActiveAccount(id);
      setOpen(false);
      onChanged?.();
      window.dispatchEvent(new Event('burnbox-account-changed'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const canSwitch = accounts.length > 1;

  return (
    <>
      <button
        type="button"
        className={`l33t-acct-trigger${open ? ' l33t-acct-trigger--open' : ''}`}
        onClick={() => setOpen(true)}
        title={active.address}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="l33t-acct-trigger__main">
          <span className="l33t-acct-trigger__label">{active.label || 'Account'}</span>
          <span className="l33t-acct-trigger__sub mono">
            {accountKindLabel(active.kind)} · {shortAddress(active.address)}
          </span>
        </span>
        <span className="l33t-acct-trigger__chev" aria-hidden>
          <ChevronDownIcon />
        </span>
      </button>

      {open ? (
        <div className="l33t-acct-sheet-mount" role="dialog" aria-label="Switch account">
          <button
            type="button"
            className="leet-sheet-backdrop"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div className="l33t-acct-sheet-panel">
            <div className="l33t-acct-sheet-head">
              <strong>Switch account</strong>
              <span className="muted l33t-acct-sheet-count">
                {accounts.length} wallet{accounts.length === 1 ? '' : 's'}
              </span>
            </div>

            <ul className="l33t-acct-sheet-list">
              {accounts.map(account => {
                const selected = account.id === activeId;
                return (
                  <li key={account.id}>
                    <button
                      type="button"
                      className={`l33t-acct-sheet-row${selected ? ' l33t-acct-sheet-row--on' : ''}`}
                      disabled={busy}
                      onClick={() => void select(account.id)}
                    >
                      <span className="l33t-acct-sheet-row__text">
                        <span className="l33t-acct-sheet-row__label">{account.label}</span>
                        <span className="l33t-acct-sheet-row__meta mono">
                          {accountKindLabel(account.kind)} · {shortAddress(account.address)}
                        </span>
                      </span>
                      {selected ? (
                        <span className="l33t-acct-sheet-row__check" aria-hidden>
                          <CheckIcon />
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>

            {!canSwitch ? (
              <p className="muted l33t-acct-sheet-hint">
                Add more accounts in Settings → Wallets.
              </p>
            ) : null}

            {err ? <p className="error l33t-acct-sheet-err">{err}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
