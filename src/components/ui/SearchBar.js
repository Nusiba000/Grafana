import React from 'react';
import { Search } from 'lucide-react';

/**
 * OpSight-styled search input for dashboard filters.
 */
export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
  id = 'opsight-search',
}) {
  return (
    <div className={`opsight-search-bar ${className}`.trim()}>
      <Search className="opsight-search-bar__icon" size={18} strokeWidth={2} aria-hidden />
      <input
        id={id}
        type="search"
        className="opsight-search-bar__input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        aria-label={placeholder}
      />
    </div>
  );
}
