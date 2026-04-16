import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BarChart3, Database } from 'lucide-react';
import MetricsSelector from '../MetricsSelector';
import MetricDataViewer from '../MetricDataViewer';

function getDefaultMetric(metrics, source) {
  if (!metrics || metrics.length === 0) return null;
  switch (source) {
    case 'proxmox-prom':
      return (
        metrics.find(m => m.name.toLowerCase().includes('pve')) ||
        metrics.find(m => m.name.toLowerCase().includes('cpu')) ||
        metrics[0]
      );
    case 'nebulanew-prom':
      return (
        metrics.find(m => m.name.toLowerCase().includes('kube')) ||
        metrics.find(m => m.name.toLowerCase().includes('pod')) ||
        metrics[0]
      );
    case 'vcenter-prom':
      return (
        metrics.find(m => m.name.toLowerCase().includes('vm')) ||
        metrics.find(m => m.name.toLowerCase().includes('cpu')) ||
        metrics[0]
      );
    default:
      return metrics[0];
  }
}

/**
 * Each dashboard instance fetches metrics from its own Prometheus source.
 * This ensures full isolation: proxmox, vcenter, and nebula dashboards
 * never share state or interfere with each other.
 */
export default function MetricsDashboard({ source }) {
  const [metrics, setMetrics] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const refreshControllerRef = useRef(null);

  const fetchMetrics = useCallback(async (signal, silent = false) => {
    if (!source) return;
    try {
      setError(null);
      if (!silent) setLoading(true);

      const srcParam = `?source=${encodeURIComponent(source)}`;
      const [labelsRes, metadataRes] = await Promise.all([
        fetch(`/api/v1/label/__name__/values${srcParam}`, { signal }),
        fetch(`/api/v1/metadata${srcParam}`, { signal }),
      ]);
      const [labelsData, metadataData] = await Promise.all([
        labelsRes.json(),
        metadataRes.json(),
      ]);

      if (labelsData.status === 'success' && Array.isArray(labelsData.data)) {
        const parsedMetrics = labelsData.data.map((name) => {
          const entry = metadataData.data?.[name]?.[0];
          return {
            name,
            description: entry?.help || 'No description available',
            type: entry?.type || 'unknown',
            help: entry?.help || 'No description available',
          };
        });
        setMetrics(parsedMetrics);
        setSelectedMetric(getDefaultMetric(parsedMetrics, source));
        setError(null);
      } else {
        setError('Failed to load metrics from source: ' + source);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError('Failed to fetch metrics: ' + err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [source]);

  useEffect(() => {
    setMetrics([]);
    setSelectedMetric(null);
    setError(null);
    const controller = new AbortController();
    fetchMetrics(controller.signal);
    return () => controller.abort();
  }, [fetchMetrics]);

  const refresh = useCallback(() => {
    if (refreshControllerRef.current) refreshControllerRef.current.abort();
    refreshControllerRef.current = new AbortController();
    fetchMetrics(refreshControllerRef.current.signal, true);
  }, [fetchMetrics]);

  const handleMetricSelect = useCallback((metric) => {
    setSelectedMetric(metric);
  }, []);

  if (loading && metrics.length === 0) {
    return (
      <div className="loading">
        <img src="/opsight-logo.svg" alt="OpSight Logo" className="loading-logo animate-spin" />
        <span className="ml-2">Loading metrics...</span>
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
          onClick={() => { const ctrl = new AbortController(); fetchMetrics(ctrl.signal); }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header" />

      <div className="dashboard-grid">
        <div className="metrics-panel">
          <div className="panel-header">
            <BarChart3 size={20} />
            <span className="metric-count">{metrics.length} metrics</span>
          </div>
          <MetricsSelector
            metrics={metrics}
            onMetricSelect={handleMetricSelect}
            selectedMetric={selectedMetric}
          />
        </div>

        <div className="data-panel">
          {selectedMetric ? (
            <MetricDataViewer metric={selectedMetric} source={source} />
          ) : (
            <div className="no-selection">
              <Database size={48} />
              <h3>Select a Metric</h3>
              <p>Choose a metric from the left panel to view its real-time data</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
