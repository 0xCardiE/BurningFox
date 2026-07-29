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
    <div key={routeKey} className="leet-route-root">
      <div className="leet-route-layer">{children}</div>
    </div>
  );
}
