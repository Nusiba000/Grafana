import React, { useMemo, useState } from 'react';
import DashboardCard from './DashboardCard';
import SearchBar from '../ui/SearchBar';
import FilterDropdown from '../ui/FilterDropdown';
import './DashboardList.css';

export const DASHBOARD_CATALOG = [
  {
    id: 'proxmox',
    groupLabel: 'Proxmox',
    sourceId: 'proxmox-prom',
    dashboards: [
      {
        title: 'System Metrics',
        description: 'Host and system metrics from the Proxmox Prometheus target.',
        path: '/dashboards/proxmox',
      },
    ],
  },
  {
    id: 'vcenter',
    groupLabel: 'vCenter',
    sourceId: 'vcenter-prom',
    dashboards: [
      {
        title: 'Collector Metrics',
        description: 'VMware collector metrics from the vCenter Prometheus target.',
        path: '/dashboards/vcenter',
      },
    ],
  },
  {
    id: 'nebula',
    groupLabel: 'Nebula',
    sourceId: 'nebulanew-prom',
    dashboards: [
      {
        title: 'Cluster Metrics',
        description: 'Cluster metrics from the Nebula Prometheus target.',
        path: '/dashboards/nebula',
      },
    ],
  },
];

const FILTER_ALL = 'all';

export default function DashboardList() {
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState(FILTER_ALL);

  const filterOptions = useMemo(() => {
    return [
      { value: FILTER_ALL, label: 'All data sources' },
      ...DASHBOARD_CATALOG.map((g) => ({ value: g.id, label: g.groupLabel })),
    ];
  }, []);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DASHBOARD_CATALOG.map((group) => {
      if (groupFilter !== FILTER_ALL && group.id !== groupFilter) {
        return { ...group, dashboards: [] };
      }
      const dashboards = group.dashboards.filter((d) => {
        if (!q) return true;
        return (
          d.title.toLowerCase().includes(q) ||
          (d.description && d.description.toLowerCase().includes(q)) ||
          group.groupLabel.toLowerCase().includes(q)
        );
      });
      return { ...group, dashboards };
    }).filter((g) => g.dashboards.length > 0);
  }, [query, groupFilter]);

  const totalCards = filteredGroups.reduce((n, g) => n + g.dashboards.length, 0);

  return (
    <div className="dashboard-list-page">
      <header className="dashboard-list-page__header card-like">
        <div>
          <h1 className="dashboard-list-page__title">Dashboards</h1>
          <p className="dashboard-list-page__sub">
            Browse metrics dashboards by Prometheus data source. {totalCards} dashboard
            {totalCards !== 1 ? 's' : ''} shown.
          </p>
        </div>
        <div className="dashboard-list-page__toolbar">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Search dashboards…"
            className="dashboard-list-page__search"
          />
          <FilterDropdown
            label="Source"
            value={groupFilter}
            options={filterOptions}
            onChange={setGroupFilter}
          />
        </div>
      </header>

      <div className="dashboard-list-page__body">
        {filteredGroups.length === 0 ? (
          <div className="dashboard-list-page__empty card-like">
            <p>No dashboards match your filters.</p>
          </div>
        ) : (
          filteredGroups.map((group) => (
            <section key={group.id} className="dashboard-list-page__section">
              <h2 className="dashboard-list-page__group-title">{group.groupLabel}</h2>
              <div className="dashboard-list-page__grid">
                {group.dashboards.map((d) => (
                  <DashboardCard
                    key={d.path}
                    title={d.title}
                    description={d.description}
                    to={d.path}
                    groupLabel={group.groupLabel}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
