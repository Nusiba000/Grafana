import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './components/HomePage';
import MainLayout from './components/layout/MainLayout';
import DashboardList from './components/dashboard/DashboardList';
import MetricsDashboard from './components/dashboard/MetricsDashboard';
import DataSourcesPage from './components/pages/DataSourcesPage';
import AlertsPage from './components/pages/AlertsPage';
import SettingsPage from './components/pages/SettingsPage';
import './App.css';

export default function App() {
  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/dashboards" element={<DashboardList />} />
        {/* Explorer defaults to proxmox — the backend requires an explicit source */}
        <Route path="/dashboards/explorer" element={<MetricsDashboard key="proxmox-prom" source="proxmox-prom" />} />
        <Route path="/dashboards/proxmox"  element={<MetricsDashboard key="proxmox-prom"    source="proxmox-prom"    />} />
        <Route path="/dashboards/vcenter"  element={<MetricsDashboard key="vcenter-prom"    source="vcenter-prom"    />} />
        <Route path="/dashboards/nebula"   element={<MetricsDashboard key="nebulanew-prom"  source="nebulanew-prom"  />} />
        <Route path="/alerts"        element={<AlertsPage />} />
        <Route path="/data-sources"  element={<DataSourcesPage />} />
        <Route path="/settings"      element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </MainLayout>
  );
}
