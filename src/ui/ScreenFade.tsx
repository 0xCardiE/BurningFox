import type { ReactNode } from 'react';

/** Outer key remount triggers enter animation inside. */
export function ScreenFade({
  routeKey,
  children,
}: {
  routeKey: string;
  children: ReactNode;
}) {
  return (
    <div key={routeKey} className="jumpa-route-root">
      <div className="jumpa-route-layer">{children}</div>
    </div>
  );
}
