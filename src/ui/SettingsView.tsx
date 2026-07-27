import { useEffect, useRef, useState } from 'react';
import { getAddress } from 'viem';
import { getUnlockedAccount } from '../lib/accountSession';
import {
  lockWallet,
  reopenWalletSurfaceAfterModeChange,
  syncToolbarOpenModeNow,
} from '../lib/sessionBridge';
import {
  patchSettings,
  effectiveSlippagePercent,
  effectiveAutoLockMinutes,
  effectiveToolbarOpenMode,
  parseSlippageInput,
  setVault,
  type AppSettings,
  type ToolbarOpenMode,
} from '../lib/storageState';
import { describeError } from '../lib/utils';
import { ScreenHeader } from './ScreenHeader';

export function SettingsView({
  settings,
  onSaved,
  onBack,
  onOpenNetworks,
}: {
  settings: AppSettings;
  onSaved: () => void;
  onBack: () => void;
  onOpenNetworks?: () => void;
}) {
  const [slippageStr, setSlippageStr] = useState(() =>
    String(effectiveSlippagePercent(settings)),
  );
  const [autoLockM, setAutoLockM] = useState(() =>
    String(effectiveAutoLockMinutes(settings) || 0),
  );
  const sidePanelSupported =
    typeof chrome !== 'undefined' &&
    typeof chrome.sidePanel?.setPanelBehavior === 'function';

  const [openMode, setOpenMode] = useState<ToolbarOpenMode>(() => {
    const m = effectiveToolbarOpenMode(settings);
    return !sidePanelSupported && m === 'side_panel' ? 'popup' : m;
  });
  const [replaceMetaMask, setReplaceMetaMask] = useState(
    () => settings.replaceMetaMask !== false,
  );
  const [explorerApiKey, setExplorerApiKey] = useState(() => settings.explorerApiKey ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copyFlash, setCopyFlash] = useState<'addr' | 'pk' | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const account = getUnlockedAccount();
  const walletAddress = account ? getAddress(account.address) : null;
  const walletPublicKey = account?.publicKey ?? null;

  async function copyWalletField(kind: 'addr' | 'pk', text: string) {
    try {
      setErr(null);
      await navigator.clipboard.writeText(text);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      setCopyFlash(kind);
      copyTimerRef.current = window.setTimeout(() => setCopyFlash(null), 2000);
    } catch {
      setErr('Could not copy — check extension clipboard permission.');
    }
  }

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setSlippageStr(String(effectiveSlippagePercent(settings)));
    setAutoLockM(String(effectiveAutoLockMinutes(settings) || 0));
    const m = effectiveToolbarOpenMode(settings);
    setOpenMode(!sidePanelSupported && m === 'side_panel' ? 'popup' : m);
    setReplaceMetaMask(settings.replaceMetaMask !== false);
    setExplorerApiKey(settings.explorerApiKey ?? '');
  }, [
    settings.slippagePercent,
    settings.autoLockMinutes,
    settings.toolbarOpenMode,
    settings.replaceMetaMask,
    settings.explorerApiKey,
    sidePanelSupported,
  ]);

  async function save() {
    setErr(null);
    const slipParsed = parseSlippageInput(slippageStr);
    if (slipParsed === null) {
      setErr('Enter a valid slippage between 0.01 and 50%.');
      return;
    }
    setBusy(true);
    try {
      const previousMode = effectiveToolbarOpenMode(settings);
      const lockMin = Number(autoLockM);
      const allowedLock = [0, 5, 15, 30, 60];
      const autoLockMinutes =
        allowedLock.includes(lockMin) && lockMin > 0 ? lockMin : undefined;
      await patchSettings({
        slippagePercent: slipParsed,
        autoLockMinutes,
        toolbarOpenMode: openMode,
        replaceMetaMask,
        explorerApiKey: explorerApiKey.trim() || undefined,
      });
      await syncToolbarOpenModeNow();
      onSaved();
      if (openMode !== previousMode) {
        await reopenWalletSurfaceAfterModeChange(openMode);
        return;
      }
      onBack();
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function lock() {
    await lockWallet();
    onBack();
  }

  async function wipe() {
    if (
      !confirm(
        'Remove encrypted vault from this browser? Funds are on-chain — save your recovery key elsewhere first.',
      )
    ) {
      return;
    }
    await setVault(null);
    await lockWallet();
    window.location.reload();
  }

  return (
    <div className="wallet-shell bfox">
      <ScreenHeader title="Settings" onClose={onBack} />
      <div className="screen-body settings-panel">
        <div className="settings-body">
          {walletAddress ? (
            <div
              className="muted"
              style={{
                marginBottom: 18,
                padding: 10,
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              <strong style={{ color: 'var(--text)' }}>Wallet</strong>

              <p style={{ margin: '10px 0 4px' }} className="mono">
                {walletAddress}
              </p>
              <div className="row" style={{ marginBottom: 6 }}>
                <p className="muted" style={{ fontSize: 11, margin: 0, flex: '1 1 auto' }}>
                  Your address on EVM chains — use this to receive funds.
                </p>
                <button
                  type="button"
                  className="ghost"
                  style={{ flex: '0 0 auto', padding: '6px 12px', fontSize: 12 }}
                  onClick={() => void copyWalletField('addr', walletAddress)}
                >
                  {copyFlash === 'addr' ? 'Copied' : 'Copy'}
                </button>
              </div>

              {walletPublicKey ? (
                <>
                  <label style={{ marginTop: 10, marginBottom: 4 }} htmlFor="wallet-pubkey">
                    Public key (hex)
                  </label>
                  <p
                    id="wallet-pubkey"
                    className="mono"
                    style={{
                      margin: '4px 0 6px',
                      fontSize: 10,
                      wordBreak: 'break-all',
                      opacity: 0.95,
                    }}
                  >
                    {walletPublicKey}
                  </p>
                  <div className="row" style={{ marginBottom: 0 }}>
                    <p className="muted" style={{ fontSize: 11, margin: 0, flex: '1 1 auto' }}>
                      Uncompressed secp256k1 key; your address is derived from this.
                    </p>
                    <button
                      type="button"
                      className="ghost"
                      style={{ flex: '0 0 auto', padding: '6px 12px', fontSize: 12 }}
                      onClick={() => void copyWalletField('pk', walletPublicKey)}
                    >
                      {copyFlash === 'pk' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          <label htmlFor="slip">Slippage (%)</label>
          <input
            id="slip"
            type="number"
            min={0.01}
            max={50}
            step={0.05}
            value={slippageStr}
            onChange={(e) => setSlippageStr(e.target.value)}
          />
          <p className="muted" style={{ fontSize: 12 }}>
            Sent to Li.FI as a ratio (example: 5% → 0.05). Used when requesting quotes.
          </p>

          {onOpenNetworks ? (
            <div className="bfox-settings-link-card">
              <div>
                <strong>Networks &amp; RPCs</strong>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
                  Add custom chains and manage RPC endpoints — kept separate from these settings.
                </p>
              </div>
              <button type="button" className="ghost" onClick={onOpenNetworks}>
                Open
              </button>
            </div>
          ) : null}

          <label htmlFor="autolock" style={{ marginTop: 16 }}>
            Auto-lock after idle
          </label>
          <select
            id="autolock"
            value={autoLockM}
            onChange={(e) => setAutoLockM(e.target.value)}
          >
            <option value="0">Off</option>
            <option value="5">5 minutes</option>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">60 minutes</option>
          </select>
          <p className="muted" style={{ fontSize: 12 }}>
            Locks while the wallet UI is open but inactive. Uses the extension service worker clock.
          </p>

          <label htmlFor="openmode" style={{ marginTop: 16 }}>
            Open from toolbar
          </label>
          <select
            id="openmode"
            value={openMode}
            onChange={e => setOpenMode(e.target.value as ToolbarOpenMode)}
          >
            <option value="popup">Popup</option>
            {sidePanelSupported ? (
              <option value="side_panel">Side panel</option>
            ) : null}
          </select>
          <p className="muted" style={{ fontSize: 12 }}>
            {sidePanelSupported
              ? 'Side panel opens Burning Fox in the browser sidebar when you click the extension icon (default).'
              : 'Side panel requires a Chromium browser with side panel support (e.g. Chrome 114+).'}
          </p>

          <label htmlFor="explorer-key" style={{ marginTop: 16 }}>
            Etherscan API key (transaction history)
          </label>
          <input
            id="explorer-key"
            type="password"
            value={explorerApiKey}
            onChange={e => setExplorerApiKey(e.target.value)}
            placeholder="Optional — free at etherscan.io/apis"
            autoComplete="off"
          />
          <p className="muted" style={{ fontSize: 12 }}>
            One Etherscan v2 key loads normal txs on Ethereum, Base, Arbitrum, Optimism, Polygon,
            BSC, and other *scan chains. Blockscout chains work without a key.
          </p>

          <label htmlFor="metamask" style={{ marginTop: 16 }}>
            Dapp connection
          </label>
          <select
            id="metamask"
            value={replaceMetaMask ? 'replace' : 'separate'}
            onChange={e => setReplaceMetaMask(e.target.value === 'replace')}
          >
            <option value="replace">Replace MetaMask (window.ethereum)</option>
            <option value="separate">Separate provider (window.burningFox only)</option>
          </select>
          <p className="muted" style={{ fontSize: 12 }}>
            When enabled, sites that offer MetaMask will connect to Burning Fox instead. Reload open
            tabs after changing this.
          </p>

          <div
            className="muted"
            style={{
              marginTop: 18,
              padding: 10,
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 11,
              lineHeight: 1.45,
            }}
          >
            <strong style={{ color: 'var(--text)' }}>Stored locally</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              <li>
                <code className="mono">chrome.storage.local</code>: encrypted vault and settings.
              </li>
              <li>
                <code className="mono">chrome.storage.session</code>: unlocked session until lock or
                browser restart.
              </li>
              <li>
                Swaps and balances use LI.FI and public RPCs — nothing is sent to a Burning Fox
                server.
              </li>
            </ul>
          </div>

          {err && <p className="error">{err}</p>}
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              className="primary"
              style={{ width: '100%' }}
              disabled={busy}
              onClick={() => void save()}
            >
              {busy ? '…' : 'Save'}
            </button>
          </div>
        </div>

        <div className="settings-wallet-footer">
          <hr className="sep" />
          <div className="row" style={{ marginBottom: 0 }}>
            <button type="button" className="ghost" onClick={() => void lock()}>
              Lock
            </button>
            <button type="button" className="danger" onClick={() => void wipe()}>
              Wipe wallet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
