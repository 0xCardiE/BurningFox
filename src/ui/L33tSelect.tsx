import { useEffect, useRef } from 'react';
import { LeetLiFiIcon } from './LeetLiFiIcon';

export type L33tSelectOption = {
  value: string;
  label: string;
  sublabel?: string;
  logoURI?: string;
};

export type L33tSelectGroup = {
  label: string;
  options: L33tSelectOption[];
};

function ChevronDownIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function OptionLogo({ logoURI, label }: { logoURI?: string; label: string }) {
  return <LeetLiFiIcon logoURI={logoURI} label={label} size={24} rounded />;
}

export function L33tSelect({
  id,
  label,
  openMenu,
  setOpenMenu,
  value,
  triggerLabel,
  triggerSublabel,
  triggerLogoURI,
  groups,
  onPick,
  disabled,
  panelMaxHeight = 280,
}: {
  id: string;
  label: string;
  openMenu: string | null;
  setOpenMenu: (v: string | null) => void;
  value: string;
  triggerLabel: string;
  triggerSublabel?: string;
  triggerLogoURI?: string;
  groups: L33tSelectGroup[];
  onPick: (value: string) => void;
  disabled?: boolean;
  panelMaxHeight?: number;
}) {
  const open = openMenu === id;
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, setOpenMenu]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpenMenu]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const onWheel = (e: WheelEvent) => {
      if (panel.scrollHeight <= panel.clientHeight) return;
      const atTop = panel.scrollTop <= 0;
      const atBottom = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1;
      if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) {
        e.preventDefault();
      }
      e.stopPropagation();
    };

    panel.addEventListener('wheel', onWheel, { passive: false });
    return () => panel.removeEventListener('wheel', onWheel);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`l33t-dd${open ? ' l33t-dd--open' : ''}`}
    >
      <span className="l33t-dd__label">{label}</span>
      <button
        type="button"
        className={`l33t-dd__trigger${open ? ' l33t-dd__trigger--open' : ''}`}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={triggerSublabel ?? triggerLabel}
        onClick={() => setOpenMenu(open ? null : id)}
      >
        <span className="l33t-dd__trigger-main">
          {triggerLogoURI ? (
            <OptionLogo logoURI={triggerLogoURI} label={triggerLabel} />
          ) : null}
          <span className="l33t-dd__trigger-text">
            <span className="l33t-dd__trigger-value">{triggerLabel}</span>
            {triggerSublabel ? (
              <span className="l33t-dd__trigger-sub">{triggerSublabel}</span>
            ) : null}
          </span>
        </span>
        <span className="l33t-dd__chev" aria-hidden>
          <ChevronDownIcon />
        </span>
      </button>
      {open ? (
        <div
          ref={panelRef}
          className="l33t-dd__panel"
          role="listbox"
          aria-label={label}
          style={{ maxHeight: panelMaxHeight }}
        >
          {groups.map(group => (
            <div key={group.label} className="l33t-dd__group">
              {groups.length > 1 ? (
                <div className="l33t-dd__group-label">{group.label}</div>
              ) : null}
              {group.options.map(opt => {
                const selected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`l33t-dd__option${selected ? ' l33t-dd__option--on' : ''}`}
                    title={opt.sublabel ?? opt.label}
                    onClick={() => {
                      onPick(opt.value);
                      setOpenMenu(null);
                    }}
                  >
                    <span className="l33t-dd__option-main">
                      <OptionLogo logoURI={opt.logoURI} label={opt.label} />
                      <span className="l33t-dd__option-text">
                        <span className="l33t-dd__option-label">{opt.label}</span>
                        {opt.sublabel ? (
                          <span className="l33t-dd__option-sub">{opt.sublabel}</span>
                        ) : null}
                      </span>
                    </span>
                    {selected ? (
                      <span className="l33t-dd__check" aria-hidden>
                        <CheckIcon />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function L33tSegmented({
  value,
  onChange,
  options,
  ariaLabel = 'Options',
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; title?: string }[];
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={`l33t-seg${className ? ` ${className}` : ''}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          className={`l33t-seg__btn${value === opt.value ? ' l33t-seg__btn--on' : ''}`}
          title={opt.title}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
