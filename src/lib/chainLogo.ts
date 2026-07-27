/** Defillama / Llamao chain icon CDN (fallback when `logoURI` is not set). */
export function defillamaChainIcon(slug: string): string {
  return `https://icons.llamao.fi/icons/chains/rsz_${slug}.jpg`;
}

export function chainLogoUri(chain: {
  logoURI?: string;
  logoSlug?: string;
  shortName: string;
}): string {
  if (chain.logoURI) return chain.logoURI;
  return defillamaChainIcon(chain.logoSlug ?? chain.shortName);
}
