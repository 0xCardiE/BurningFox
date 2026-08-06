/** Hero branding — CRT skull + 1337 wordmark (public/icons). */

const SKULL_SRC = 'icons/l33t-skull.png';
const WORDMARK_SRC = 'icons/l33t-wordmark.png';

export function L33tBrand({
  skullSize = 88,
  wordmarkWidth = 200,
  className,
}: {
  skullSize?: number;
  wordmarkWidth?: number;
  className?: string;
}) {
  return (
    <div className={`l33t-brand${className ? ` ${className}` : ''}`}>
      <img
        src={SKULL_SRC}
        alt=""
        className="l33t-brand__skull"
        width={skullSize}
        height={Math.round(skullSize * (125 / 110))}
        decoding="async"
        draggable={false}
      />
      <img
        src={WORDMARK_SRC}
        alt="1337"
        className="l33t-brand__wordmark"
        width={wordmarkWidth}
        height={Math.round(wordmarkWidth * (126 / 329))}
        decoding="async"
        draggable={false}
      />
    </div>
  );
}
