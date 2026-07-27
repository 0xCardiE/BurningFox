import type { ReactNode } from 'react';
import { BurnBoxMark } from './BurnBoxLogo';

type Props = {
  title: string;
  /** If set, shows MetaMask-style ✕ (same as navigate back). */
  onClose?: () => void;
  /** Extra controls on the right (e.g. settings). Shown before the close button. */
  trailing?: ReactNode;
};

export function ScreenHeader({ title, onClose, trailing }: Props) {
  return (
    <header className="screen-header">
      <div className="screen-header-left">
        <BurnBoxMark className="screen-header-logo" size={26} />
      </div>
      <h1 className="screen-header-title">{title}</h1>
      <div className="screen-header-right">
        {trailing}
        {onClose ? (
          <button
            type="button"
            className="screen-header-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        ) : null}
      </div>
    </header>
  );
}
