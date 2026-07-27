import { useId } from 'react';

/** Burning Fox mark — animated inline SVG; static source also at `public/icons/burning-fox-logo.svg`. */

export function BurningFoxMark({
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
  const glow = `bfGlow-${uid}`;
  const fur = `bfFur-${uid}`;
  const furDeep = `bfFurDeep-${uid}`;
  const flameOuter = `bfFlameOuter-${uid}`;
  const flameInner = `bfFlameInner-${uid}`;
  const muzzle = `bfMuzzle-${uid}`;
  const soft = `bfSoft-${uid}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      width={size}
      height={size}
      className={`bfox-mark${animated ? ' bfox-mark--live' : ''}${className ? ` ${className}` : ''}`}
      fill="none"
      role="img"
      aria-hidden
      focusable="false"
    >
      <defs>
        <radialGradient id={glow} cx="64" cy="70" r="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF8A3D" stopOpacity="0.55" />
          <stop offset="0.55" stopColor="#FF5A1F" stopOpacity="0.22" />
          <stop offset="1" stopColor="#FF3D00" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={fur} x1="28" y1="36" x2="100" y2="112" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFB14A" />
          <stop offset="0.45" stopColor="#FF7A1A" />
          <stop offset="1" stopColor="#E04800" />
        </linearGradient>
        <linearGradient id={furDeep} x1="64" y1="48" x2="64" y2="108" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF8C2E" />
          <stop offset="1" stopColor="#C43A00" />
        </linearGradient>
        <linearGradient id={flameOuter} x1="64" y1="8" x2="64" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE566" />
          <stop offset="0.4" stopColor="#FF9A1A" />
          <stop offset="1" stopColor="#FF4D00" />
        </linearGradient>
        <linearGradient id={flameInner} x1="64" y1="14" x2="64" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF6C8" />
          <stop offset="0.5" stopColor="#FFD24A" />
          <stop offset="1" stopColor="#FF8A00" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id={muzzle} x1="48" y1="72" x2="80" y2="102" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF3E0" />
          <stop offset="1" stopColor="#FFD7A8" />
        </linearGradient>
        <filter id={soft} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle className="bfox-mark__glow" cx="64" cy="66" r="58" fill={`url(#${glow})`} />

      <g className="bfox-mark__flames" filter={`url(#${soft})`}>
        <path
          className="bfox-mark__flame bfox-mark__flame--l"
          d="M42 48c-2-14 4-26 10-32 1 8 4 14 8 18-8 2-14 8-18 14Z"
          fill={`url(#${flameOuter})`}
          opacity="0.95"
        />
        <path
          className="bfox-mark__flame bfox-mark__flame--c"
          d="M64 6c-3 10-2 20 1 28 4-9 10-15 16-18-4 10-4 20-2 28C70 32 64 20 64 6Z"
          fill={`url(#${flameOuter})`}
        />
        <path
          className="bfox-mark__flame bfox-mark__flame--r"
          d="M86 48c2-14-4-26-10-32-1 8-4 14-8 18 8 2 14 8 18 14Z"
          fill={`url(#${flameOuter})`}
          opacity="0.95"
        />
        <path
          className="bfox-mark__flame bfox-mark__flame--li"
          d="M52 44c0-10 4-18 8-22 2 6 4 11 5 16-5 1-9 4-13 6Z"
          fill={`url(#${flameInner})`}
          opacity="0.9"
        />
        <path
          className="bfox-mark__flame bfox-mark__flame--ci"
          d="M64 18c-1 7 0 13 2 18 3-6 6-10 10-13-3 7-3 13-1 18-5-5-9-13-11-23Z"
          fill={`url(#${flameInner})`}
        />
        <path
          className="bfox-mark__flame bfox-mark__flame--ri"
          d="M76 44c0-10-4-18-8-22-2 6-4 11-5 16 5 1 9 4 13 6Z"
          fill={`url(#${flameInner})`}
          opacity="0.9"
        />
      </g>

      <path
        d="M28 78c6-30 22-48 36-56 14 8 30 26 36 56-12 8-24 12-36 12S40 86 28 78Z"
        fill={`url(#${fur})`}
      />
      <path
        d="M40 86c8-6 16-8 24-8s16 2 24 8c-6 8-14 12-24 12s-18-4-24-12Z"
        fill={`url(#${furDeep})`}
        opacity="0.55"
      />

      <path d="M34 52 46 22l14 28c-8 2-16 6-26 2Z" fill={`url(#${fur})`} />
      <path d="M94 52 82 22 68 50c8 2 16 6 26 2Z" fill={`url(#${fur})`} />
      <path d="M40 48 48 30l8 18c-4 1-8 2-16 0Z" fill="#FFD9A0" opacity="0.95" />
      <path d="M88 48 80 30l-8 18c4 1 8 2 16 0Z" fill="#FFD9A0" opacity="0.95" />
      <path
        d="M46 22 48 30M82 22 80 30"
        stroke="#BF360C"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.35"
      />

      <path
        className="bfox-mark__ember bfox-mark__ember--l"
        d="M22 86c8-12 16-18 24-20"
        stroke="#FF6B1A"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path
        className="bfox-mark__ember bfox-mark__ember--r"
        d="M106 86c-8-12-16-18-24-20"
        stroke="#FF6B1A"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.75"
      />

      <ellipse cx="64" cy="86" rx="22" ry="16" fill={`url(#${muzzle})`} />
      <path
        d="M52 82c4 3 8 4 12 4s8-1 12-4"
        stroke="#E8A86A"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />

      <ellipse cx="48" cy="66" rx="7" ry="9" fill="#1A0B08" />
      <ellipse cx="80" cy="66" rx="7" ry="9" fill="#1A0B08" />
      <ellipse cx="50" cy="63.5" rx="2.4" ry="3.2" fill="#FFF8F0" />
      <ellipse cx="82" cy="63.5" rx="2.4" ry="3.2" fill="#FFF8F0" />
      <circle cx="46.5" cy="69" r="1.2" fill="#FFF8F0" opacity="0.55" />
      <circle cx="78.5" cy="69" r="1.2" fill="#FFF8F0" opacity="0.55" />

      <path
        d="M64 78c-4.5 0-7.5 3-7.5 5.5 0 2.5 3.2 4.5 7.5 4.5s7.5-2 7.5-4.5C71.5 81 68.5 78 64 78Z"
        fill="#5C2410"
      />
      <ellipse cx="62.2" cy="80.2" rx="1.4" ry="1" fill="#FFB07A" opacity="0.45" />
      <path
        d="M56 92c3.5 4 6.5 5.5 8 5.5s4.5-1.5 8-5.5"
        stroke="#8B3A18"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** @deprecated Use BurningFoxMark */
export const JumpaMark = BurningFoxMark;
