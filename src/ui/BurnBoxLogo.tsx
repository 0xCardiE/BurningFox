import { useId } from 'react';

/** BurnBox mark — flame in a box; static source also at `public/icons/burnbox-logo.svg`. */

const FLAME_PATH =
  'M67 26c1 10 6 16 12 23 7 8 11 16 11 25 0 17-12 28-26 28-14 0-26-11-26-28 0-7 2-13 6-19 1 5 4 9 8 11-3-13 3-29 15-40Z' +
  'M64 88c-7 0-12-5-12-11 0-6 4-10 10-12 5-2 9-5 11-9 2 4 3 8 3 12 0 11-5 20-12 20Z';

export function BurnBoxMark({
  className,
  size = 28,
  animated = true,
}: {
  className?: string;
  size?: number;
  /** When false, skips idle/hover flame motion (e.g. tiny toolbar contexts). Default true. */
  animated?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const box = `bbBox-${uid}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      width={size}
      height={size}
      className={`bbox-mark${animated ? ' bbox-mark--live' : ''}${className ? ` ${className}` : ''}`}
      fill="none"
      role="img"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={box} x1="64" y1="8" x2="64" y2="120" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFA033" />
          <stop offset="1" stopColor="#EE4A08" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="112" height="112" rx="28" fill={`url(#${box})`} />
      <path
        className="bbox-mark__flame"
        fillRule="evenodd"
        clipRule="evenodd"
        fill="#FFF7EC"
        d={FLAME_PATH}
      />
    </svg>
  );
}
