import { JumpaLiFiIcon } from './JumpaLiFiIcon';

/** Token logo (circle) + small chain badge bottom-right, Jumper-style. */
export function JumpaTokenWithBadge({
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
    <div className={`jumpa-tw ${empty ? 'jumpa-tw--empty' : ''}`}>
      <div className="jumpa-tw-inner">
        <JumpaLiFiIcon
          logoURI={empty ? null : tokenLogoURI}
          label={sym}
          size={size}
          rounded
        />
        <div className="jumpa-tw-badge" aria-hidden>
          <JumpaLiFiIcon logoURI={chainLogoURI} label="" size={badgeSize} rounded />
        </div>
      </div>
      <div className="jumpa-tw-text">
        <span className="jumpa-tw-symbol">{empty ? 'Token' : sym}</span>
        <span className="jumpa-tw-sub">{empty ? 'Tap to choose' : subline ?? ' '}</span>
      </div>
    </div>
  );
}
