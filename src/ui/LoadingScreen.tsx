import { BurnBoxMark } from './BurnBoxLogo';

export function LoadingScreen({ message }: { message?: string }) {
  return (
    <div
      className="loading-screen jumpa-loading-screen"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <BurnBoxMark className="loading-screen-logo" size={72} />
      <p className="loading-screen-brand">BurnBox</p>
      {message ? (
        <p className="loading-screen-message">{message}</p>
      ) : (
        <p className="loading-screen-message">Loading…</p>
      )}
      <span className="sr-only">Loading</span>
    </div>
  );
}
