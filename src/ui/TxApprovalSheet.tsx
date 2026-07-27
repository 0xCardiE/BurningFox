import { useCallback, useEffect, useState } from 'react';
import { chainById } from '../lib/chainCatalog';
import {
  fetchPendingApprovals,
  resolvePendingApproval,
} from '../lib/approvalBridge';
import type { PendingApproval } from '../lib/pendingApprovals';

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

  const { summary } = pending;
  const chainName = chainById(pending.chainId)?.name;

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
            {summary.title}
          </h2>
        </div>

        <div className="bfox-tx-approval__body">
          {summary.hostname ? (
            <p className="bfox-tx-approval__site">
              Request from <strong>{summary.hostname}</strong>
            </p>
          ) : null}
          {chainName ? (
            <p className="bfox-tx-approval__chain muted">Network · {chainName}</p>
          ) : null}

          <dl className="bfox-tx-approval__fields">
            {summary.fields.map(field => (
              <div key={field.label} className="bfox-tx-approval__field">
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>

          {err ? <p className="error">{err}</p> : null}
        </div>

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
