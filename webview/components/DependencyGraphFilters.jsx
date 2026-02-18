import React from 'react';

/**
 * DependencyGraphFilters - Filter controls for the dependency graph
 * 
 * Provides toggles for show/hide functionality of different item types
 * and display modes like focus mode.
 */
const DependencyGraphFilters = ({ filters, onFiltersChange }) => {
  const handleFilterChange = (filterName, value) => {
    onFiltersChange(prev => ({ ...prev, [filterName]: value }));
  };

  return (
    <div className="dependency-graph__filters">
      <label className="dependency-graph__filter-toggle">
        <input 
          type="checkbox" 
          checked={filters.showCompleted} 
          onChange={(e) => handleFilterChange('showCompleted', e.target.checked)}
        />
        <span>Show Completed</span>
      </label>
      <label className="dependency-graph__filter-toggle">
        <input 
          type="checkbox" 
          checked={filters.showBlocked} 
          onChange={(e) => handleFilterChange('showBlocked', e.target.checked)}
        />
        <span>Show Blocked</span>
      </label>
      <label className="dependency-graph__filter-toggle">
        <input 
          type="checkbox" 
          checked={filters.showHighPriorityOnly} 
          onChange={(e) => handleFilterChange('showHighPriorityOnly', e.target.checked)}
        />
        <span>High Priority Only</span>
      </label>
      <label className="dependency-graph__filter-toggle">
        <input 
          type="checkbox" 
          checked={filters.focusMode} 
          onChange={(e) => handleFilterChange('focusMode', e.target.checked)}
        />
        <span>Focus Mode</span>
      </label>
    </div>
  );
};

export default DependencyGraphFilters;