/** Compact skull mark for headers and toolbar contexts. */

const SKULL_SRC = 'icons/l33t-skull.png';

export function L33tMark({
  className,
  size = 28,
  animated = true,
}: {
  className?: string;
  size?: number;
  /** When false, skips idle/hover glow. Default true. */
  animated?: boolean;
}) {
  const height = Math.round(size * (125 / 110));
  return (
    <img
      src={SKULL_SRC}
      alt=""
      width={size}
      height={height}
      className={`l33t-mark${animated ? ' l33t-mark--live' : ''}${className ? ` ${className}` : ''}`}
      decoding="async"
      draggable={false}
    />
  );
}
