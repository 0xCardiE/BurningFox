/** Open / close the Network Doctor sheet from anywhere in the UI. */

export type NetworkDoctorRequest = {
  chainId: number;
  /** Short reason code for the banner. */
  reason: 'exhausted' | 'manual' | 'probe_failed' | 'switch';
  lastError?: string;
  method?: string;
};

type Listener = (req: NetworkDoctorRequest | null) => void;

let current: NetworkDoctorRequest | null = null;
const listeners = new Set<Listener>();

export function getNetworkDoctorRequest(): NetworkDoctorRequest | null {
  return current;
}

export function openNetworkDoctor(req: NetworkDoctorRequest): void {
  current = req;
  for (const l of listeners) {
    try {
      l(current);
    } catch {
      /* ignore */
    }
  }
}

export function closeNetworkDoctor(): void {
  current = null;
  for (const l of listeners) {
    try {
      l(null);
    } catch {
      /* ignore */
    }
  }
}

export function subscribeNetworkDoctor(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}
