import { useCallback, useEffect, useState } from 'react';
import { getAddress } from 'viem';
import { getUnlockedAccount } from '../lib/accountSession';
import { effectiveActiveChainId, type AppSettings } from '../lib/storageState';
import { chainById } from '../lib/chainCatalog';
import {
  fmtTokenAmount,
  fmtUsdValue,
  invalidateRpcBalanceCache,
  loadWalletBalancesForChain,
  type WalletBalEntry,
} from '../lib/walletBalances';
import { JumpaLiFiIcon } from './JumpaLiFiIcon';

export function WalletHomeView({
  settings,
}: {
  settings: AppSettings;
  onSaved: () => void;
}) {
  const account = getUnlockedAccount();
  const addr = account ? getAddress(account.address) : null;
  const chainId = effectiveActiveChainId(settings);
  const chain = chainById(chainId);

  const [rows, setRows] = useState<WalletBalEntry[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);

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
    void refresh();
  }, [refresh, chainId]);

  return (
    <div className="bfox-home">
      <div className="bfox-home-toolbar">
        <button type="button" className="ghost bfox-refresh-btn" onClick={() => void refresh()} disabled={busy}>
          {busy ? '…' : 'Refresh'}
        </button>
      </div>

      <div className="bfox-token-list-head">
        <span>Tokens on {chain?.name ?? chainId}</span>
      </div>

      {err ? <p className="error bfox-home-error">{err}</p> : null}

      {busy && rows.length === 0 ? (
        <p className="muted bfox-home-loading">Loading balances…</p>
      ) : null}

      {!busy && rows.length === 0 && !err ? (
        <p className="muted bfox-home-empty">No tokens with balance on this network.</p>
      ) : null}

      <ul className="bfox-token-list">
        {rows.map(t => {
          const usd = fmtUsdValue(t);
          return (
            <li key={`${t.chainId}:${t.address}`} className="bfox-token-row">
              <JumpaLiFiIcon logoURI={t.logoURI} label={t.symbol} size={40} rounded />
              <div className="bfox-token-row__meta">
                <span className="bfox-token-row__name">{t.name || t.symbol}</span>
                <span className="bfox-token-row__sym">{t.symbol}</span>
              </div>
              <div className="bfox-token-row__vals">
                <span className="bfox-token-row__usd">{usd ?? '—'}</span>
                <span className="bfox-token-row__amt">
                  {fmtTokenAmount(t)} {t.symbol}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
