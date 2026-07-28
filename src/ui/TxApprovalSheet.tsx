import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAddress } from 'viem';
import { getUnlockedAccount } from '../lib/accountSession';
import {
  approvalTitle,
  buildApprovalDetailSections,
  mergeFunctionSignatureLookup,
  mergeGasPreview,
  needsFunctionSignatureLookup,
  selectorFromData,
  type ApprovalDetailField,
  type ApprovalDetailSection,
  type FunctionSignatureLookup,
  type TxGasPreview,
} from '../lib/approvalDetails';
import { lookupFunctionSelectors } from '../lib/fourByteDirectory';
import { chainById } from '../lib/chainCatalog';
import { chainJsonRpcCall } from '../lib/ethereum';
import {
  fetchPendingApprovals,
  resolvePendingApproval,
} from '../lib/approvalBridge';
import type { PendingApproval } from '../lib/pendingApprovals';

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  }

  return (
    <button type="button" className="bfox-tx-approval__copy" onClick={() => void onCopy()}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function DetailField({ f }: { f: ApprovalDetailField }) {
  return (
    <div className={`bfox-tx-approval__field${f.warn ? ' bfox-tx-approval__field--warn' : ''}`}>
      <dt>{f.label}</dt>
      <dd className={f.mono ? 'bfox-tx-approval__mono' : undefined}>
        <span className="bfox-tx-approval__value">{f.value}</span>
        {f.copyable ? <CopyBtn text={f.value} /> : null}
      </dd>
    </div>
  );
}

function DetailSection({ section }: { section: ApprovalDetailSection }) {
  const [open, setOpen] = useState(section.defaultOpen ?? false);

  return (
    <section className="bfox-tx-approval__section">
      <button
        type="button"
        className="bfox-tx-approval__section-head"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <span>{section.title}</span>
        <span className="bfox-tx-approval__chev" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? (
        <dl className="bfox-tx-approval__fields">
          {section.fields.map(field => (
            <DetailField key={`${section.id}-${field.label}`} f={field} />
          ))}
        </dl>
      ) : null}
    </section>
  );
}

async function fetchTxGasPreview(
  chainId: number,
  tx: Record<string, unknown>,
  from: string,
): Promise<TxGasPreview> {
  const preview: TxGasPreview = {};
  try {
    preview.pendingNonce = String(
      Number.parseInt(
        await chainJsonRpcCall<string>(chainId, 'eth_getTransactionCount', [from, 'pending']),
        16,
      ),
    );
  } catch (e) {
    preview.error = e instanceof Error ? e.message : String(e);
  }

  try {
    const to = typeof tx.to === 'string' ? tx.to : undefined;
    const data = typeof tx.data === 'string' ? tx.data : '0x';
    const value = typeof tx.value === 'string' ? tx.value : '0x0';
    const gasHex = await chainJsonRpcCall<string>(chainId, 'eth_estimateGas', [
      { from, to, data, value },
    ]);
    preview.estimatedGas = String(Number.parseInt(gasHex, 16));
  } catch (e) {
    if (!preview.error) {
      preview.error = e instanceof Error ? e.message : String(e);
    }
  }

  try {
    const gasPriceHex = await chainJsonRpcCall<string>(chainId, 'eth_gasPrice', []);
    preview.suggestedGasPrice = String(BigInt(gasPriceHex));
  } catch {
    /* optional */
  }

  if (typeof tx.to === 'string' && tx.to.startsWith('0x')) {
    try {
      const code = await chainJsonRpcCall<string>(chainId, 'eth_getCode', [tx.to, 'latest']);
      preview.isContract = code !== '0x' && code !== '0x0';
    } catch {
      /* optional */
    }
  }

  return preview;
}

function ApprovalContent({ pending }: { pending: PendingApproval }) {
  const account = getUnlockedAccount();
  const walletAddress = account ? getAddress(account.address) : undefined;
  const chain = chainById(pending.chainId);
  const [gasPreview, setGasPreview] = useState<TxGasPreview | null>(null);
  const [sigLookup, setSigLookup] = useState<FunctionSignatureLookup | null>(null);

  const sections = useMemo(() => {
    let built = buildApprovalDetailSections(
      pending.request,
      pending.chainId,
      walletAddress,
    );
    if (gasPreview) {
      built = mergeGasPreview(built, gasPreview, pending.chainId);
    }
    if (sigLookup) {
      built = mergeFunctionSignatureLookup(built, sigLookup);
    }
    return built;
  }, [pending.request, pending.chainId, walletAddress, gasPreview, sigLookup]);

  useEffect(() => {
    if (pending.request.method !== 'eth_sendTransaction' || !walletAddress) {
      setGasPreview(null);
      return;
    }
    const tx = (pending.request.params?.[0] ?? {}) as Record<string, unknown>;
    let cancelled = false;
    void fetchTxGasPreview(pending.chainId, tx, walletAddress).then(p => {
      if (!cancelled) setGasPreview(p);
    });
    return () => {
      cancelled = true;
    };
  }, [pending.id, pending.request, pending.chainId, walletAddress]);

  useEffect(() => {
    if (!needsFunctionSignatureLookup(pending.request)) {
      setSigLookup(null);
      return;
    }
    const tx = (pending.request.params?.[0] ?? {}) as Record<string, unknown>;
    const data = typeof tx.data === 'string' ? tx.data : undefined;
    const selector = data ? selectorFromData(data) : undefined;
    if (!selector) {
      setSigLookup(null);
      return;
    }

    setSigLookup({ status: 'loading' });
    let cancelled = false;
    void lookupFunctionSelectors(selector).then(signatures => {
      if (!cancelled) setSigLookup({ status: 'done', signatures });
    });
    return () => {
      cancelled = true;
    };
  }, [pending.id, pending.request]);

  const hostname = pending.summary.hostname;

  return (
    <>
      <div className="bfox-tx-approval__body">
        {hostname ? (
          <p className="bfox-tx-approval__site">
            Request from <strong>{hostname}</strong>
            {pending.origin ? (
              <span className="bfox-tx-approval__origin muted"> · {pending.origin}</span>
            ) : null}
          </p>
        ) : null}
        {chain ? (
          <p className="bfox-tx-approval__chain muted">
            Network · {chain.name} (chainId {pending.chainId})
          </p>
        ) : null}

        <p className="bfox-tx-approval__dev-note muted">
          Developer view — inspect gas, calldata, and raw RPC params before signing.
        </p>

        <div className="bfox-tx-approval__sections">
          {sections.map(section => (
            <DetailSection key={section.id} section={section} />
          ))}
        </div>
      </div>
    </>
  );
}

export function TxApprovalSheet() {
  const [pending, setPending] = useState<PendingApproval | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const list = await fetchPendingApprovals();
    setPending(list[0] ?? null);
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 600);
    return () => window.clearInterval(id);
  }, [refresh]);

  if (!pending) return null;

  const title = approvalTitle(pending.request);

  async function onDecision(approved: boolean) {
    if (!pending || busy) return;
    setBusy(true);
    setErr(null);
    const res = await resolvePendingApproval(pending.id, approved);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? 'Could not resolve request');
      return;
    }
    await refresh();
  }

  return (
    <div className="jumpa-sheet-mount bfox-tx-approval">
      <div className="jumpa-sheet-backdrop" aria-hidden />
      <div
        className="jumpa-sheet-panel bfox-tx-approval__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tx-approval-title"
      >
        <div className="jumpa-sheet-head">
          <h2 id="tx-approval-title" className="jumpa-sheet-h2">
            {title}
          </h2>
        </div>

        <ApprovalContent pending={pending} />

        {err ? <p className="error bfox-tx-approval__err">{err}</p> : null}

        <div className="bfox-tx-approval__actions">
          <button
            type="button"
            className="bfox-tx-approval__reject"
            disabled={busy}
            onClick={() => void onDecision(false)}
          >
            Reject
          </button>
          <button
            type="button"
            className="bfox-tx-approval__approve"
            disabled={busy}
            onClick={() => void onDecision(true)}
          >
            {busy ? 'Confirming…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
