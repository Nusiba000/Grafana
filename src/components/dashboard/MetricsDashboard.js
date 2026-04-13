import React from 'react';
import { BarChart3, Database } from 'lucide-react';
import MetricsSelector from '../MetricsSelector';
import MetricDataViewer from '../MetricDataViewer';

/**
 * Grafana-style metrics workspace: same selector + viewer as Metrics Explorer,
 * with an optional Prometheus `source` forwarded to the viewer queries.
 */
export default function MetricsDashboard({
  metrics,
  selectedMetric,
  onMetricSelect,
  source,
}) {
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
            onMetricSelect={onMetricSelect}
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
