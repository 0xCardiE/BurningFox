import { useEffect, useState } from 'react';
import { getAddress, isAddress, parseUnits, formatUnits } from 'viem';
import { getSessionPrivateKey } from '../lib/accountSession';
import { sendErc20Transfer, sendNativeTransfer } from '../lib/backgroundSign';
import { waitForChainReceipt } from '../lib/ethereum';
import { txExplorerLink } from '../lib/explorerTxHistory';
import {
  formatTokenAmount,
  isNativeWalletToken,
  type WalletBalEntry,
} from '../lib/walletBalances';
import { describeError } from '../lib/utils';

const COLLAPSE_AFTER_SEC = 30;

function shortAddress(addr: string): string {
  const a = addr.trim();
  if (a.length <= 14) return a;
  return `${a.slice(0, 6)}…${a.slice(-6)}`;
}

export function QuickSendInline({
  token,
  chainId,
  onCollapse,
  onSent,
}: {
  token: WalletBalEntry;
  chainId: number;
  onCollapse: () => void;
  onSent: () => void;
}) {
  const native = isNativeWalletToken(token);
  const balance = BigInt(token.amount || '0');

  const [toRaw, setToRaw] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(COLLAPSE_AFTER_SEC);
  const [addrFocused, setAddrFocused] = useState(true);

  const toValid = toRaw.trim() && isAddress(toRaw.trim());
  const to = toValid ? getAddress(toRaw.trim()) : null;

  let amount: bigint | null = null;
  try {
    amount = amountStr.trim() ? parseUnits(amountStr.trim(), token.decimals) : null;
  } catch {
    amount = null;
  }

  const amountValid = amount != null && amount > 0n;
  const overBalance = amount != null && amount > balance;
  const canSend = !!to && amountValid && !overBalance && !busy;

  const fieldErr =
    err ??
    (toRaw.trim() && !toValid ? 'Invalid address' : null) ??
    (overBalance ? 'Amount exceeds balance' : null);

  useEffect(() => {
    if (!txHash) return;
    setSecondsLeft(COLLAPSE_AFTER_SEC);
    const collapseId = window.setTimeout(() => onCollapse(), COLLAPSE_AFTER_SEC * 1000);
    const tickId = window.setInterval(() => {
      setSecondsLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => {
      window.clearTimeout(collapseId);
      window.clearInterval(tickId);
    };
  }, [txHash, onCollapse]);

  function useMax() {
    let max = balance;
    if (native && balance > 0n) {
      try {
        const reserve = parseUnits('0.001', token.decimals);
        if (balance > reserve) max = balance - reserve;
      } catch {
        /* use full balance */
      }
    }
    setAmountStr(formatUnits(max, token.decimals));
  }

  async function submit() {
    const pk = getSessionPrivateKey();
    if (!pk || !to || !amount) {
      setErr('Wallet locked.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const hash = native
        ? await sendNativeTransfer({ pk, chainId, to, amount })
        : await sendErc20Transfer({
            pk,
            chainId,
            token: getAddress(token.address),
            to,
            amount,
          });
      await waitForChainReceipt(hash, chainId);
      setTxHash(hash);
      onSent();
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  const explorerUrl = txHash ? txExplorerLink(chainId, txHash) : undefined;
  const sentAmount = amount ?? 0n;
  const sentTo = to;

  if (txHash) {
    return (
      <div className="bfox-quick-send-inline bfox-quick-send-inline--done">
        <div className="bfox-quick-send-inline__done-main">
          <span className="bfox-quick-send-inline__ok">Sent</span>
          {explorerUrl ? (
            <a
              className="bfox-quick-send-inline__tx-link"
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View transaction
            </a>
          ) : (
            <span className="mono muted">{txHash.slice(0, 10)}…</span>
          )}
        </div>
        <div className="bfox-quick-send-inline__done-meta">
          <span className="bfox-quick-send-inline__hint">
            {formatTokenAmount(sentAmount, token.decimals)} {token.symbol}
          </span>
          {sentTo ? (
            <span className="bfox-quick-send-inline__to muted">to {shortAddress(sentTo)}</span>
          ) : null}
          <span className="bfox-quick-send-inline__timer muted">{secondsLeft}s</span>
        </div>
      </div>
    );
  }

  const addrDisplay =
    addrFocused || !toValid ? toRaw : shortAddress(getAddress(toRaw.trim()));

  return (
    <div className="bfox-quick-send-inline">
      <input
        className="bfox-quick-send-inline__addr"
        value={addrDisplay}
        onChange={e => setToRaw(e.target.value)}
        onFocus={() => setAddrFocused(true)}
        onBlur={() => setAddrFocused(false)}
        placeholder="0x…"
        spellCheck={false}
        autoComplete="off"
        autoFocus
        disabled={busy}
        title={toValid ? getAddress(toRaw.trim()) : undefined}
      />
      <input
        className="bfox-quick-send-inline__amt"
        value={amountStr}
        onChange={e => setAmountStr(e.target.value)}
        placeholder="0.0"
        inputMode="decimal"
        autoComplete="off"
        disabled={busy}
      />
      <button
        type="button"
        className="bfox-quick-send-inline__max"
        onClick={useMax}
        disabled={busy}
        title="Use max balance"
      >
        Max
      </button>
      <button
        type="button"
        className="bfox-quick-send-inline__send primary"
        disabled={!canSend}
        onClick={() => void submit()}
      >
        {busy ? '…' : 'Send'}
      </button>
      {fieldErr ? <p className="error bfox-quick-send-inline__err">{fieldErr}</p> : null}
    </div>
  );
}
