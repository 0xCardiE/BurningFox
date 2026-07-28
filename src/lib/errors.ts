function errRecord(err: unknown): Record<string, unknown> | null {
  if (!err || typeof err !== 'object') return null;
  return err as Record<string, unknown>;
}

/** Extra detail from LiFi / SDK thrown errors — never invent fallbacks beyond parsing. */
export function summarizeApiError(err: unknown): string {
  if (!err || typeof err !== 'object') {
    return err instanceof Error ? err.message : String(err);
  }
  const any = errRecord(err)!;
  const short = any.shortMessage;
  if (typeof short === 'string' && short.length) return short;
  const cause = any.cause;
  if (cause && typeof cause === 'object') {
    const c = cause as Record<string, unknown>;
    const msg = c.message;
    if (typeof msg === 'string' && msg.length) return msg;
  }
  const msg = any.message;
  if (typeof msg === 'string' && msg.length) return msg;
  try {
    return JSON.stringify(any);
  } catch {
    return String(err);
  }
}
