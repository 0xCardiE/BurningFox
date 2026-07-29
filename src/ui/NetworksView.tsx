import { useCallback, useEffect, useState } from 'react';
import { formatUnits, getAddress, isAddress, parseUnits } from 'viem';
import { getUnlockedAccount } from '../lib/accountSession';
import {
  effectiveActiveChainId,
  patchSettings,
  type AppSettings,
} from '../lib/storageState';
import { CHAIN_CATALOG, chainById } from '../lib/chainCatalog';
import { allRpcOptionsFor } from '../lib/chainRpcRegistry';
import { getNativeBalance, erc20BalanceOf } from '../lib/ethereum';
import { describeError } from '../lib/utils';
import { ScreenHeader } from './ScreenHeader';

export function NetworksView({
  settings,
  onOpenSettings,
  onSaved,
}: {
  settings: AppSettings;
  onOpenSettings: () => void;
  onSaved: () => void;
}) {
  const account = getUnlockedAccount();
  const addr = account ? getAddress(account.address) : null;
  const activeChainId = effectiveActiveChainId(settings);
  const activeChain = chainById(activeChainId);

  const [chainId, setChainId] = useState(activeChainId);
  const [rpcUrl, setRpcUrl] = useState('');
  const [customRpc, setCustomRpc] = useState('');
  const [nativeBal, setNativeBal] = useState<string | null>(null);
  const [tokenAddr, setTokenAddr] = useState('');
  const [tokenBal, setTokenBal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const rpcOptions = allRpcOptionsFor(chainId);

  useEffect(() => {
    setChainId(activeChainId);
  }, [activeChainId]);

  useEffect(() => {
    const preferred = settings.preferredRpcByChain?.[String(chainId)];
    const opts = allRpcOptionsFor(chainId);
    setRpcUrl(preferred && opts.includes(preferred) ? preferred : opts[0] ?? '');
  }, [chainId, settings.preferredRpcByChain]);

  const refreshBalances = useCallback(async () => {
    if (!addr) return;
    setErr(null);
    setNativeBal(null);
    setTokenBal(null);
    try {
      const native = await getNativeBalance(addr, chainId);
      const sym = chainById(chainId)?.nativeCurrency.symbol ?? 'ETH';
      setNativeBal(`${formatUnits(native, 18)} ${sym}`);
      if (tokenAddr.trim() && isAddress(tokenAddr.trim())) {
        const t = getAddress(tokenAddr.trim());
        const bal = await erc20BalanceOf(chainId, t, addr);
        setTokenBal(bal.toString());
      }
    } catch (e) {
      setErr(describeError(e));
    }
  }, [addr, chainId, tokenAddr]);

  useEffect(() => {
    void refreshBalances();
  }, [refreshBalances]);

  async function applyNetwork() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const patch: AppSettings = { activeChainId: chainId };
      if (rpcUrl.trim()) {
        patch.preferredRpcByChain = {
          ...(settings.preferredRpcByChain ?? {}),
          [String(chainId)]: rpcUrl.trim(),
        };
      }
      await patchSettings(patch);
      onSaved();
      setMsg(`Switched to ${chainById(chainId)?.name ?? chainId}`);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function addCustomRpc() {
    const url = customRpc.trim();
    if (!url) return;
    setBusy(true);
    setErr(null);
    try {
      const key = String(chainId);
      const list = [...(settings.customRpcByChain?.[key] ?? [])];
      if (!list.includes(url)) list.push(url);
      await patchSettings({
        customRpcByChain: {
          ...(settings.customRpcByChain ?? {}),
          [key]: list,
        },
        preferredRpcByChain: {
          ...(settings.preferredRpcByChain ?? {}),
          [key]: url,
        },
      });
      setCustomRpc('');
      setRpcUrl(url);
      onSaved();
      setMsg('Custom RPC added');
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  const settingsBtn = (
    <button
      type="button"
      className="l33t-icon-head"
      onClick={onOpenSettings}
      aria-label="Settings"
    >
      ⚙
    </button>
  );

  return (
    <div className="wallet-shell l33t l33t--networks">
      <ScreenHeader title="Networks" trailing={settingsBtn} />
      <div className="screen-body l33t-body">
        <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
          Developer network switcher with pre-filled public RPCs (chainlist-style). Pick a chain,
          choose an endpoint, refresh balances.
        </p>

        <label htmlFor="net-chain">Chain</label>
        <select
          id="net-chain"
          value={chainId}
          onChange={e => setChainId(Number(e.target.value))}
        >
          {CHAIN_CATALOG.map(c => (
            <option key={c.chainId} value={c.chainId}>
              {c.name} ({c.chainId})
            </option>
          ))}
        </select>

        <label htmlFor="net-rpc" style={{ marginTop: 12 }}>
          RPC endpoint
        </label>
        <select
          id="net-rpc"
          value={rpcUrl}
          onChange={e => setRpcUrl(e.target.value)}
        >
          {rpcOptions.map(u => (
            <option key={u} value={u}>
              {u.length > 52 ? `${u.slice(0, 49)}…` : u}
            </option>
          ))}
        </select>

        <label htmlFor="net-custom" style={{ marginTop: 12 }}>
          Add custom RPC
        </label>
        <div className="row">
          <input
            id="net-custom"
            value={customRpc}
            onChange={e => setCustomRpc(e.target.value)}
            placeholder="https://…"
            style={{ flex: 1 }}
          />
          <button type="button" className="ghost" disabled={busy} onClick={() => void addCustomRpc()}>
            Add
          </button>
        </div>

        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            className="primary"
            style={{ width: '100%' }}
            disabled={busy}
            onClick={() => void applyNetwork()}
          >
            {busy ? '…' : 'Use this network'}
          </button>
        </div>

        <hr className="sep" style={{ margin: '18px 0' }} />

        <h3 style={{ fontSize: '0.95rem' }}>Balances on {activeChain?.name ?? activeChainId}</h3>
        {addr ? (
          <>
            <p className="mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>
              {addr}
            </p>
            <p>
              Native: <strong>{nativeBal ?? '…'}</strong>
            </p>
            <label htmlFor="tok-addr">ERC-20 token address (optional)</label>
            <input
              id="tok-addr"
              value={tokenAddr}
              onChange={e => setTokenAddr(e.target.value)}
              placeholder="0x…"
            />
            {tokenBal != null ? (
              <p>
                Token balance (raw): <strong>{tokenBal}</strong>
              </p>
            ) : null}
            <button type="button" className="ghost" onClick={() => void refreshBalances()}>
              Refresh balances
            </button>
          </>
        ) : (
          <p className="error">Unlock wallet to view balances.</p>
        )}

        {msg ? <p className="muted" style={{ color: 'var(--ok)' }}>{msg}</p> : null}
        {err ? <p className="error">{err}</p> : null}
      </div>
    </div>
  );
}
