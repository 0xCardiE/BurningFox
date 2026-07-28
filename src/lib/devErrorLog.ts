import {
  formatDevError,
  type DevErrorSection,
  type FormattedDevError,
} from './devErrorFormat';

export type { DevErrorSection };

export type DevErrorEntry = {
  id: string;
  at: number;
  source: string;
  title: string;
  summary: string;
  sections: DevErrorSection[];
  detail: string;
};

let active: DevErrorEntry | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

function toEntry(
  opts: { source: string; title: string },
  formatted: FormattedDevError,
): DevErrorEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    source: opts.source,
    title: opts.title,
    summary: formatted.summary,
    sections: formatted.sections,
    detail: formatted.detail,
  };
}

export function getDevError(): DevErrorEntry | null {
  return active;
}

export function subscribeDevError(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function clearDevError(): void {
  if (!active) return;
  active = null;
  emit();
}

export function reportDevError(opts: {
  source: string;
  title?: string;
  err: unknown;
  context?: Record<string, unknown>;
}): DevErrorEntry {
  active = toEntry(
    { source: opts.source, title: opts.title ?? 'Something failed' },
    formatDevError(opts.err, opts.context),
  );
  emit();
  return active;
}

export function reportFormattedDevError(opts: {
  source: string;
  title: string;
  formatted: FormattedDevError;
}): DevErrorEntry {
  active = toEntry({ source: opts.source, title: opts.title }, opts.formatted);
  emit();
  return active;
}

export type DevErrorMessagePayload = {
  source: string;
  title?: string;
  summary?: string;
  detail?: string;
  sections?: DevErrorSection[];
  err?: string;
  context?: Record<string, unknown>;
};

/** Background → wallet UI push (best-effort). */
export function reportDevErrorFromMessage(payload: DevErrorMessagePayload): void {
  if (payload.sections?.length && payload.summary && payload.detail) {
    active = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: Date.now(),
      source: payload.source,
      title: payload.title ?? 'Something failed',
      summary: payload.summary,
      sections: payload.sections,
      detail: payload.detail,
    };
    emit();
    return;
  }
  if (payload.detail && payload.summary) {
    active = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: Date.now(),
      source: payload.source,
      title: payload.title ?? 'Something failed',
      summary: payload.summary,
      sections: [
        { label: 'Error', lines: [payload.summary] },
        { label: 'Detail', lines: [payload.detail], mono: true },
      ],
      detail: payload.detail,
    };
    emit();
    return;
  }
  reportDevError({
    source: payload.source,
    title: payload.title,
    err: payload.err ?? payload.summary ?? 'Unknown error',
    context: payload.context,
  });
}
