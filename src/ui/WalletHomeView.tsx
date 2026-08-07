import { useCallback, useEffect, useState } from 'react';
import { getAddress } from 'viem';
import { getUnlockedAccount } from '../lib/accountSession';
import { effectiveActiveChainId, type AppSettings } from '../lib/storageState';
import {
  fmtTokenAmount,
  fmtUsdValue,
  invalidateRpcBalanceCache,
  loadWalletBalancesForChain,
  type WalletBalEntry,
} from '../lib/walletBalances';
import { LeetLiFiIcon } from './LeetLiFiIcon';
import { QuickSendInline } from './QuickSendInline';
import { RefreshIconButton } from './RefreshIconButton';

function tokenRowKey(t: WalletBalEntry): string {
  return `${t.chainId}:${t.address.toLowerCase()}`;
}

export function WalletHomeView({
  settings,
}: {
  settings: AppSettings;
  onSaved: () => void;
}) {
  const account = getUnlockedAccount();
  const addr = account ? getAddress(account.address) : null;
  const chainId = effectiveActiveChainId(settings);

  const [rows, setRows] = useState<WalletBalEntry[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!addr) return;
    setBusy(true);
    setErr(null);
    try {
      const { rows: next, error } = await loadWalletBalancesForChain(addr, chainId, {
        refreshRpc: true,
      });
      setRows(next);
      setErr(error);
    } finally {
      setBusy(false);
    }
  }, [addr, chainId]);

  useEffect(() => {
    invalidateRpcBalanceCache(chainId);
    setExpandedKey(null);
    void refresh();
  }, [refresh, chainId]);

  function toggleSend(t: WalletBalEntry) {
    const key = tokenRowKey(t);
    setExpandedKey(prev => (prev === key ? null : key));
  }

  return (
    <div className="l33t-home">
      <div className="l33t-home-refresh-row">
        <RefreshIconButton
          busy={busy}
          ariaLabel="Refresh balances"
          onClick={() => void refresh()}
        />
      </div>

      {err ? <p className="error l33t-home-error">{err}</p> : null}

      {busy && rows.length === 0 ? (
        <p className="muted l33t-home-loading">Loading balances…</p>
      ) : null}

      {!busy && rows.length === 0 && !err ? (
        <p className="muted l33t-home-empty">No tokens with balance on this network.</p>
      ) : null}

      <ul className="l33t-token-list">
        {rows.map(t => {
          const usd = fmtUsdValue(t);
          const key = tokenRowKey(t);
          const open = expandedKey === key;
          return (
            <li key={key} className={`l33t-token-item${open ? ' l33t-token-item--open' : ''}`}>
              <button
                type="button"
                className="l33t-token-row l33t-token-row--action"
                aria-expanded={open}
                onClick={() => toggleSend(t)}
              >
                <LeetLiFiIcon logoURI={t.logoURI} label={t.symbol} size={40} rounded />
                <div className="l33t-token-row__meta">
                  <span className="l33t-token-row__name">{t.name || t.symbol}</span>
                  <span className="l33t-token-row__sym">{t.symbol}</span>
                </div>
                <div className="l33t-token-row__vals">
                  <span className="l33t-token-row__usd">{usd ?? '—'}</span>
                  <span className="l33t-token-row__amt">
                    {fmtTokenAmount(t)} {t.symbol}
                  </span>
                </div>
                <span className="l33t-token-row__toggle" aria-hidden>
                  {open ? '−' : '+'}
                </span>
              </button>
              {open ? (
                <QuickSendInline
                  key={key}
                  token={t}
                  chainId={chainId}
                  settings={settings}
                  onCollapse={() => setExpandedKey(null)}
                  onSent={() => void refresh()}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
