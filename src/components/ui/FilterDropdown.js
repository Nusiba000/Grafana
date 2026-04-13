import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Simple single-select dropdown for filtering lists.
 */
export default function FilterDropdown({
  label = 'Filter',
  value,
  options = [],
  onChange,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selected = options.find((o) => o.value === value) || options[0];

  return (
    <div className={`opsight-filter-dropdown ${className}`.trim()} ref={rootRef}>
      <span className="opsight-filter-dropdown__label">{label}</span>
      <button
        type="button"
        className="opsight-filter-dropdown__trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
      >
        <span>{selected?.label ?? '—'}</span>
        <ChevronDown size={16} className={open ? 'opsight-filter-dropdown__chev--open' : ''} aria-hidden />
      </button>
      {open && (
        <ul className="opsight-filter-dropdown__menu" role="listbox">
          {options.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                role="option"
                aria-selected={opt.value === value}
                className={
                  'opsight-filter-dropdown__option' +
                  (opt.value === value ? ' opsight-filter-dropdown__option--active' : '')
                }
                onClick={() => {
                  onChange && onChange(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
