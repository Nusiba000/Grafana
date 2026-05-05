import React from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, ChevronRight } from 'lucide-react';

export default function DashboardCard({
  title,
  description,
  to,
  groupLabel,
}) {
  return (
    <Link to={to} className="dashboard-card">
      <div className="dashboard-card__top">
        <div className="dashboard-card__icon" aria-hidden>
          <LayoutDashboard size={22} strokeWidth={2} />
        </div>
        {groupLabel && <span className="dashboard-card__badge">{groupLabel}</span>}
      </div>
      <h3 className="dashboard-card__title">{title}</h3>
      {description && <p className="dashboard-card__desc">{description}</p>}
      <span className="dashboard-card__cta">
        Open dashboard
        <ChevronRight size={16} aria-hidden />
      </span>
    </Link>
  );
}
