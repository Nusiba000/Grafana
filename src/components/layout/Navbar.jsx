import React from 'react';
import { Search, User, RefreshCw } from 'lucide-react';

export default function Navbar({ sectionLabel = 'Home', onRefresh }) {
  return (
    <header className="layout-navbar">
      <div className="layout-navbar__left">
        <img
          src="/opsight-logo.svg"
          alt=""
          className="layout-navbar__logo"
          width={40}
          height={40}
        />
        <span className="layout-navbar__title">OpSight</span>
        <span className="layout-navbar__crumb">{sectionLabel}</span>
      </div>
      <div className="layout-navbar__center">
        <div className="layout-navbar__search-wrap">
          <Search
            className="layout-navbar__search-icon"
            size={18}
            strokeWidth={2}
            aria-hidden
          />
          <input
            type="search"
            className="layout-navbar__search"
            placeholder="Search (coming soon)..."
            aria-label="Search"
          />
        </div>
      </div>
      <div className="layout-navbar__right">
        <div className="layout-navbar__status" role="status">
          <span className="layout-navbar__status-dot" aria-hidden />
          <span>Connected to ODP MAIN</span>
        </div>
        {typeof onRefresh === 'function' && (
          <button
            type="button"
            className="layout-navbar__icon-btn"
            aria-label="Refresh data"
            onClick={onRefresh}
          >
            <RefreshCw size={18} strokeWidth={2} />
          </button>
        )}
        <button
          type="button"
          className="layout-navbar__profile layout-navbar__profile--labeled"
          aria-label="Profile"
        >
          <User size={18} strokeWidth={2} />
          <span className="layout-navbar__profile-text">Profile</span>
        </button>
      </div>
    </header>
  );
}
