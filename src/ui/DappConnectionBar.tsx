import {
  connectActiveTab,
  disconnectActiveTab,
  fetchDappConnectionStatus,
  type DappConnectionStatus,
} from '../lib/dappConnectionBridge';
import { chainById } from '../lib/chainCatalog';
import { effectiveActiveChainId, type AppSettings } from '../lib/storageState';
import { isUnlocked } from '../lib/accountSession';
import { useCallback, useEffect, useState } from 'react';
import { TxConfirmModeToggle } from './TxConfirmModeBar';

function SiteIcon({ favIconUrl, label, connected }: { favIconUrl?: string; label: string; connected: boolean }) {
  const letter = label.trim().charAt(0).toUpperCase() || '?';
  return (
    <span className="bfox-dapp-bar__icon-wrap">
      {favIconUrl ? (
        <img className="bfox-dapp-bar__icon" src={favIconUrl} alt="" draggable={false} />
      ) : (
        <span className="bfox-dapp-bar__icon bfox-dapp-bar__icon--fallback">{letter}</span>
      )}
      {connected ? <span className="bfox-dapp-bar__dot" aria-hidden /> : null}
    </span>
  );
}

export function DappConnectionBar({
  settings,
  onSaved,
}: {
  settings: AppSettings;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<DappConnectionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const chainName = chainById(effectiveActiveChainId(settings))?.name;

  const refresh = useCallback(async () => {
    const next = await fetchDappConnectionStatus();
    setStatus(next);
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 2500);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  async function onConnect() {
    if (!isUnlocked()) {
      setErr('Unlock the wallet first');
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await connectActiveTab();
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? 'Connect failed');
      return;
    }
    await refresh();
  }

  async function onDisconnect() {
    setBusy(true);
    setErr(null);
    const res = await disconnectActiveTab();
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? 'Disconnect failed');
      return;
    }
    await refresh();
  }

  const tab = status?.tab;
  const connected = status?.connected === true;
  const canConnect = status?.canConnect === true;

  return (
    <footer className="bfox-dapp-bar" aria-label="Website connection">
      <div className="bfox-dapp-bar__site">
        {connected && tab ? (
          <>
            <SiteIcon favIconUrl={tab.favIconUrl} label={tab.hostname} connected />
            <span className="bfox-dapp-bar__meta">
              <span className="bfox-dapp-bar__host">{tab.hostname}</span>
              <span className="bfox-dapp-bar__sub">
                Connected
                {chainName ? ` · ${chainName}` : ''}
              </span>
            </span>
          </>
        ) : canConnect && tab ? (
          <>
            <span className="bfox-dapp-bar__icon-wrap bfox-dapp-bar__icon-wrap--idle">
              <span className="bfox-dapp-bar__icon bfox-dapp-bar__icon--fallback">
                {tab.hostname.charAt(0).toUpperCase()}
              </span>
            </span>
            <span className="bfox-dapp-bar__meta">
              <span className="bfox-dapp-bar__host">Not connected</span>
              <span className="bfox-dapp-bar__sub">{tab.title || tab.hostname}</span>
            </span>
          </>
        ) : (
          <span className="bfox-dapp-bar__meta">
            <span className="bfox-dapp-bar__host">Not connected</span>
            <span className="bfox-dapp-bar__sub">
              {status?.reason ?? 'Open a dapp in your browser tab'}
            </span>
          </span>
        )}
      </div>

      <div className="bfox-dapp-bar__actions">
        <TxConfirmModeToggle settings={settings} onSaved={onSaved} />
        {connected ? (
          <button
            type="button"
            className="bfox-dapp-bar__btn bfox-dapp-bar__btn--disconnect"
            disabled={busy}
            onClick={() => void onDisconnect()}
            aria-label="Disconnect from site"
            title="Disconnect"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        ) : canConnect && tab ? (
          <button
            type="button"
            className="bfox-dapp-bar__btn bfox-dapp-bar__btn--connect"
            disabled={busy || !isUnlocked()}
            onClick={() => void onConnect()}
          >
            {busy ? '…' : 'Connect'}
          </button>
        ) : null}
      </div>

      {err ? <p className="error bfox-dapp-bar__err">{err}</p> : null}
    </footer>
  );
}
