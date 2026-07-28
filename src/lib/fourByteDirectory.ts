const API = 'https://www.4byte.directory/api/v1/signatures/';

type FourByteSignature = {
  id: number;
  text_signature: string;
  hex_signature: string;
};

type ListResponse = {
  count: number;
  results: FourByteSignature[];
};

const cache = new Map<string, string[]>();

function normalizeSelector(hex: string): string {
  const s = hex.trim().toLowerCase();
  return s.startsWith('0x') ? s : `0x${s}`;
}

export function formatFunctionSignatures(signatures: string[]): string {
  if (signatures.length === 0) return '';
  if (signatures.length === 1) return signatures[0];
  return `${signatures[0]} (+${signatures.length - 1} more)`;
}

export async function lookupFunctionSelectors(hexSelector: string): Promise<string[]> {
  const normalized = normalizeSelector(hexSelector);
  const cached = cache.get(normalized);
  if (cached) return cached;

  try {
    const url = `${API}?hex_signature=${encodeURIComponent(normalized)}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = (await res.json()) as ListResponse;
    const signatures = [...new Set(data.results.map(r => r.text_signature).filter(Boolean))];
    cache.set(normalized, signatures);
    return signatures;
  } catch {
    return [];
  }
}
