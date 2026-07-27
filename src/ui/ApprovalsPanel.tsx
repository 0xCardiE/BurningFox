import { useCallback, useEffect, useState } from 'react';
import { encodeFunctionData, formatUnits, getAddress } from 'viem';
import { getUnlockedAccount, getSessionPrivateKey } from '../lib/accountSession';
import { effectiveActiveChainId, type AppSettings } from '../lib/storageState';
import { chainById } from '../lib/chainCatalog';
import {
  isUnlimitedAllowance,
  scanTokenApprovals,
  type ApprovalScanProgress,
  type TokenApprovalRow,
} from '../lib/tokenApprovals';
import { sendTransactionRequest } from '../lib/ethereum';
import { ERC20_ABI } from '../lib/abis';
import { describeError } from '../lib/utils';
import { JumpaLiFiIcon } from './JumpaLiFiIcon';

function fmtAllowance(row: TokenApprovalRow): string {
  if (isUnlimitedAllowance(row.allowance)) return 'Unlimited';
  try {
    return formatUnits(row.allowance, row.tokenDecimals);
  } catch {
    return row.allowance.toString();
  }
}

function progressLabel(p: ApprovalScanProgress | null): string {
  if (!p) return '';
  if (p.phase === 'logs') {
    return `Scanning blocks ${p.fromBlock.toLocaleString()}–${p.toBlock.toLocaleString()} of ${p.latestBlock.toLocaleString()}…`;
  }
  return `Checking allowances ${p.fromBlock}/${p.toBlock}…`;
}

export function ApprovalsPanel({ settings }: { settings: AppSettings }) {
  const account = getUnlockedAccount();
  const addr = account ? getAddress(account.address) : null;
  const chainId = effectiveActiveChainId(settings);
  const chain = chainById(chainId);

  const [rows, setRows] = useState<TokenApprovalRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ApprovalScanProgress | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const scan = useCallback(async () => {
    if (!addr) return;
    setBusy(true);
    setErr(null);
    setProgress(null);
    try {
      const found = await scanTokenApprovals({
        chainId,
        owner: addr,
        onProgress: setProgress,
      });
      setRows(found);
    } catch (e) {
      setErr(describeError(e));
      setRows([]);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [addr, chainId]);

  useEffect(() => {
    setRows([]);
    if (addr) void scan();
  }, [addr, chainId, scan]);

  async function revoke(row: TokenApprovalRow) {
    const pk = getSessionPrivateKey();
    if (!pk || !addr) return;
    const key = `${row.token}:${row.spender}`;
    setRevoking(key);
    setErr(null);
    try {
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [row.spender, 0n],
      });
      await sendTransactionRequest(chainId, {
        to: row.token,
        data,
        value: '0x0',
        from: addr,
        chainId,
      });
      setRows(prev => prev.filter(r => !(r.token === row.token && r.spender === row.spender)));
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="bfox-approvals">
      <p className="muted bfox-approvals-hint">
        Scans <strong>Approval</strong> events via public RPC on {chain?.name ?? chainId}, then
        reads current on-chain allowances. May miss very old approvals if the RPC block range is
        limited — use a block explorer for a full audit.
      </p>

      <div className="row" style={{ marginBottom: 10 }}>
        <button type="button" className="ghost" disabled={busy || !addr} onClick={() => void scan()}>
          {busy ? 'Scanning…' : 'Rescan'}
        </button>
      </div>

      {progress ? <p className="muted bfox-approvals-progress">{progressLabel(progress)}</p> : null}
      {err ? <p className="error">{err}</p> : null}

      {!busy && rows.length === 0 && !err ? (
        <p className="bfox-tools-empty muted">No active token approvals found on this network.</p>
      ) : null}

      <ul className="bfox-approval-list">
        {rows.map(row => {
          const key = `${row.token}:${row.spender}`;
          const spenderDisplay = row.spenderLabel ?? `${row.spender.slice(0, 6)}…${row.spender.slice(-4)}`;
          return (
            <li key={key} className="bfox-approval-row">
              <JumpaLiFiIcon label={row.tokenSymbol} size={36} rounded />
              <div className="bfox-approval-row__meta">
                <span className="bfox-approval-row__token">{row.tokenSymbol}</span>
                <span className="bfox-approval-row__spender mono" title={row.spender}>
                  → {spenderDisplay}
                </span>
              </div>
              <div className="bfox-approval-row__right">
                <span className="bfox-approval-row__amt">{fmtAllowance(row)}</span>
                <button
                  type="button"
                  className="ghost bfox-approval-revoke"
                  disabled={revoking === key}
                  onClick={() => void revoke(row)}
                >
                  {revoking === key ? '…' : 'Revoke'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
