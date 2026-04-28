import React, { useState, useEffect, useRef } from 'react';
import { Clock, Database, TrendingUp, Gauge, BarChart3, Hash, RefreshCw, Info, TrendingDown, Minus, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import './MetricDataViewer.css';

const MetricDataViewer = ({ metric, source }) => {
  const [metricData, setMetricData] = useState(null);
  const [yesterdayData, setYesterdayData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [warningThreshold, setWarningThreshold] = useState(15);
  const [criticalThreshold, setCriticalThreshold] = useState(25);
  const [alertSent, setAlertSent] = useState({});

  const storageScope = (name) => (source ? `${source}_${name}` : name);

  // Load saved thresholds and alert status from local storage when metric changes
  useEffect(() => {
    if (metric) {
      console.log("VIEWER SOURCE:", source);
      console.log("VIEWER METRIC:", metric);
      loadSavedThresholds(metric.name);
      loadSavedAlertStatus(metric.name);
      fetchMetricData();
    }
  }, [metric, source]);

  const sentAlertsRef = useRef({});
  const timeoutRef = useRef(null);

  // Reset alerts when metric/source changes
  useEffect(() => {
    sentAlertsRef.current = {};
  }, [metric, source]);

  // Trigger JIRA alerts for critical metrics AFTER data settles
  useEffect(() => {
    if (!metricData || !yesterdayData || loading) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {

      metricData.forEach((data) => {
        const yesterdayItem = yesterdayData.find(
          (y) => JSON.stringify(y.labels) === JSON.stringify(data.labels)
        );

        if (!yesterdayItem || yesterdayItem.value === 0) {
          return; // ignore this now (temporary)
        }

        const change = calculateChange(data.value, yesterdayItem.value);
        const status = getStatus(change);

        const metricKey = `${data.name}_${JSON.stringify(data.labels)}`;

        if (
          status === 'critical' &&
          !sentAlertsRef.current[metricKey] &&
          change !== null
        ) {
          sentAlertsRef.current[metricKey] = true;

          const alertData = {
            metric_name: data.name,
            current_value: data.value,
            yesterday_value: yesterdayItem?.value || 0,
            change_percentage: Math.abs(change),
            labels: data.labels,
            warning_threshold: warningThreshold,
            critical_threshold: criticalThreshold,
            source: source
          };

          sendJiraAlert(alertData, metricKey);
        }
      });

    }, 300);

  }, [metricData, yesterdayData, warningThreshold, criticalThreshold, source]);

  // Load saved thresholds for a specific metric
  const loadSavedThresholds = (metricName) => {
    try {
      const savedThresholds = localStorage.getItem(`thresholds_${storageScope(metricName)}`);
      if (savedThresholds) {
        const { warning, critical } = JSON.parse(savedThresholds);
        setWarningThreshold(warning);
        setCriticalThreshold(critical);
      }
    } catch (error) {
      console.error('Error loading saved thresholds:', error);
    }
  };

  // Save thresholds to local storage
  const saveThresholds = (metricName, warning, critical) => {
    try {
      localStorage.setItem(`thresholds_${storageScope(metricName)}`, JSON.stringify({
        warning: warning,
        critical: critical
      }));
    } catch (error) {
      console.error('Error saving thresholds:', error);
    }
  };

  // Load saved alert status for a specific metric
  const loadSavedAlertStatus = (metricName) => {
    try {
      const savedAlertStatus = localStorage.getItem(`alertStatus_${storageScope(metricName)}`);
      if (savedAlertStatus) {
        setAlertSent(JSON.parse(savedAlertStatus));
      }
    } catch (error) {
      console.error('Error loading saved alert status:', error);
    }
  };

  // Save alert status to local storage
  const saveAlertStatus = (metricKey) => {
    try {
      const newAlertSent = { ...alertSent, [metricKey]: true };
      setAlertSent(newAlertSent);
      
      // Save to localStorage for persistence
      if (metric) {
        localStorage.setItem(`alertStatus_${storageScope(metric.name)}`, JSON.stringify(newAlertSent));
      }
    } catch (error) {
      console.error('Error saving alert status:', error);
    }
  };

  const fetchMetricData = async () => {
    if (!metric) return;
    
    try {
      setLoading(true);
      setError(null);

      const metricName = typeof metric === 'object' ? metric?.name : metric;
      if (!metricName) {
        setError('Invalid metric selection');
        return;
      }

      console.log("FINAL QUERY:", `/api/v1/query?query=${metricName}&source=${source}`);

      const q = encodeURIComponent(metricName);
      let currentUrl = `/api/v1/query?query=${q}`;
      const yesterdayTimestamp = Math.floor(Date.now() / 1000) - 86400;
      let yesterdayUrl = `/api/v1/query?query=${q}&time=${yesterdayTimestamp}`;
      if (source) {
        const s = encodeURIComponent(source);
        currentUrl += `&source=${s}`;
        yesterdayUrl += `&source=${s}`;
      }

      // Get current value
      const currentResponse = await fetch(currentUrl);
      const currentData = await currentResponse.json();
      
      // Get yesterday's value (24 hours ago)
      const yesterdayResponse = await fetch(yesterdayUrl);
      const yesterdayData = await yesterdayResponse.json();
      
      if (currentData.status === 'success' && currentData.data && currentData.data.result) {
        const parsedCurrentData = currentData.data.result.map(result => {
          return {
            name: result.metric.__name__,
            labels: result.metric,
            value: parseFloat(result.value[1]),
            timestamp: new Date(result.value[0] * 1000)
          };
        });
        
        setMetricData(parsedCurrentData);
        setLastUpdated(new Date());
      }
      
      if (yesterdayData.status === 'success' && yesterdayData.data && yesterdayData.data.result) {
        const parsedYesterdayData = yesterdayData.data.result.map(result => {
          return {
            name: result.metric.__name__,
            labels: result.metric,
            value: parseFloat(result.value[1]),
            timestamp: new Date(result.value[0] * 1000)
          };
        });
        
        setYesterdayData(parsedYesterdayData);
      }
      
    } catch (error) {
      console.error('Error fetching metric data:', error);
      setError('Failed to fetch metric data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const parseLabels = (labels) => {
    // Remove __name__ from labels as it's the metric name
    const { __name__, ...otherLabels } = labels;
    return otherLabels;
  };

  const calculateChange = (currentValue, yesterdayValue) => {
    if (!yesterdayValue || yesterdayValue === 0) return null;
    return ((currentValue - yesterdayValue) / yesterdayValue) * 100;
  };

  const getStatus = (change) => {
    if (change === null) return 'normal';
    const absChange = Math.abs(change);
    if (absChange >= criticalThreshold) return 'critical';
    if (absChange >= warningThreshold) return 'warning';
    return 'normal';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'critical':
        return <AlertCircle size={16} className="status-icon critical" />;
      case 'warning':
        return <AlertTriangle size={16} className="status-icon warning" />;
      case 'normal':
        return <CheckCircle size={16} className="status-icon normal" />;
      default:
        return <Minus size={16} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'critical':
        return 'var(--error-color)';
      case 'warning':
        return 'var(--warning-color)';
      case 'normal':
        return 'var(--success-color)';
      default:
        return 'var(--text-secondary)';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'critical':
        return 'CRITICAL';
      case 'warning':
        return 'WARNING';
      case 'normal':
        return 'NORMAL';
      default:
        return 'N/A';
    }
  };

  const getTrendIcon = (change) => {
    if (change === null) return <Minus size={16} />;
    if (change > 0) return <TrendingUp size={16} className="trend-up" />;
    if (change < 0) return <TrendingDown size={16} className="trend-down" />;
    return <Minus size={16} />;
  };

  const getTrendColor = (change) => {
    if (change === null) return 'var(--text-secondary)';
    if (change > 0) return 'var(--success-color)';
    if (change < 0) return 'var(--error-color)';
    return 'var(--text-secondary)';
  };

  const formatValue = (value) => {
    if (typeof value === 'number') {
      if (value >= 1000000) return (value / 1000000).toFixed(2) + 'M';
      if (value >= 1000) return (value / 1000).toFixed(2) + 'K';
      return value.toFixed(2);
    }
    return value;
  };

  const sendJiraAlert = async (alertData, metricKey) => {
    try {
      console.log('Sending JIRA alert:', alertData);
      
      const response = await fetch('http://localhost:5000/api/alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alertData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('JIRA ticket created successfully:', result);
        // Mark this alert as sent to prevent duplicates and save to localStorage
        saveAlertStatus(metricKey);
      } else {
        console.error('Failed to create JIRA ticket:', result.error);
      }
    } catch (error) {
      console.error('Error sending JIRA alert:', error);
    }
  };

  if (!metric) {
    return (
      <div className="metric-data-viewer">
        <div className="no-metric-selected">
          <BarChart3 size={64} />
          <h3>Select a Metric</h3>
          <p>Choose a metric from the left panel to view its data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="metric-data-viewer">
      <div className="viewer-header">
        <div className="metric-info">
          <div className="metric-icon">
            <BarChart3 size={24} />
          </div>
          <div className="metric-details">
            <h2 className="metric-title">{metric.name}</h2>
            <div className="metric-meta">
              <span className="metric-type">{metric.type || 'Unknown'}</span>
              <span className="metric-description">{metric.description}</span>
            </div>
          </div>
        </div>
        
        <div className="viewer-actions">
          <button 
            className="btn btn-secondary"
            onClick={fetchMetricData}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Threshold Settings */}
      <div className="threshold-settings">
        <div className="threshold-inputs">
          <div className="threshold-input">
            <label htmlFor="warning-threshold">Warning Threshold (%)</label>
            <input
              id="warning-threshold"
              type="number"
              min="0"
              max="1000"
              value={warningThreshold}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                setWarningThreshold(value);
                if (metric) {
                  saveThresholds(metric.name, value, criticalThreshold);
                }
              }}
              className="threshold-field"
            />
          </div>
          <div className="threshold-input">
            <label htmlFor="critical-threshold">Critical Threshold (%)</label>
            <input
              id="critical-threshold"
              type="number"
              min="0"
              max="1000"
              value={criticalThreshold}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                setCriticalThreshold(value);
                if (metric) {
                  saveThresholds(metric.name, warningThreshold, value);
                }
              }}
              className="threshold-field"
            />
          </div>
        </div>
        <div className="threshold-info">
          <span>Thresholds apply to absolute change percentage • ✓ Thresholds are automatically saved for each metric</span>
        </div>
      </div>

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Fetching latest data...</p>
        </div>
      )}

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button className="btn btn-primary" onClick={fetchMetricData}>
            Retry
          </button>
        </div>
      )}

      {metricData && (
        <>
          <div className="summary-cards">
            <div className="summary-card">
              <div className="card-header">
                <Database size={20} />
                <span>Data Points</span>
              </div>
              <div className="card-value">{metricData.length}</div>
            </div>
            
            <div className="summary-card">
              <div className="card-header">
                <Clock size={20} />
                <span>Last Updated</span>
              </div>
              <div className="card-value">
                {lastUpdated ? lastUpdated.toLocaleTimeString() : 'N/A'}
              </div>
            </div>
          </div>

          <div className="data-section">
            <h3>Current Values vs Yesterday</h3>
            <div className="metrics-table">
              <div className="table-header">
                <div className="header-cell">Labels</div>
                <div className="header-cell">Current Value</div>
                <div className="header-cell">Yesterday's Value</div>
                <div className="header-cell">Change</div>
                <div className="header-cell">Trend</div>
                <div className="header-cell">Status</div>
              </div>
              
              {metricData.map((data, index) => {
                const yesterdayItem = yesterdayData?.find(y => 
                  JSON.stringify(y.labels) === JSON.stringify(data.labels)
                );
                const change = calculateChange(data.value, yesterdayItem?.value);
                const status = getStatus(change);

                return (
                  <div key={index} className="table-row">
                    <div className="table-cell labels-cell">
                      {Object.entries(parseLabels(data.labels)).map(([key, value]) => (
                        <div key={key} className="label-item">
                          <span className="label-key">{key}:</span>
                          <span className="label-value">{value}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="table-cell current-value">
                      {formatValue(data.value)}
                    </div>
                    
                    <div className="table-cell yesterday-value">
                      {yesterdayItem ? formatValue(yesterdayItem.value) : 'N/A'}
                    </div>
                    
                    <div className="table-cell change-cell">
                      {change !== null ? (
                        <span 
                          className="change-value"
                          style={{ color: getTrendColor(change) }}
                        >
                          {change > 0 ? '+' : ''}{change.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="no-change">N/A</span>
                      )}
                    </div>
                    
                    <div className="table-cell trend-cell">
                      <span style={{ color: getTrendColor(change) }}>
                        {getTrendIcon(change)}
                      </span>
                    </div>

                    <div className="table-cell status-cell">
                      <div className="status-indicator" style={{ color: getStatusColor(status) }}>
                        {getStatusIcon(status)}
                        <span className="status-text">{getStatusText(status)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MetricDataViewer;
