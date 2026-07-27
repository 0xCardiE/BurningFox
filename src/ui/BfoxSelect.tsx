import { useEffect, useRef } from 'react';
import { JumpaLiFiIcon } from './JumpaLiFiIcon';

export type BfoxSelectOption = {
  value: string;
  label: string;
  sublabel?: string;
  logoURI?: string;
};

export type BfoxSelectGroup = {
  label: string;
  options: BfoxSelectOption[];
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
  return <JumpaLiFiIcon logoURI={logoURI} label={label} size={24} rounded />;
}

export function BfoxSelect({
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
  groups: BfoxSelectGroup[];
  onPick: (value: string) => void;
  disabled?: boolean;
  panelMaxHeight?: number;
}) {
  const open = openMenu === id;
  const rootRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={rootRef}
      className={`bfox-dd${open ? ' bfox-dd--open' : ''}`}
    >
      <span className="bfox-dd__label">{label}</span>
      <button
        type="button"
        className={`bfox-dd__trigger${open ? ' bfox-dd__trigger--open' : ''}`}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={triggerSublabel ?? triggerLabel}
        onClick={() => setOpenMenu(open ? null : id)}
      >
        <span className="bfox-dd__trigger-main">
          {triggerLogoURI ? (
            <OptionLogo logoURI={triggerLogoURI} label={triggerLabel} />
          ) : null}
          <span className="bfox-dd__trigger-text">
            <span className="bfox-dd__trigger-value">{triggerLabel}</span>
            {triggerSublabel ? (
              <span className="bfox-dd__trigger-sub">{triggerSublabel}</span>
            ) : null}
          </span>
        </span>
        <span className="bfox-dd__chev" aria-hidden>
          <ChevronDownIcon />
        </span>
      </button>
      {open ? (
        <div
          className="bfox-dd__panel"
          role="listbox"
          aria-label={label}
          style={{ maxHeight: panelMaxHeight }}
        >
          {groups.map(group => (
            <div key={group.label} className="bfox-dd__group">
              {groups.length > 1 ? (
                <div className="bfox-dd__group-label">{group.label}</div>
              ) : null}
              {group.options.map(opt => {
                const selected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`bfox-dd__option${selected ? ' bfox-dd__option--on' : ''}`}
                    title={opt.sublabel ?? opt.label}
                    onClick={() => {
                      onPick(opt.value);
                      setOpenMenu(null);
                    }}
                  >
                    <span className="bfox-dd__option-main">
                      <OptionLogo logoURI={opt.logoURI} label={opt.label} />
                      <span className="bfox-dd__option-text">
                        <span className="bfox-dd__option-label">{opt.label}</span>
                        {opt.sublabel ? (
                          <span className="bfox-dd__option-sub">{opt.sublabel}</span>
                        ) : null}
                      </span>
                    </span>
                    {selected ? (
                      <span className="bfox-dd__check" aria-hidden>
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

export function BfoxSegmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="bfox-seg" role="tablist" aria-label="Network type">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          className={`bfox-seg__btn${value === opt.value ? ' bfox-seg__btn--on' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
