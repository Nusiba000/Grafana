import React from 'react';
import { Settings } from 'lucide-react';
import './PlaceholderPages.css';

export default function SettingsPage() {
  return (
    <div className="opsight-page">
      <header className="opsight-page__header card-like">
        <div className="opsight-page__header-icon" aria-hidden>
          <Settings size={24} />
        </div>
        <div>
          <h1 className="opsight-page__title">Settings</h1>
          <p className="opsight-page__sub">Application preferences and configuration (coming soon).</p>
        </div>
      </header>
      <div className="opsight-placeholder card-like">
        <p className="opsight-placeholder__muted">This section is under construction.</p>
      </div>
    </div>
  );
}
