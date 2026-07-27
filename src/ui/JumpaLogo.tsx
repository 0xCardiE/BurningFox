/** Angled “J” mark — source SVG `public/icons/jumpa-j-angled-logo.svg`. */

const MARK_FILENAME = 'jumpa-j-angled-logo.svg';

function resolveMarkUrl(): string {
  try {
    const u = chrome?.runtime?.getURL?.(`icons/${MARK_FILENAME}`);
    if (u) return u;
  } catch {
    /* not in extension context */
  }
  return `/icons/${MARK_FILENAME}`;
}

export function JumpaMark({
  className,
  size = 28,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <img
      src={resolveMarkUrl()}
      className={className}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
    />
  );
}
