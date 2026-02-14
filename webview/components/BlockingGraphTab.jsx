import React from 'react';
const { getStatusIcon } = require('../field-utils');

const BlockingGraphTab = ({
  parallelGroups,
  criticalPathIds,
  readyIds,
  selectedNode,
  onNodeClick,
  onEdgeClick,
  onTogglePhase,
  renderEdgeMenu,
  getPhasePreview
}) => (
  <div className="blocking-view__graph">
    <div className="blocking-view__graph-legend">
      <span className="blocking-view__legend-item">
        <span className="blocking-view__legend-swatch blocking-view__legend-swatch--critical" /> Critical Path
      </span>
      <span className="blocking-view__legend-item">
        <span className="blocking-view__legend-swatch blocking-view__legend-swatch--ready" /> Ready
      </span>
      <span className="blocking-view__legend-item">
        <span className="blocking-view__legend-swatch blocking-view__legend-swatch--blocked" /> Blocked
      </span>
    </div>
    <div className="blocking-view__graph-container">
      {parallelGroups.map((group, depth) => {
        const {
          isExpanded,
          shouldToggle,
          hiddenCount,
          visibleItems
        } = getPhasePreview(group, depth);
        return (
          <div key={depth} className="blocking-view__graph-layer">
            <div className="blocking-view__layer-label">Phase {depth + 1}</div>
            <div className="blocking-view__layer-items">
              {visibleItems.map(issue => {
                const isCritical = criticalPathIds.has(issue.id);
                const isReady = readyIds.has(issue.id);
                const isSelected = selectedNode === issue.id;
                const nodeClass = [
                  'blocking-view__node',
                  isCritical ? 'blocking-view__node--critical' : '',
                  isReady ? 'blocking-view__node--ready' : '',
                  isSelected ? 'blocking-view__node--selected' : '',
                  `blocking-view__node--${issue.status || 'open'}`
                ].filter(Boolean).join(' ');
                return (
                  <div key={issue.id} className={nodeClass} onClick={() => onNodeClick(issue)} title={`${issue.id}: ${issue.title}`}>
                    <div className="blocking-view__node-header">
                      <span className="blocking-view__node-status">{getStatusIcon(issue.status)}</span>
                      <span className="blocking-view__node-id">{issue.id}</span>
                      <span className="blocking-view__node-priority">P{issue.priority}</span>
                    </div>
                    <div className="blocking-view__node-title">{issue.title}</div>
                    {isCritical && <div className="blocking-view__node-badge">Critical</div>}
                    {isReady && <div className="blocking-view__node-badge blocking-view__node-badge--ready">Ready</div>}
                  </div>
                );
              })}
            </div>
            {shouldToggle && (
              <button
                type="button"
                className="blocking-view__phase-toggle"
                onClick={() => onTogglePhase(depth)}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} phase ${depth + 1}`}
              >
                {isExpanded ? 'Show fewer' : `Show ${hiddenCount} more`}
              </button>
            )}
            {depth < parallelGroups.length - 1 && (
              <div className="blocking-view__arrow-down blocking-view__arrow-down--interactive"
                onClick={(e) => {
                  const fromIds = group.map(i => i.id);
                  const nextGroup = parallelGroups[depth + 1];
                  if (fromIds.length === 1 && nextGroup && nextGroup.length === 1) {
                    onEdgeClick(fromIds[0], nextGroup[0].id, e);
                  }
                }}
                title="Click to edit dependency"
              >
                ↓
                {group.length === 1 && parallelGroups[depth + 1]?.length === 1 &&
                  renderEdgeMenu(group[0].id, parallelGroups[depth + 1][0].id)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

export default BlockingGraphTab;
