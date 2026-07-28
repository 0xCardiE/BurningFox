import {
  formatDevError,
  formatProviderRpcError,
  providerErrorTitle,
  shouldReportProviderError,
} from './devErrorFormat';
import type { DevErrorMessagePayload } from './devErrorLog';

export function pushDevErrorToWallet(
  payload: DevErrorMessagePayload & {
    title: string;
    summary: string;
    detail: string;
    sections: DevErrorMessagePayload['sections'];
  },
): void {
  void chrome.runtime
    .sendMessage({ type: 'DEV_ERROR', payload })
    .catch(() => {});
}

export function reportProviderRpcFailure(opts: {
  method: string;
  code?: number;
  message: string;
  origin?: string;
  chainId?: number;
  params?: unknown[];
  rpcData?: unknown;
}): void {
  if (!shouldReportProviderError(opts.code ?? 4001, opts.message)) return;
  const formatted = formatProviderRpcError(opts);
  pushDevErrorToWallet({
    source: 'dapp',
    title: providerErrorTitle(opts.method, opts.code),
    summary: formatted.summary,
    sections: formatted.sections,
    detail: formatted.detail,
  });
}

export function reportInternalFailure(opts: {
  source: string;
  title: string;
  err: unknown;
  context?: Record<string, unknown>;
}): void {
  const formatted = formatDevError(opts.err, opts.context);
  pushDevErrorToWallet({
    source: opts.source,
    title: opts.title,
    summary: formatted.summary,
    sections: formatted.sections,
    detail: formatted.detail,
  });
}
