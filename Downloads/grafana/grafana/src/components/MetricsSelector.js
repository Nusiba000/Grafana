import React, { useState, useMemo } from 'react';
import { Search, BarChart3, ChevronDown } from 'lucide-react';
import './MetricsSelector.css';

const MetricsSelector = ({ metrics, onMetricSelect, selectedMetric }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  // Define metric categories and their patterns
  const metricCategories = {
    'All Categories': () => true,
    'Host Metrics': (metric) => metric.name.startsWith('node_'),
    'PVE Metrics': (metric) => metric.name.startsWith('pve_'),
    'Windows Metrics': (metric) => metric.name.startsWith('windows_'),
    'System Metrics': (metric) => 
      metric.name.startsWith('process_') || 
      metric.name.startsWith('go_') ||
      metric.name.includes('system'),
    'Disk Metrics': (metric) => 
      metric.name.includes('disk') || 
      metric.name.includes('filesystem') ||
      metric.name.includes('storage'),
    'Network Metrics': (metric) => 
      metric.name.includes('network') || 
      metric.name.includes('http') ||
      metric.name.includes('tcp'),
    'Memory Metrics': (metric) => 
      metric.name.includes('memory') || 
      metric.name.includes('mem'),
    'CPU Metrics': (metric) => 
      metric.name.includes('cpu') || 
      metric.name.includes('processor'),
    'AWS Metrics': (metric) => 
      metric.name.startsWith('aws_') || 
      metric.name.includes('cloudwatch'),
    'Go Metrics': (metric) => 
      metric.name.startsWith('go_') || 
      metric.name.startsWith('prometheus_'),
    'Other Metrics': (metric) => 
      !metric.name.startsWith('node_') && 
      !metric.name.startsWith('pve_') && 
      !metric.name.startsWith('windows_') && 
      !metric.name.startsWith('process_') && 
      !metric.name.startsWith('go_') && 
      !metric.name.startsWith('aws_') &&
      !metric.name.includes('disk') &&
      !metric.name.includes('filesystem') &&
      !metric.name.includes('network') &&
      !metric.name.includes('memory') &&
      !metric.name.includes('cpu')
  };

  const filteredMetrics = useMemo(() => {
    let filtered = metrics;
    
    // Filter by category
    if (selectedCategory !== 'All Categories') {
      filtered = filtered.filter(metricCategories[selectedCategory]);
    }
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(metric => 
        metric.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        metric.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  }, [metrics, selectedCategory, searchTerm]);

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setIsCategoryOpen(false);
  };

  return (
    <div className="metrics-selector">
      <div className="search-section">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            className="search-input"
            placeholder="Search metrics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {/* Category Dropdown */}
        <div className="category-dropdown">
          <button 
            className="category-selector"
            onClick={() => setIsCategoryOpen(!isCategoryOpen)}
          >
            <span>{selectedCategory}</span>
            <ChevronDown size={16} className={isCategoryOpen ? 'rotate' : ''} />
          </button>
          
          {isCategoryOpen && (
            <div className="category-options">
              {Object.keys(metricCategories).map(category => (
                <div
                  key={category}
                  className={`category-option ${selectedCategory === category ? 'selected' : ''}`}
                  onClick={() => handleCategorySelect(category)}
                >
                  {category}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="metrics-list">
        <div className="list-header">
          <span>Showing {filteredMetrics.length} of {metrics.length} metrics</span>
          {selectedCategory !== 'All Categories' && (
            <span className="category-badge">{selectedCategory}</span>
          )}
        </div>
        
        {filteredMetrics.map((metric) => (
          <div
            key={metric.name}
            className={`metric-item ${selectedMetric?.name === metric.name ? 'selected' : ''}`}
            onClick={() => onMetricSelect(metric)}
          >
            <div className="metric-header">
              <div className="metric-name">{metric.name}</div>
            </div>
            <div className="metric-description">{metric.description}</div>
          </div>
        ))}
        
        {filteredMetrics.length === 0 && (
          <div className="no-results">
            <BarChart3 size={48} />
            <h3>No metrics found</h3>
            <p>Try adjusting your search or category filters</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricsSelector;
