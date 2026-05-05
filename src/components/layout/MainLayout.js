import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import './MainLayout.css';

const SECTION_RULES = [
  [/^\/home\/?$/, 'Home'],
  [/^\/dashboards\/?$/, 'All Dashboards'],
  [/^\/dashboards\/proxmox/, 'Proxmox · System Metrics'],
  [/^\/dashboards\/vcenter/, 'vCenter · Collector Metrics'],
  [/^\/dashboards\/nebula/, 'Nebula · Cluster Metrics'],
  [/^\/dashboards\/explorer/, 'Metrics Explorer'],
  [/^\/alerts/, 'Active Alerts'],
  [/^\/data-sources/, 'List Data Sources'],
  [/^\/settings/, 'Settings'],
];

function sectionLabelFromPath(pathname) {
  for (const [re, label] of SECTION_RULES) {
    if (re.test(pathname)) return label;
  }
  return 'OpSight';
}

export default function MainLayout({ children, onRefresh }) {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const sectionLabel = useMemo(
    () => sectionLabelFromPath(location.pathname),
    [location.pathname]
  );

  return (
    <div
      className={
        'main-layout' + (sidebarCollapsed ? ' main-layout--sidebar-collapsed' : '')
      }
    >
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />
      <div className="main-layout__column">
        <Navbar sectionLabel={sectionLabel} onRefresh={onRefresh} />
        <div className="main-layout__content">{children}</div>
      </div>
    </div>
  );
}
