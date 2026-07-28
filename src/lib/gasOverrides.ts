import { formatEther, formatGwei, parseGwei } from 'viem';
import type { TxGasPreview } from './approvalDetails';

export type GasOverrideMode = 'auto' | 'custom';

export type GasOverrideInput = {
  mode: GasOverrideMode;
  maxFeeGwei?: string;
  maxPriorityGwei?: string;
  gasLimit?: string;
};

export type AutoGasEstimate = {
  gasLimitBuffered: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  totalWei: bigint;
};

export type SignTxOptions = {
  /** When set, use this gas limit as-is (no +25% buffer). */
  gasLimitFinal?: bigint;
};

function hexBigInt(v: unknown): bigint | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.floor(v));
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (!s) return undefined;
  try {
    return BigInt(s.startsWith('0x') ? s : s);
  } catch {
    return undefined;
  }
}

export function computeAutoGasEstimate(
  tx: Record<string, unknown>,
  preview: TxGasPreview | null,
): AutoGasEstimate | null {
  const gasBase =
    hexBigInt(tx.gas ?? tx.gasLimit) ??
    (preview?.estimatedGas ? BigInt(preview.estimatedGas) : undefined);
  if (gasBase == null) return null;

  const gasLimitBuffered = (gasBase * 125n) / 100n;

  const legacyGas = hexBigInt(tx.gasPrice);
  const maxFee = hexBigInt(tx.maxFeePerGas);
  const maxPrio = hexBigInt(tx.maxPriorityFeePerGas);
  const suggested = preview?.suggestedGasPrice ? BigInt(preview.suggestedGasPrice) : undefined;

  let maxFeePerGas: bigint;
  let maxPriorityFeePerGas: bigint;

  if (maxFee != null) {
    maxFeePerGas = maxFee;
    maxPriorityFeePerGas = maxPrio ?? maxFee / 10n;
  } else if (legacyGas != null) {
    maxFeePerGas = legacyGas;
    maxPriorityFeePerGas = 0n;
  } else if (suggested != null) {
    maxFeePerGas = (suggested * 150n) / 100n;
    maxPriorityFeePerGas = suggested / 10n;
  } else {
    return null;
  }

  return {
    gasLimitBuffered,
    maxFeePerGas,
    maxPriorityFeePerGas,
    totalWei: gasLimitBuffered * maxFeePerGas,
  };
}

export function formatFeeEstimate(totalWei: bigint, symbol: string): string {
  try {
    const eth = formatEther(totalWei);
    const n = Number(eth);
    if (n === 0) return `~0 ${symbol}`;
    if (n < 0.000001) return `<0.000001 ${symbol}`;
    if (n < 0.01) return `~${n.toFixed(6)} ${symbol}`;
    return `~${n.toFixed(4)} ${symbol}`;
  } catch {
    return `~${totalWei.toString()} wei`;
  }
}

export function gweiToInput(v: bigint): string {
  const s = formatGwei(v);
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  if (n === 0) return '0';
  if (n < 0.0001) return n.toExponential(4);
  return String(Number(n.toPrecision(8)));
}

export function parseGweiInput(raw: string): bigint | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    return parseGwei(s);
  } catch {
    return null;
  }
}

export function applyGasOverrides(
  tx: Record<string, unknown>,
  overrides: GasOverrideInput | undefined,
): { tx: Record<string, unknown>; signOpts: SignTxOptions } {
  if (!overrides || overrides.mode === 'auto') {
    return { tx: { ...tx }, signOpts: {} };
  }

  const out = { ...tx };
  const signOpts: SignTxOptions = {};

  const maxFee = overrides.maxFeeGwei ? parseGweiInput(overrides.maxFeeGwei) : null;
  const maxPrio = overrides.maxPriorityGwei ? parseGweiInput(overrides.maxPriorityGwei) : null;

  if (maxFee != null) {
    out.maxFeePerGas = `0x${maxFee.toString(16)}`;
    delete out.gasPrice;
    out.maxPriorityFeePerGas = `0x${(maxPrio ?? maxFee / 10n).toString(16)}`;
  }

  if (overrides.gasLimit?.trim()) {
    try {
      const limit = BigInt(overrides.gasLimit.trim());
      if (limit > 0n) {
        signOpts.gasLimitFinal = limit;
        out.gas = `0x${limit.toString(16)}`;
      }
    } catch {
      /* invalid limit — signer falls back to estimate */
    }
  }

  return { tx: out, signOpts };
}

export function validateGasOverrides(overrides: GasOverrideInput): string | null {
  if (overrides.mode !== 'custom') return null;

  const maxFee = overrides.maxFeeGwei ? parseGweiInput(overrides.maxFeeGwei) : null;
  if (overrides.maxFeeGwei?.trim() && maxFee == null) {
    return 'Invalid max fee (gwei)';
  }

  const maxPrio = overrides.maxPriorityGwei ? parseGweiInput(overrides.maxPriorityGwei) : null;
  if (overrides.maxPriorityGwei?.trim() && maxPrio == null) {
    return 'Invalid priority fee (gwei)';
  }

  if (maxFee != null && maxPrio != null && maxPrio > maxFee) {
    return 'Priority fee cannot exceed max fee';
  }

  if (overrides.gasLimit?.trim()) {
    try {
      const limit = BigInt(overrides.gasLimit.trim());
      if (limit <= 0n) return 'Gas limit must be positive';
    } catch {
      return 'Invalid gas limit';
    }
  }

  return null;
}

export function computeDisplayFeeEstimate(
  overrides: GasOverrideInput,
  auto: AutoGasEstimate | null,
): AutoGasEstimate | null {
  if (!auto) return null;
  if (overrides.mode === 'auto') return auto;

  const maxFee = overrides.maxFeeGwei?.trim()
    ? parseGweiInput(overrides.maxFeeGwei)
    : auto.maxFeePerGas;
  if (maxFee == null) return auto;

  const maxPrio = overrides.maxPriorityGwei?.trim()
    ? parseGweiInput(overrides.maxPriorityGwei)
    : auto.maxPriorityFeePerGas;

  let gasLimitBuffered = auto.gasLimitBuffered;
  if (overrides.gasLimit?.trim()) {
    try {
      gasLimitBuffered = BigInt(overrides.gasLimit.trim());
    } catch {
      /* keep auto */
    }
  }

  const prio = maxPrio ?? maxFee / 10n;
  return {
    gasLimitBuffered,
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: prio,
    totalWei: gasLimitBuffered * maxFee,
  };
}
