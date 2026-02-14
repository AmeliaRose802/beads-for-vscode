import React from 'react';
const { getStatusIcon } = require('../field-utils');

/**
 * CriticalPathView - Displays one or more critical paths with actionable insights.
 */
const CriticalPathView = ({ criticalPaths, fanOutCounts, onNodeClick, onEdgeClick, renderEdgeMenu, isClosedStatus }) => {
  const totalPaths = criticalPaths.length;

  return (
    <div className="blocking-view__critical">
      <div className="blocking-view__critical-header">
        <span className="blocking-view__critical-label">
          {totalPaths === 1 
            ? `Critical path (${criticalPaths[0].length} items, longest dependency chain):`
            : `Top ${totalPaths} critical paths (longest dependency chains):`
          }
        </span>
        <div className="blocking-view__critical-subtitle">
          Flow: blockers start at the top, most-blocked work lands at the bottom.
          {totalPaths > 1 && ' Multiple chains show all major bottlenecks.'}
        </div>
      </div>
      
      {criticalPaths.map((path, pathIndex) => {
        const actionableCritical = path.find(issue => !isClosedStatus(issue));
        const actionableIndex = actionableCritical ? path.indexOf(actionableCritical) : -1;
        const actionableRemainingCount = actionableIndex >= 0 ? path.slice(actionableIndex + 1).filter(issue => !isClosedStatus(issue)).length : 0;
        const actionableMessage = actionableCritical ? (actionableRemainingCount > 0 ? `Unblock ${actionableRemainingCount} item${actionableRemainingCount !== 1 ? 's' : ''} by completing ${actionableCritical.id} first.` : `Complete ${actionableCritical.id} to finish this path.`) : null;

        return (
          <div key={pathIndex} className="blocking-view__critical-path-container">
            {totalPaths > 1 && (
              <div className="blocking-view__critical-path-header">
                <span className="blocking-view__critical-path-number">Path {pathIndex + 1}</span>
                <span className="blocking-view__critical-path-length">({path.length} items)</span>
              </div>
            )}
            {actionableMessage && (
              <div className="blocking-view__critical-callout">
                <div className="blocking-view__critical-callout-text">{actionableMessage}</div>
                <div className="blocking-view__critical-callout-title">{actionableCritical.title}</div>
              </div>
            )}
            <div className="blocking-view__critical-chain">
              {path.map((issue, idx) => {
                const fanOutCount = fanOutCounts?.[issue.id] || 0;
                const fanOutLabel = fanOutCount > 0 ? `Unblocks ${fanOutCount} item${fanOutCount !== 1 ? 's' : ''}` : 'No downstream items';
                return (
                  <div key={issue.id} className="blocking-view__critical-item">
                    <div
                      className={`blocking-view__critical-node${actionableCritical && issue.id === actionableCritical.id ? ' blocking-view__critical-node--actionable' : ''}`}
                      onClick={() => onNodeClick(issue)}
                    >
                      <span className="blocking-view__critical-status">{getStatusIcon(issue.status)}</span>
                      <span className="blocking-view__critical-id">{issue.id}</span>
                      <span className="blocking-view__critical-title">{issue.title}</span>
                      <span className="blocking-view__critical-priority">P{issue.priority}</span>
                      {fanOutCount > 0 && (
                        <span className="blocking-view__critical-fanout" title={fanOutLabel}>🔓 {fanOutCount}</span>
                      )}
                    </div>
                    {idx < path.length - 1 && (
                      <div
                        className="blocking-view__critical-arrow blocking-view__critical-arrow--interactive"
                        onClick={(e) => onEdgeClick(issue.id, path[idx + 1].id, e)}
                        title={`Edit: ${issue.id} blocks ${path[idx + 1].id}`}
                      >
                        ↓ blocks
                        {renderEdgeMenu(issue.id, path[idx + 1].id)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CriticalPathView;
