import React from 'react';
import { Bell } from 'lucide-react';
import './PlaceholderPages.css';

export default function AlertsPage() {
  return (
    <div className="opsight-page">
      <header className="opsight-page__header card-like">
        <div className="opsight-page__header-icon" aria-hidden>
          <Bell size={24} />
        </div>
        <div>
          <h1 className="opsight-page__title">Active alerts</h1>
          <p className="opsight-page__sub">
            Alerting views will appear here. Threshold-based JIRA workflows continue to run from the
            metrics explorer and dashboard views.
          </p>
        </div>
      </header>
      <div className="opsight-placeholder card-like">
        <p className="opsight-placeholder__muted">No active alert items in this view yet.</p>
      </div>
    </div>
  );
}
