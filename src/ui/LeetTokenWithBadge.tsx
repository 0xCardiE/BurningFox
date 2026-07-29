import { LeetLiFiIcon } from './LeetLiFiIcon';

/** Token logo (circle) + small chain badge bottom-right, Jumper-style. */
export function LeetTokenWithBadge({
  tokenLogoURI,
  chainLogoURI,
  size = 40,
  symbol,
  subline,
  empty = false,
}: {
  tokenLogoURI?: string | null;
  chainLogoURI?: string | null;
  size?: number;
  symbol: string;
  subline?: string;
  /** Placeholder when no token picked */
  empty?: boolean;
}) {
  const badgeSize = Math.max(15, Math.round(size * 0.34));
  const sym = empty ? '—' : symbol;

  return (
    <div className={`leet-tw ${empty ? 'leet-tw--empty' : ''}`}>
      <div className="leet-tw-inner">
        <LeetLiFiIcon
          logoURI={empty ? null : tokenLogoURI}
          label={sym}
          size={size}
          rounded
        />
        <div className="leet-tw-badge" aria-hidden>
          <LeetLiFiIcon logoURI={chainLogoURI} label="" size={badgeSize} rounded />
        </div>
      </div>
      <div className="leet-tw-text">
        <span className="leet-tw-symbol">{empty ? 'Token' : sym}</span>
        <span className="leet-tw-sub">{empty ? 'Tap to choose' : subline ?? ' '}</span>
      </div>
    </div>
  );
}
