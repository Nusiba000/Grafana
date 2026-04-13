import React from 'react';
import { Database } from 'lucide-react';
import './PlaceholderPages.css';

const SOURCES = [
  {
    id: 'proxmox-prom',
    name: 'proxmox-prom',
    summary: 'Proxmox virtualization metrics',
  },
  {
    id: 'vcenter-prom',
    name: 'vcenter-prom',
    summary: 'VMware vCenter collector metrics',
  },
  {
    id: 'nebulanew-prom',
    name: 'nebulanew-prom',
    summary: 'Nebula cluster metrics',
  },
];

export default function DataSourcesPage() {
  return (
    <div className="opsight-page">
      <header className="opsight-page__header card-like">
        <div className="opsight-page__header-icon" aria-hidden>
          <Database size={24} />
        </div>
        <div>
          <h1 className="opsight-page__title">Data sources</h1>
          <p className="opsight-page__sub">
            Read-only list of configured Prometheus targets available to OpSight.
          </p>
        </div>
      </header>

      <ul className="opsight-page__list">
        {SOURCES.map((s) => (
          <li key={s.id} className="opsight-source-card card-like">
            <div className="opsight-source-card__head">
              <span className="opsight-source-card__id">{s.name}</span>
              <span className="opsight-source-card__pill">Prometheus</span>
            </div>
            <p className="opsight-source-card__summary">{s.summary}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
