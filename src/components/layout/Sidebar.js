import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  LayoutDashboard,
  Bell,
  Database,
  Settings,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
  Server,
  Cloud,
  Layers,
  Compass,
  List,
  Activity,
} from 'lucide-react';

function NavItem({ to, end, icon: Icon, children }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        'layout-sidebar__link layout-sidebar__sublink' +
        (isActive ? ' layout-sidebar__link--active' : '')
      }
    >
      <Icon size={18} strokeWidth={2} aria-hidden />
      <span>{children}</span>
    </NavLink>
  );
}

function NavSection({ title, icon: Icon, defaultOpen = true, children, isGroupActive }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={'layout-sidebar__section' + (isGroupActive ? ' layout-sidebar__section--active' : '')}>
      <button
        type="button"
        className="layout-sidebar__section-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Icon size={20} strokeWidth={2} aria-hidden />
        <span className="layout-sidebar__section-title">{title}</span>
        <ChevronDown
          size={16}
          className={'layout-sidebar__chev' + (open ? ' layout-sidebar__chev--open' : '')}
          aria-hidden
        />
      </button>
      {open && <div className="layout-sidebar__section-body">{children}</div>}
    </div>
  );
}

const COLLAPSED_LINKS = [
  { to: '/home', end: true, icon: Home, title: 'Home' },
  { to: '/dashboards', end: true, icon: LayoutDashboard, title: 'All Dashboards' },
  { to: '/dashboards/proxmox', icon: Server, title: 'Proxmox' },
  { to: '/dashboards/vcenter', icon: Layers, title: 'vCenter' },
  { to: '/dashboards/nebula', icon: Cloud, title: 'Nebula' },
  { to: '/dashboards/explorer', icon: Compass, title: 'Metrics Explorer' },
  { to: '/alerts', icon: Bell, title: 'Active Alerts' },
  { to: '/data-sources', icon: Database, title: 'Data Sources' },
  { to: '/settings', icon: Settings, title: 'Settings' },
];

export default function Sidebar({ collapsed, onToggleCollapse }) {
  const location = useLocation();
  const path = location.pathname;

  const dashboardsActive = path.startsWith('/dashboards');
  const alertsActive = path.startsWith('/alerts');
  const dataSourcesActive = path.startsWith('/data-sources');

  return (
    <aside className="layout-sidebar" aria-label="Main navigation">
      <div className="layout-sidebar__brand">
        <div className="layout-sidebar__brand-mark" aria-hidden>
          O
        </div>
        {!collapsed && <span className="layout-sidebar__brand-text">OpSight</span>}
      </div>

      <nav className="layout-sidebar__nav">
        {collapsed ? (
          COLLAPSED_LINKS.map(({ to, end, icon: Icon, title }) => (
            <NavLink
              key={to + (end ? '-end' : '')}
              to={to}
              end={end}
              title={title}
              className={({ isActive }) =>
                'layout-sidebar__link' + (isActive ? ' layout-sidebar__link--active' : '')
              }
            >
              <Icon size={20} strokeWidth={2} aria-hidden />
            </NavLink>
          ))
        ) : (
          <>
            <NavLink
              to="/home"
              end
              className={({ isActive }) =>
                'layout-sidebar__link' + (isActive ? ' layout-sidebar__link--active' : '')
              }
            >
              <Home size={20} strokeWidth={2} aria-hidden />
              <span>Home</span>
            </NavLink>

            <NavSection title="Dashboards" icon={LayoutDashboard} isGroupActive={dashboardsActive}>
              <NavItem to="/dashboards" end icon={List}>
                All Dashboards
              </NavItem>
              <NavItem to="/dashboards/proxmox" icon={Server}>
                Proxmox
              </NavItem>
              <NavItem to="/dashboards/vcenter" icon={Layers}>
                vCenter
              </NavItem>
              <NavItem to="/dashboards/nebula" icon={Cloud}>
                Nebula
              </NavItem>
              <NavItem to="/dashboards/explorer" icon={Compass}>
                Metrics Explorer
              </NavItem>
            </NavSection>

            <NavSection title="Alerts" icon={Bell} isGroupActive={alertsActive}>
              <NavItem to="/alerts" icon={Activity}>
                Active Alerts
              </NavItem>
            </NavSection>

            <NavSection title="Data Sources" icon={Database} isGroupActive={dataSourcesActive}>
              <NavItem to="/data-sources" icon={List}>
                List Data Sources
              </NavItem>
            </NavSection>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                'layout-sidebar__link' + (isActive ? ' layout-sidebar__link--active' : '')
              }
            >
              <Settings size={20} strokeWidth={2} aria-hidden />
              <span>Settings</span>
            </NavLink>
          </>
        )}
      </nav>

      <div className="layout-sidebar__footer">
        <button
          type="button"
          className="layout-sidebar__collapse-btn"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
