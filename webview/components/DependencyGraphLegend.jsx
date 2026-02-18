import React from 'react';

const DependencyGraphLegend = () => (
  <div className="dependency-graph__legend">
    <span className="dependency-graph__legend-item">
      <span className="dependency-graph__legend-icon dependency-graph__legend-icon--open">○</span> Open
    </span>
    <span className="dependency-graph__legend-item">
      <span className="dependency-graph__legend-icon dependency-graph__legend-icon--in-progress">◐</span> In Progress
    </span>
    <span className="dependency-graph__legend-item">
      <span className="dependency-graph__legend-icon dependency-graph__legend-icon--blocked">●</span> Blocked
    </span>
    <span className="dependency-graph__legend-item">
      <span className="dependency-graph__legend-icon dependency-graph__legend-icon--closed">✓</span> Closed
    </span>
    <span className="dependency-graph__legend-separator">|</span>
    <span className="dependency-graph__legend-item">
      <span className="dependency-graph__legend-line dependency-graph__legend-line--blocked-by" /> blocked-by
    </span>
    <span className="dependency-graph__legend-item">
      <span className="dependency-graph__legend-line dependency-graph__legend-line--blocks" /> blocks
    </span>
    <span className="dependency-graph__legend-item">
      <span className="dependency-graph__legend-line dependency-graph__legend-line--parent-child" /> parent
    </span>
  </div>
);

export default DependencyGraphLegend;
