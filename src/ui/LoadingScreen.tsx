import { L33tBrand } from './L33tBrand';

export function LoadingScreen({ message }: { message?: string }) {
  return (
    <div
      className="loading-screen leet-loading-screen"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <L33tBrand className="loading-screen-brand-stack" skullSize={80} wordmarkWidth={180} />
      {message ? (
        <p className="loading-screen-message">{message}</p>
      ) : (
        <p className="loading-screen-message">Loading…</p>
      )}
      <span className="sr-only">Loading</span>
    </div>
  );
}
