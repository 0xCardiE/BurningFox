/** 1337 mark — pixel "13/37" glyph; static source also at `public/icons/l33t-logo.svg`. */

const CELL = 10;
const GRID_W = 7;
const GRID_H = 11;
const OX = (128 - GRID_W * CELL) / 2;
const OY = (128 - GRID_H * CELL) / 2;

// "13" over "37" in a 3x5 pixel font.
const PIXEL_ROWS = [
  '.#..###',
  '##....#',
  '.#..###',
  '.#....#',
  '###.###',
  '.......',
  '###.###',
  '..#...#',
  '###...#',
  '..#...#',
  '###...#',
] as const;

const PIXELS: Array<[number, number]> = [];
PIXEL_ROWS.forEach((row, y) => {
  for (let x = 0; x < row.length; x++) {
    if (row[x] === '#') PIXELS.push([OX + x * CELL, OY + y * CELL]);
  }
});

export function L33tMark({
  className,
  size = 28,
  animated = true,
}: {
  className?: string;
  size?: number;
  /** When false, skips idle/hover glow (e.g. tiny toolbar contexts). Default true. */
  animated?: boolean;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      width={size}
      height={size}
      className={`l33t-mark${animated ? ' l33t-mark--live' : ''}${className ? ` ${className}` : ''}`}
      fill="none"
      role="img"
      aria-hidden
      focusable="false"
    >
      <rect width="128" height="128" rx="24" fill="#050806" />
      <rect
        x="4"
        y="4"
        width="120"
        height="120"
        rx="20"
        stroke="rgba(34, 197, 94, 0.35)"
        strokeWidth="2"
      />
      <g className="l33t-mark__glyph" fill="#22c55e">
        {PIXELS.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={CELL} height={CELL} />
        ))}
      </g>
    </svg>
  );
}
