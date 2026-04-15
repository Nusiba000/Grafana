import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import HomePage from './components/HomePage';
import MainLayout from './components/layout/MainLayout';
import DashboardList from './components/dashboard/DashboardList';
import MetricsDashboard from './components/dashboard/MetricsDashboard';
import DataSourcesPage from './components/pages/DataSourcesPage';
import AlertsPage from './components/pages/AlertsPage';
import SettingsPage from './components/pages/SettingsPage';
import './App.css';

/** Stable key so `/` and `/home` do not double-fetch the default catalog. */
function getMetricsFetchKey(pathname) {
  if (
    pathname === '/' ||
    pathname === '/home' ||
    pathname.startsWith('/dashboards/explorer')
  ) {
    return 'default';
  }
  if (pathname.startsWith('/dashboards/proxmox')) return 'proxmox-prom';
  if (pathname.startsWith('/dashboards/vcenter')) return 'vcenter-prom';
  if (pathname.startsWith('/dashboards/nebula')) return 'nebulanew-prom';
  return null;
}

function AppRoutes() {
  const getDefaultMetric = (metrics, source) => {
  if (!metrics || metrics.length === 0) return null;

  switch (source) {
    case "proxmox-prom":
      return (
        metrics.find(m => m.name.toLowerCase().includes("pve")) ||
        metrics.find(m => m.name.toLowerCase().includes("cpu")) ||
        metrics[0]
      );

    case "nebulanew-prom":
      return (
        metrics.find(m => m.name.toLowerCase().includes("kube")) ||
        metrics.find(m => m.name.toLowerCase().includes("pod")) ||
        metrics[0]
      );

    case "vcenter-prom":
      return (
        metrics.find(m => m.name.toLowerCase().includes("vm")) ||
        metrics.find(m => m.name.toLowerCase().includes("cpu")) ||
        metrics[0]
      );

    default:
      return metrics[0];
  }
};
  const location = useLocation();
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastFetchConfigRef = useRef({ source: undefined });
  const initialFetchDoneRef = useRef(false);

  const fetchMetrics = async (options) => {
    const silent = options && options.silent;
    const background = options && options.background;
    const source = options && options.source;
    const blockUi = !silent && !background;

    try {
      setError(null);
      if (blockUi) setLoading(true);

      const labelUrl = source
        ? `/api/v1/label/__name__/values?source=${encodeURIComponent(source)}`
        : '/api/v1/label/__name__/values';

      const response = await fetch(labelUrl);
      const data = await response.json();

      if (data.status === 'success' && data.data) {
        const metricNames = data.data;
        const parsedMetrics = [];

        const metadataUrl = source
        ? `/api/v1/metadata?source=${encodeURIComponent(source)}`
        : '/api/v1/metadata';

        const metadataResponse = await fetch(metadataUrl);
        const metadataData = await metadataResponse.json();

        metricNames.forEach((name) => {
          const metadata = metadataData.data[name];
          if (metadata && metadata.length > 0) {
            parsedMetrics.push({
              name,
              description: metadata[0].help || 'No description available',
              type: metadata[0].type || 'unknown',
              help: metadata[0].help || 'No description available',
            });
          } else {
            parsedMetrics.push({
              name,
              description: 'No description available',
              type: 'unknown',
              help: 'No description available',
            });
          }
        });

        setMetrics(parsedMetrics);
        // SMART SELECTION BASED ON DATASOURCE
        const defaultMetric = getDefaultMetric(parsedMetrics, source);
        setSelectedMetric(defaultMetric);

        setError (null);
        initialFetchDoneRef.current = true;

      } else {
        setError('Failed to parse metrics data');
      }

      if (blockUi) setLoading(false);
    } catch (err) {
      setError('Failed to fetch metrics: ' + err.message);
      if (blockUi) setLoading(false);
    }
  };

  useEffect(() => {
    const key = getMetricsFetchKey(location.pathname);

    if (key === null) {
      setLoading(false);
      return;
    }
    const source = key === 'default' ? undefined : key;
    // Store current source
    lastFetchConfigRef.current = { source };
    // FORCE reset metric BEFORE fetching
    setSelectedMetric(null);
    const background = initialFetchDoneRef.current;
    // Fetch metrics for new source
    fetchMetrics({ source, background });
  },[location.pathname]);

  const handleMetricSelect = (metric) => {
    setSelectedMetric(metric);
  };

  if (loading && metrics.length === 0) {
    return (
      <div className="loading">
        <img src="/opsight-logo.svg" alt="OpSight Logo" className="loading-logo animate-spin" />
        <span className="ml-2">Loading OpSight metrics...</span>
      </div>
    );
  }

  if (error && metrics.length === 0) {
    return (
      <div className="error">
        <h2>Error</h2>
        <p>{error}</p>
        <button
          className="btn btn-primary mt-4"
          type="button"
          onClick={() =>
            fetchMetrics({ source: lastFetchConfigRef.current.source, background: false })
          }
        >
          Retry
        </button>
      </div>
    );
  }

  const refresh = () => {
    const { source } = lastFetchConfigRef.current;
    fetchMetrics({ silent: true, background: true, source });
  };

  return (
    <MainLayout onRefresh={refresh}>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomePage metrics={metrics} />} />
        <Route path="/dashboards" element={<DashboardList />} />
        <Route
          path="/dashboards/explorer"
          element={
            <MetricsDashboard
              metrics={metrics}
              selectedMetric={selectedMetric}
              onMetricSelect={handleMetricSelect}
            />
          }
        />
        <Route
          path="/dashboards/proxmox"
          element={
            <MetricsDashboard
              metrics={metrics}
              selectedMetric={selectedMetric}
              onMetricSelect={handleMetricSelect}
              source="proxmox-prom"
            />
          }
        />
        <Route
          path="/dashboards/vcenter"
          element={
            <MetricsDashboard
              metrics={metrics}
              selectedMetric={selectedMetric}
              onMetricSelect={handleMetricSelect}
              source="vcenter-prom"
            />
          }
        />
        <Route
          path="/dashboards/nebula"
          element={
            <MetricsDashboard
              metrics={metrics}
              selectedMetric={selectedMetric}
              onMetricSelect={handleMetricSelect}
              source="nebulanew-prom"
            />
          }
        />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/data-sources" element={<DataSourcesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </MainLayout>
  );
}

export default function App() {
  return <AppRoutes />;
}
