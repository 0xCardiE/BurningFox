import {
  decodeErrorResult,
  formatEther,
  formatGwei,
  isHex,
  type Hex,
} from 'viem';
import { chainById } from './chainCatalog';
import { chainJsonRpcCall } from './ethereum';
import type { TxHistoryRow } from './explorerTxHistory';

export type TxFailureDetail = {
  hash: `0x${string}`;
  status: 'reverted' | 'success' | 'unknown';
  blockNumber: number | null;
  blockHex: string | null;
  nonce: number | null;
  from: string | null;
  to: string | null;
  valueWei: string | null;
  valueEth: string | null;
  gasLimit: string | null;
  gasUsed: string | null;
  gasUsedPct: string | null;
  effectiveGasPriceGwei: string | null;
  cumulativeGasUsed: string | null;
  methodId: string | null;
  input: string | null;
  inputLen: number | null;
  revertReason: string | null;
  revertSelector: string | null;
  revertData: string | null;
  rpcError: string | null;
  likelyOutOfGas: boolean;
  explorerHint: string | null;
  rawReceiptStatus: string | null;
};

type RpcTx = {
  hash?: string;
  from?: string;
  to?: string | null;
  value?: string;
  nonce?: string;
  gas?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  input?: string;
  blockNumber?: string | null;
};

type RpcReceipt = {
  status?: string;
  blockNumber?: string;
  gasUsed?: string;
  cumulativeGasUsed?: string;
  effectiveGasPrice?: string;
  from?: string;
  to?: string | null;
  contractAddress?: string | null;
};

const ERROR_STRING_ABI = [
  {
    type: 'error',
    name: 'Error',
    inputs: [{ name: 'message', type: 'string' }],
  },
] as const;

const PANIC_ABI = [
  {
    type: 'error',
    name: 'Panic',
    inputs: [{ name: 'code', type: 'uint256' }],
  },
] as const;

const PANIC_CODES: Record<number, string> = {
  0x00: 'generic compiler panic',
  0x01: 'assert(false)',
  0x11: 'arithmetic overflow/underflow',
  0x12: 'division or modulo by zero',
  0x21: 'converted to enum out of bounds',
  0x22: 'incorrectly encoded storage byte array',
  0x31: 'pop() on empty array',
  0x32: 'array index out of bounds',
  0x41: 'too much memory allocated',
  0x51: 'zero-initialized variable of internal function type',
};

function hexToBigIntSafe(hex: string | undefined | null): bigint | null {
  if (!hex) return null;
  try {
    return BigInt(hex);
  } catch {
    return null;
  }
}

function extractRevertHex(err: unknown): Hex | null {
  if (!err || typeof err !== 'object') {
    if (typeof err === 'string') {
      const m = err.match(/0x[a-fA-F0-9]{8,}/);
      return m && isHex(m[0]) ? (m[0] as Hex) : null;
    }
    return null;
  }
  const e = err as Record<string, unknown>;
  const candidates: unknown[] = [
    e.data,
    (e.data as { data?: unknown } | undefined)?.data,
    (e.cause as { data?: unknown } | undefined)?.data,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && isHex(c) && c.length >= 10) return c as Hex;
    if (c && typeof c === 'object') {
      const nested = c as Record<string, unknown>;
      for (const key of ['data', 'raw']) {
        const d = nested[key];
        if (typeof d === 'string' && isHex(d) && d.length >= 10) return d as Hex;
      }
    }
  }
  const msg =
    typeof e.message === 'string'
      ? e.message
      : err instanceof Error
        ? err.message
        : String(err);
  const m = msg.match(/0x[a-fA-F0-9]{8,}/);
  return m && isHex(m[0]) ? (m[0] as Hex) : null;
}

function decodeRevertData(data: Hex): { reason: string; selector: string } {
  const selector = data.slice(0, 10).toLowerCase();
  if (data === '0x') {
    return { reason: 'Empty revert (no reason string)', selector: '0x' };
  }
  if (selector === '0x08c379a0') {
    try {
      const decoded = decodeErrorResult({ abi: ERROR_STRING_ABI, data });
      return { reason: String(decoded.args[0]), selector };
    } catch {
      /* fall through */
    }
  }
  if (selector === '0x4e487b71') {
    try {
      const decoded = decodeErrorResult({ abi: PANIC_ABI, data });
      const code = Number(decoded.args[0]);
      const label = PANIC_CODES[code] ?? 'unknown panic';
      return { reason: `Panic(0x${code.toString(16)}) — ${label}`, selector };
    } catch {
      /* fall through */
    }
  }
  return {
    reason: `Custom error ${selector} (no ABI to decode)`,
    selector,
  };
}

function parseRpcMessageReason(message: string): string | null {
  const patterns = [
    /execution reverted:\s*(.+)$/i,
    /reverted with reason string\s+'([^']+)'/i,
    /reverted with reason string\s+"([^"]+)"/i,
    /Error:\s*VM Exception[^:]*:\s*revert\s+(.+)$/i,
  ];
  for (const p of patterns) {
    const m = message.match(p);
    if (m?.[1]) {
      const t = m[1].trim();
      if (t && !/^0x[a-fA-F0-9]+$/i.test(t)) return t;
    }
  }
  return null;
}

async function replayForRevert(
  chainId: number,
  tx: RpcTx,
  blockHex: string,
): Promise<{ reason: string | null; data: Hex | null; rpcError: string | null }> {
  const call = {
    from: tx.from,
    to: tx.to ?? undefined,
    data: tx.input ?? '0x',
    value: tx.value ?? '0x0',
    gas: tx.gas,
  };

  try {
    await chainJsonRpcCall<string>(chainId, 'eth_call', [call, blockHex]);
    return {
      reason: null,
      data: null,
      rpcError: 'eth_call succeeded on replay (state may have changed since failure)',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const data = extractRevertHex(err);
    if (data) {
      const decoded = decodeRevertData(data);
      return { reason: decoded.reason, data, rpcError: message };
    }
    const parsed = parseRpcMessageReason(message);
    return { reason: parsed, data: null, rpcError: message };
  }
}

export async function fetchTxFailureDetail(
  chainId: number,
  row: TxHistoryRow,
): Promise<TxFailureDetail> {
  const hash = row.hash;

  let tx: RpcTx | null = null;
  let receipt: RpcReceipt | null = null;
  let rpcError: string | null = null;

  try {
    tx = await chainJsonRpcCall<RpcTx | null>(chainId, 'eth_getTransactionByHash', [hash]);
  } catch (e) {
    rpcError = e instanceof Error ? e.message : String(e);
  }

  try {
    receipt = await chainJsonRpcCall<RpcReceipt | null>(
      chainId,
      'eth_getTransactionReceipt',
      [hash],
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    rpcError = rpcError ? `${rpcError}; ${msg}` : msg;
  }

  const blockHex = receipt?.blockNumber ?? tx?.blockNumber ?? null;
  const blockNumber = blockHex ? Number(BigInt(blockHex)) : row.blockNumber ?? null;

  const gasLimitBi = hexToBigIntSafe(tx?.gas) ?? row.gasLimit ?? null;
  const gasUsedBi = hexToBigIntSafe(receipt?.gasUsed) ?? row.gasUsed ?? null;
  const gasPriceBi =
    hexToBigIntSafe(receipt?.effectiveGasPrice) ??
    hexToBigIntSafe(tx?.gasPrice) ??
    row.gasPrice ??
    null;
  const valueBi = hexToBigIntSafe(tx?.value) ?? row.value;
  const nativeSym = chainById(chainId)?.nativeCurrency.symbol ?? 'ETH';

  const statusRaw = receipt?.status ?? null;
  let status: TxFailureDetail['status'] = 'unknown';
  if (statusRaw === '0x1') status = 'success';
  else if (statusRaw === '0x0') status = 'reverted';
  else if (!row.success) status = 'reverted';

  const gasUsedPct =
    gasLimitBi && gasUsedBi && gasLimitBi > 0n
      ? `${((Number(gasUsedBi) / Number(gasLimitBi)) * 100).toFixed(1)}%`
      : null;

  const likelyOutOfGas =
    status === 'reverted' &&
    gasLimitBi != null &&
    gasUsedBi != null &&
    gasUsedBi >= (gasLimitBi * 98n) / 100n;

  const input = tx?.input ?? row.input ?? null;
  const methodId =
    row.methodId ??
    (input && input.length >= 10 ? input.slice(0, 10).toLowerCase() : null);

  let revertReason: string | null = null;
  let revertSelector: string | null = null;
  let revertData: string | null = null;

  if (status === 'reverted' && tx && blockHex) {
    const replay = await replayForRevert(chainId, tx, blockHex);
    revertReason = replay.reason;
    revertData = replay.data;
    if (replay.data) revertSelector = replay.data.slice(0, 10).toLowerCase();
    if (replay.rpcError) {
      rpcError = rpcError ? `${rpcError}\n${replay.rpcError}` : replay.rpcError;
    }
  }

  if (!revertReason && likelyOutOfGas) {
    revertReason = 'Likely out of gas (used ≥98% of gas limit with status=reverted)';
  }

  if (!revertReason && row.functionName) {
    revertReason = `Reverted during ${row.functionName} (no reason string recovered)`;
  }

  return {
    hash,
    status,
    blockNumber,
    blockHex,
    nonce: tx?.nonce != null ? Number(BigInt(tx.nonce)) : row.nonce ?? null,
    from: tx?.from ?? row.from,
    to: tx?.to ?? receipt?.to ?? row.to,
    valueWei: valueBi?.toString() ?? null,
    valueEth: valueBi != null ? `${formatEther(valueBi)} ${nativeSym}` : null,
    gasLimit: gasLimitBi?.toString() ?? null,
    gasUsed: gasUsedBi?.toString() ?? null,
    gasUsedPct,
    effectiveGasPriceGwei: gasPriceBi != null ? `${formatGwei(gasPriceBi)} gwei` : null,
    cumulativeGasUsed: hexToBigIntSafe(receipt?.cumulativeGasUsed)?.toString() ?? null,
    methodId,
    input,
    inputLen: input ? Math.max(0, (input.length - 2) / 2) : null,
    revertReason,
    revertSelector,
    revertData,
    rpcError,
    likelyOutOfGas,
    explorerHint: row.functionName ?? null,
    rawReceiptStatus: statusRaw,
  };
}

/** Decode revert reason for a live hash (swap / send flows). */
export async function describeRevertedTx(
  chainId: number,
  txHash: `0x${string}`,
): Promise<string> {
  const detail = await fetchTxFailureDetail(chainId, {
    hash: txHash,
    from: '0x0000000000000000000000000000000000000000',
    to: null,
    value: 0n,
    timestamp: 0,
    success: false,
    direction: 'out',
  });
  if (detail.revertReason) {
    return `Transaction reverted: ${detail.revertReason} (${txHash})`;
  }
  if (detail.likelyOutOfGas) {
    return `Transaction reverted (likely out of gas). ${txHash}`;
  }
  if (detail.rpcError) {
    return `Transaction reverted: ${detail.rpcError} (${txHash})`;
  }
  return `Transaction reverted: ${txHash}`;
}

export function failureDetailAsText(d: TxFailureDetail): string {
  const lines = [
    `hash: ${d.hash}`,
    `status: ${d.status}`,
    `block: ${d.blockNumber ?? '—'}`,
    `from: ${d.from ?? '—'}`,
    `to: ${d.to ?? '—'}`,
    `value: ${d.valueEth ?? d.valueWei ?? '—'}`,
    `nonce: ${d.nonce ?? '—'}`,
    `methodId: ${d.methodId ?? '—'}`,
    `function: ${d.explorerHint ?? '—'}`,
    `gasLimit: ${d.gasLimit ?? '—'}`,
    `gasUsed: ${d.gasUsed ?? '—'} (${d.gasUsedPct ?? '—'})`,
    `gasPrice: ${d.effectiveGasPriceGwei ?? '—'}`,
    `likelyOutOfGas: ${d.likelyOutOfGas}`,
    `revertReason: ${d.revertReason ?? '—'}`,
    `revertSelector: ${d.revertSelector ?? '—'}`,
    `revertData: ${d.revertData ?? '—'}`,
    `rpcError: ${d.rpcError ?? '—'}`,
    `input (${d.inputLen ?? 0} bytes): ${d.input ?? '—'}`,
  ];
  return lines.join('\n');
}
