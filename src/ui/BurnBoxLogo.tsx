import { useId } from 'react';

/** BurnBox mark — animated inline SVG; static source also at `public/icons/burnbox-logo.svg`. */

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
  const glow = `bbGlow-${uid}`;
  const box = `bbBox-${uid}`;
  const boxDeep = `bbBoxDeep-${uid}`;
  const lid = `bbLid-${uid}`;
  const flameOuter = `bbFlameOuter-${uid}`;
  const flameInner = `bbFlameInner-${uid}`;
  const glowIn = `bbGlowIn-${uid}`;
  const soft = `bbSoft-${uid}`;

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
        <radialGradient id={glow} cx="64" cy="72" r="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF8A3D" stopOpacity="0.55" />
          <stop offset="0.55" stopColor="#FF5A1F" stopOpacity="0.22" />
          <stop offset="1" stopColor="#FF3D00" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={box} x1="28" y1="48" x2="100" y2="112" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFB14A" />
          <stop offset="0.45" stopColor="#FF7A1A" />
          <stop offset="1" stopColor="#E04800" />
        </linearGradient>
        <linearGradient id={boxDeep} x1="64" y1="56" x2="64" y2="112" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF8C2E" />
          <stop offset="1" stopColor="#C43A00" />
        </linearGradient>
        <linearGradient id={lid} x1="30" y1="44" x2="98" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFC14A" />
          <stop offset="1" stopColor="#FF6A00" />
        </linearGradient>
        <linearGradient id={flameOuter} x1="64" y1="4" x2="64" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE566" />
          <stop offset="0.4" stopColor="#FF9A1A" />
          <stop offset="1" stopColor="#FF4D00" />
        </linearGradient>
        <linearGradient id={flameInner} x1="64" y1="10" x2="64" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF6C8" />
          <stop offset="0.5" stopColor="#FFD24A" />
          <stop offset="1" stopColor="#FF8A00" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id={glowIn} x1="64" y1="58" x2="64" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF3E0" stopOpacity="0.95" />
          <stop offset="1" stopColor="#FFD7A8" stopOpacity="0.35" />
        </linearGradient>
        <filter id={soft} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle className="bbox-mark__glow" cx="64" cy="70" r="56" fill={`url(#${glow})`} />

      <g className="bbox-mark__flames" filter={`url(#${soft})`}>
        <path
          className="bbox-mark__flame bbox-mark__flame--l"
          d="M40 52c-2-16 5-28 12-34 1 9 4 15 8 19-8 2-14 8-20 15Z"
          fill={`url(#${flameOuter})`}
          opacity="0.95"
        />
        <path
          className="bbox-mark__flame bbox-mark__flame--c"
          d="M64 4c-3 11-2 22 1 30 4-10 10-16 16-19-4 11-4 22-2 30C70 32 64 18 64 4Z"
          fill={`url(#${flameOuter})`}
        />
        <path
          className="bbox-mark__flame bbox-mark__flame--r"
          d="M88 52c2-16-5-28-12-34-1 9-4 15-8 19 8 2 14 8 20 15Z"
          fill={`url(#${flameOuter})`}
          opacity="0.95"
        />
        <path
          className="bbox-mark__flame bbox-mark__flame--li"
          d="M50 48c0-11 4-19 8-23 2 7 4 12 5 17-5 1-9 4-13 6Z"
          fill={`url(#${flameInner})`}
          opacity="0.9"
        />
        <path
          className="bbox-mark__flame bbox-mark__flame--ci"
          d="M64 14c-1 8 0 14 2 20 3-7 6-11 10-14-3 8-3 14-1 20-5-6-9-14-11-26Z"
          fill={`url(#${flameInner})`}
        />
        <path
          className="bbox-mark__flame bbox-mark__flame--ri"
          d="M78 48c0-11-4-19-8-23-2 7-4 12-5 17 5 1 9 4 13 6Z"
          fill={`url(#${flameInner})`}
          opacity="0.9"
        />
      </g>

      <path
        d="M30 56h68v48c0 6-5 10-11 10H41c-6 0-11-4-11-10V56Z"
        fill={`url(#${box})`}
      />
      <path
        d="M36 104h56c4 0 7-2 7-5v-8H29v8c0 3 3 5 7 5Z"
        fill={`url(#${boxDeep})`}
        opacity="0.55"
      />

      <path
        d="M28 56c2-10 10-16 18-18l42-6c8-1 16 4 18 14L98 56H30Z"
        fill={`url(#${lid})`}
      />
      <path
        d="M32 54h64"
        stroke="#BF360C"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.28"
      />

      <ellipse cx="64" cy="78" rx="22" ry="14" fill={`url(#${glowIn})`} />
      <path
        d="M48 72c5 4 10 6 16 6s11-2 16-6"
        stroke="#E8A86A"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />

      <rect x="46" y="86" width="36" height="8" rx="3" fill="#FFF3E0" opacity="0.35" />
      <path
        d="M52 90h24"
        stroke="#8B3A18"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.55"
      />

      <path
        className="bbox-mark__ember bbox-mark__ember--l"
        d="M22 78c6-8 12-12 18-14"
        stroke="#FF6B1A"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path
        className="bbox-mark__ember bbox-mark__ember--r"
        d="M106 78c-6-8-12-12-18-14"
        stroke="#FF6B1A"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.75"
      />
    </svg>
  );
}

/** @deprecated Use BurnBoxMark */
export const BurningFoxMark = BurnBoxMark;
/** @deprecated Use BurnBoxMark */
export const JumpaMark = BurnBoxMark;
