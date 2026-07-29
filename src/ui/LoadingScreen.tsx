import { L33tMark } from './L33tMark';

export function LoadingScreen({ message }: { message?: string }) {
  return (
    <div
      className="loading-screen leet-loading-screen"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <L33tMark className="loading-screen-logo" size={72} />
      <p className="loading-screen-brand">1337</p>
      {message ? (
        <p className="loading-screen-message">{message}</p>
      ) : (
        <p className="loading-screen-message">Loading…</p>
      )}
      <span className="sr-only">Loading</span>
    </div>
  );
}
