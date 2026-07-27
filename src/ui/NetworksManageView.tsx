import { useMemo, useState } from 'react';
import {
  effectiveActiveChainId,
  patchSettings,
  type AppSettings,
} from '../lib/storageState';
import {
  allChains,
  chainById,
  getCustomChains,
  isCuratedChain,
  type ChainDefinition,
  type ChainKind,
} from '../lib/chainCatalog';
import { chainLogoUri } from '../lib/chainLogo';
import { notifyConnectedTabsChainChanged } from '../lib/chainSyncBridge';
import { allRpcOptionsFor } from '../lib/chainRpcRegistry';
import { describeError } from '../lib/utils';
import { JumpaLiFiIcon } from './JumpaLiFiIcon';
import { ScreenHeader } from './ScreenHeader';

type Panel = 'list' | 'detail' | 'add';

function shortRpcLabel(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === '/' ? '' : u.pathname;
    return `${u.host}${path}`;
  } catch {
    return url;
  }
}

function slugify(name: string, chainId: number): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  return s || `chain-${chainId}`;
}

export function NetworksManageView({
  settings,
  onSaved,
  onBack,
}: {
  settings: AppSettings;
  onSaved: () => void;
  onBack: () => void;
}) {
  const activeChainId = effectiveActiveChainId(settings);
  const [panel, setPanel] = useState<Panel>('list');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | ChainKind>('all');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [rpcDraft, setRpcDraft] = useState('');

  const [addName, setAddName] = useState('');
  const [addChainId, setAddChainId] = useState('');
  const [addSymbol, setAddSymbol] = useState('ETH');
  const [addRpcUrl, setAddRpcUrl] = useState('');
  const [addExplorer, setAddExplorer] = useState('');
  const [addKind, setAddKind] = useState<ChainKind>('mainnet');

  const chains = useMemo(() => {
    const list = allChains();
    const filtered =
      filter === 'all' ? list : list.filter(c => c.kind === filter);
    return [...filtered].sort((a, b) => {
      if (a.chainId === activeChainId) return -1;
      if (b.chainId === activeChainId) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [filter, activeChainId, settings.customChains]);

  const selected = selectedId != null ? chainById(selectedId) : undefined;
  const rpcOptions = selectedId != null ? allRpcOptionsFor(selectedId, 20) : [];
  const preferredRpc =
    selectedId != null
      ? settings.preferredRpcByChain?.[String(selectedId)]
      : undefined;
  const userRpcs =
    selectedId != null ? settings.customRpcByChain?.[String(selectedId)] ?? [] : [];

  function openDetail(id: number) {
    setSelectedId(id);
    setRpcDraft('');
    setErr(null);
    setMsg(null);
    setPanel('detail');
  }

  function openAdd() {
    setAddName('');
    setAddChainId('');
    setAddSymbol('ETH');
    setAddRpcUrl('');
    setAddExplorer('');
    setAddKind('mainnet');
    setErr(null);
    setMsg(null);
    setPanel('add');
  }

  async function useNetwork(chainId: number) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await patchSettings({ activeChainId: chainId });
      await notifyConnectedTabsChainChanged(chainId);
      onSaved();
      setMsg(`Active network: ${chainById(chainId)?.name ?? chainId}`);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function setPreferred(chainId: number, url: string) {
    if (busy || !url.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await patchSettings({
        preferredRpcByChain: {
          ...(settings.preferredRpcByChain ?? {}),
          [String(chainId)]: url.trim(),
        },
      });
      onSaved();
      setMsg('Preferred RPC updated');
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function addCustomRpc(chainId: number) {
    const url = rpcDraft.trim();
    if (!url) return;
    try {
      // basic URL check
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setErr('RPC must be http(s)');
        return;
      }
    } catch {
      setErr('Enter a valid RPC URL');
      return;
    }
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
      setRpcDraft('');
      onSaved();
      setMsg('RPC added');
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeUserRpc(chainId: number, url: string) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const key = String(chainId);
      const list = (settings.customRpcByChain?.[key] ?? []).filter(u => u !== url);
      const preferred = { ...(settings.preferredRpcByChain ?? {}) };
      if (preferred[key] === url) delete preferred[key];
      const customRpcByChain = { ...(settings.customRpcByChain ?? {}) };
      if (list.length) customRpcByChain[key] = list;
      else delete customRpcByChain[key];
      await patchSettings({ customRpcByChain, preferredRpcByChain: preferred });
      onSaved();
      setMsg('RPC removed');
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeCustomChain(chainId: number) {
    if (busy || isCuratedChain(chainId)) return;
    if (!confirm(`Remove custom chain ${chainById(chainId)?.name ?? chainId}?`)) return;
    setBusy(true);
    setErr(null);
    try {
      const customChains = getCustomChains().filter(c => c.chainId !== chainId);
      const preferred = { ...(settings.preferredRpcByChain ?? {}) };
      const customRpc = { ...(settings.customRpcByChain ?? {}) };
      delete preferred[String(chainId)];
      delete customRpc[String(chainId)];
      const patch: AppSettings = {
        customChains,
        preferredRpcByChain: preferred,
        customRpcByChain: customRpc,
      };
      if (effectiveActiveChainId(settings) === chainId) {
        patch.activeChainId = 1;
      }
      await patchSettings(patch);
      if (patch.activeChainId === 1) {
        await notifyConnectedTabsChainChanged(1);
      }
      onSaved();
      setPanel('list');
      setSelectedId(null);
      setMsg('Custom chain removed');
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitAddChain() {
    const name = addName.trim();
    const cid = Number(addChainId.trim());
    const symbol = addSymbol.trim() || 'ETH';
    const rpc = addRpcUrl.trim();
    const explorer = addExplorer.trim();
    if (!name) {
      setErr('Name is required');
      return;
    }
    if (!Number.isFinite(cid) || cid <= 0 || !Number.isInteger(cid)) {
      setErr('Enter a valid numeric chain ID');
      return;
    }
    if (chainById(cid)) {
      setErr(`Chain ${cid} already exists`);
      return;
    }
    if (!rpc) {
      setErr('At least one RPC URL is required');
      return;
    }
    try {
      const parsed = new URL(rpc);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setErr('RPC must be http(s)');
        return;
      }
    } catch {
      setErr('Enter a valid RPC URL');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const def: ChainDefinition = {
        chainId: cid,
        name,
        shortName: slugify(name, cid),
        kind: addKind,
        nativeCurrency: { name: symbol, symbol, decimals: 18 },
        rpcUrls: [rpc],
        blockExplorerUrls: explorer ? [explorer.replace(/\/$/, '')] : [],
      };
      await patchSettings({
        customChains: [...getCustomChains(), def],
        preferredRpcByChain: {
          ...(settings.preferredRpcByChain ?? {}),
          [String(cid)]: rpc,
        },
      });
      onSaved();
      setPanel('list');
      setMsg(`Added ${name}`);
      openDetail(cid);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  const headerBack = () => {
    if (panel === 'list') onBack();
    else {
      setPanel('list');
      setSelectedId(null);
      setErr(null);
    }
  };

  const title =
    panel === 'add'
      ? 'Add chain'
      : panel === 'detail' && selected
        ? selected.name
        : 'Networks';

  return (
    <div className="wallet-shell bfox bfox--networks-manage">
      <ScreenHeader title={title} onClose={headerBack} />
      <div className="screen-body bfox-body bfox-networks">
        {panel === 'list' ? (
          <>
            <p className="muted bfox-networks__lead">
              Manage chains and RPC endpoints. Active network stays on the Assets tab.
            </p>

            <div className="bfox-networks__toolbar">
              <div className="bfox-networks__filters" role="group" aria-label="Filter chains">
                {(
                  [
                    ['all', 'All'],
                    ['mainnet', 'Mainnets'],
                    ['testnet', 'Testnets'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={
                      filter === value
                        ? 'bfox-networks__chip bfox-networks__chip--on'
                        : 'bfox-networks__chip'
                    }
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button type="button" className="ghost bfox-networks__add-btn" onClick={openAdd}>
                Add chain
              </button>
            </div>

            <ul className="bfox-networks__list">
              {chains.map(c => {
                const active = c.chainId === activeChainId;
                const custom = !isCuratedChain(c.chainId);
                return (
                  <li key={c.chainId}>
                    <button
                      type="button"
                      className={
                        active
                          ? 'bfox-networks__row bfox-networks__row--active'
                          : 'bfox-networks__row'
                      }
                      onClick={() => openDetail(c.chainId)}
                    >
                      <JumpaLiFiIcon
                        logoURI={chainLogoUri(c)}
                        label={c.name}
                        size={28}
                        rounded
                      />
                      <span className="bfox-networks__row-text">
                        <span className="bfox-networks__row-name">
                          {c.name}
                          {custom ? (
                            <span className="bfox-networks__badge">Custom</span>
                          ) : null}
                          {active ? (
                            <span className="bfox-networks__badge bfox-networks__badge--on">
                              Active
                            </span>
                          ) : null}
                        </span>
                        <span className="bfox-networks__row-sub muted">
                          Chain ID {c.chainId}
                          {c.kind === 'testnet' ? ' · Testnet' : ''}
                        </span>
                      </span>
                      <span className="bfox-networks__chev" aria-hidden>
                        ›
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}

        {panel === 'detail' && selected ? (
          <>
            <div className="bfox-networks__detail-head">
              <JumpaLiFiIcon
                logoURI={chainLogoUri(selected)}
                label={selected.name}
                size={36}
                rounded
              />
              <div>
                <p className="bfox-networks__detail-name">{selected.name}</p>
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                  ID {selected.chainId} · {selected.nativeCurrency.symbol}
                  {!isCuratedChain(selected.chainId) ? ' · Custom' : ''}
                </p>
              </div>
            </div>

            {selected.chainId !== activeChainId ? (
              <button
                type="button"
                className="primary"
                style={{ width: '100%', marginBottom: 14 }}
                disabled={busy}
                onClick={() => void useNetwork(selected.chainId)}
              >
                Use this network
              </button>
            ) : (
              <p className="muted bfox-networks__active-note">Currently active in wallet &amp; dapps</p>
            )}

            <h3 className="bfox-networks__section-title">RPC endpoints</h3>
            <ul className="bfox-networks__rpc-list">
              {rpcOptions.map(url => {
                const isPreferred = preferredRpc ? preferredRpc === url : url === rpcOptions[0];
                const isUser = userRpcs.includes(url);
                return (
                  <li key={url} className="bfox-networks__rpc-row">
                    <button
                      type="button"
                      className={
                        isPreferred
                          ? 'bfox-networks__rpc-pick bfox-networks__rpc-pick--on'
                          : 'bfox-networks__rpc-pick'
                      }
                      disabled={busy}
                      onClick={() => void setPreferred(selected.chainId, url)}
                      title={url}
                    >
                      <span className="bfox-networks__rpc-label">{shortRpcLabel(url)}</span>
                      {isPreferred ? (
                        <span className="bfox-networks__badge bfox-networks__badge--on">Preferred</span>
                      ) : null}
                    </button>
                    {isUser ? (
                      <button
                        type="button"
                        className="ghost bfox-networks__rpc-remove"
                        disabled={busy}
                        aria-label="Remove RPC"
                        onClick={() => void removeUserRpc(selected.chainId, url)}
                      >
                        ×
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <label htmlFor="net-add-rpc" className="bfox-networks__section-title" style={{ display: 'block' }}>
              Add RPC
            </label>
            <div className="row" style={{ marginBottom: 8 }}>
              <input
                id="net-add-rpc"
                value={rpcDraft}
                onChange={e => setRpcDraft(e.target.value)}
                placeholder="https://…"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="ghost"
                disabled={busy || !rpcDraft.trim()}
                onClick={() => void addCustomRpc(selected.chainId)}
              >
                Add
              </button>
            </div>

            {!isCuratedChain(selected.chainId) ? (
              <button
                type="button"
                className="danger"
                style={{ width: '100%', marginTop: 18 }}
                disabled={busy}
                onClick={() => void removeCustomChain(selected.chainId)}
              >
                Remove custom chain
              </button>
            ) : null}
          </>
        ) : null}

        {panel === 'add' ? (
          <>
            <p className="muted bfox-networks__lead">
              Add a custom EVM network. It appears in the chain picker alongside curated networks.
            </p>

            <label htmlFor="add-name">Name</label>
            <input
              id="add-name"
              value={addName}
              onChange={e => setAddName(e.target.value)}
              placeholder="My Chain"
            />

            <label htmlFor="add-id" style={{ marginTop: 12 }}>
              Chain ID
            </label>
            <input
              id="add-id"
              value={addChainId}
              onChange={e => setAddChainId(e.target.value)}
              placeholder="100"
              inputMode="numeric"
            />

            <label htmlFor="add-symbol" style={{ marginTop: 12 }}>
              Native symbol
            </label>
            <input
              id="add-symbol"
              value={addSymbol}
              onChange={e => setAddSymbol(e.target.value)}
              placeholder="ETH"
            />

            <label htmlFor="add-kind" style={{ marginTop: 12 }}>
              Network type
            </label>
            <select
              id="add-kind"
              value={addKind}
              onChange={e => setAddKind(e.target.value as ChainKind)}
            >
              <option value="mainnet">Mainnet</option>
              <option value="testnet">Testnet</option>
            </select>

            <label htmlFor="add-rpc" style={{ marginTop: 12 }}>
              RPC URL
            </label>
            <input
              id="add-rpc"
              value={addRpcUrl}
              onChange={e => setAddRpcUrl(e.target.value)}
              placeholder="https://…"
            />

            <label htmlFor="add-explorer" style={{ marginTop: 12 }}>
              Block explorer (optional)
            </label>
            <input
              id="add-explorer"
              value={addExplorer}
              onChange={e => setAddExplorer(e.target.value)}
              placeholder="https://…"
            />

            <button
              type="button"
              className="primary"
              style={{ width: '100%', marginTop: 16 }}
              disabled={busy}
              onClick={() => void submitAddChain()}
            >
              {busy ? '…' : 'Add chain'}
            </button>
          </>
        ) : null}

        {msg ? (
          <p className="muted" style={{ color: 'var(--ok)', marginTop: 12 }}>
            {msg}
          </p>
        ) : null}
        {err ? <p className="error">{err}</p> : null}
      </div>
    </div>
  );
}
