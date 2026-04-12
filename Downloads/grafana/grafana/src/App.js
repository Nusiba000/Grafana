import React, { useState, useEffect } from 'react';
import { BarChart3, Zap, Server, Clock, Database } from 'lucide-react';
import MetricsSelector from './components/MetricsSelector';
import MetricDataViewer from './components/MetricDataViewer';
import './App.css';

function App() {
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      
      // Get available metrics from Prometheus Query API
      const response = await fetch('/api/v1/label/__name__/values');
      const data = await response.json();
      
      if (data.status === 'success' && data.data) {
        const metricNames = data.data;
        const parsedMetrics = [];
        
        // Get metadata for each metric
        const metadataResponse = await fetch('/api/v1/metadata');
        const metadataData = await metadataResponse.json();
        
        metricNames.forEach(name => {
          const metadata = metadataData.data[name];
          if (metadata && metadata.length > 0) {
            parsedMetrics.push({
              name: name,
              description: metadata[0].help || 'No description available',
              type: metadata[0].type || 'unknown',
              help: metadata[0].help || 'No description available'
            });
          } else {
            parsedMetrics.push({
              name: name,
              description: 'No description available',
              type: 'unknown',
              help: 'No description available'
            });
          }
        });
        
        setMetrics(parsedMetrics);
      } else {
        setError('Failed to parse metrics data');
      }
      
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch metrics: ' + err.message);
      setLoading(false);
    }
  };

  const handleMetricSelect = (metric) => {
    setSelectedMetric(metric);
  };

  if (loading) {
    return (
      <div className="loading">
        <img src="/opsight-logo.svg" alt="OpSight Logo" className="loading-logo animate-spin" />
        <span className="ml-2">Loading OpSight metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error">
        <h2>Error</h2>
        <p>{error}</p>
        <button className="btn btn-primary mt-4" onClick={fetchMetrics}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <img src="/opsight-logo.svg" alt="OpSight Logo" className="header-logo" />
            <h1>OpSight - Operations Insight Dashboard</h1>
          </div>
          <div className="header-right">
            <div className="status-indicator">
              <div className="status-dot online"></div>
              <span>Connected to ODP Main</span>
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="dashboard">
                      <div className="dashboard-header">
      
            </div>

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
                <MetricDataViewer metric={selectedMetric} />
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
      </main>
    </div>
  );
}

export default App;
