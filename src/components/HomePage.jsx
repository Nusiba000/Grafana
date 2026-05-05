import React from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Bell,
  SlidersHorizontal,
  Activity,
  ArrowRight,
} from 'lucide-react';
import './HomePage.css';

/**
 * Landing view for Home — uses existing metrics list for counts and recent names only.
 */
export default function HomePage({ metrics = [] }) {
  const recent = metrics.slice(0, 18);

  const quickItems = [
    { to: '/dashboards', label: 'Dashboards', icon: LayoutDashboard },
    { to: '/alerts', label: 'Alerts', icon: Bell },
    { to: '/settings', label: 'Threshold Settings', icon: SlidersHorizontal },
    { to: '/dashboards/explorer', label: 'Metrics Explorer', icon: Activity },
  ];

  return (
    <div className="home-page">
      <section className="home-page__hero card-like">
        <img
          src="/opsight-logo.svg"
          alt=""
          className="home-page__hero-logo"
          width={48}
          height={48}
        />
        <div className="home-page__hero-text">
          <h1 className="home-page__hero-title">
            OpSight - Operations Insight Dashboard
          </h1>
          <p className="home-page__hero-sub">
            Real-time Prometheus metrics overview with automated JIRA alerting.
          </p>
        </div>
      </section>

      <div className="home-page__stats">
        <div className="home-page__stat card-like">
          <span className="home-page__stat-label">Total metrics count</span>
          <span className="home-page__stat-value">{metrics.length}</span>
        </div>
        <div className="home-page__stat card-like">
          <span className="home-page__stat-label">Active alerts</span>
          <span className="home-page__stat-value">0</span>
        </div>
        <div className="home-page__stat card-like">
          <span className="home-page__stat-label">
            Warning thresholds configured
          </span>
          <span className="home-page__stat-value">0</span>
        </div>
        <div className="home-page__stat card-like">
          <span className="home-page__stat-label">
            Critical thresholds configured
          </span>
          <span className="home-page__stat-value">0</span>
        </div>
      </div>

      <div className="home-page__columns">
        <section className="home-page__recent card-like">
          <div className="home-page__recent-head">
            <h2 className="home-page__section-title">Recent updated metrics</h2>
            <Link to="/dashboards/explorer" className="home-page__link-btn">
              Open Metrics
              <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
          <div className="home-page__pills">
            {recent.length === 0 ? (
              <p className="home-page__muted">No metrics loaded yet.</p>
            ) : (
              recent.map((m) => (
                <span key={m.name} className="home-page__pill">
                  {m.name}
                </span>
              ))
            )}
          </div>
        </section>

        <section className="home-page__quick card-like">
          <h2 className="home-page__section-title">Quick navigation</h2>
          <div className="home-page__quick-grid">
            {quickItems.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} className="home-page__quick-btn">
                <Icon size={22} strokeWidth={2} aria-hidden />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
