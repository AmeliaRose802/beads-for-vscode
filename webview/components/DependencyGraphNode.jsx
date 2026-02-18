import React from 'react';
import CopyableIssueId from './CopyableIssueId';
const { getStatusIcon } = require('../field-utils');

/**
 * DependencyGraphNode - Individual node component for the dependency graph
 * 
 * Renders a single issue as a node with status, priority, type styling,
 * and interaction handlers.
 */
const DependencyGraphNode = ({ 
  issue, 
  position, 
  isSelected, 
  isHovered, 
  isCompleted,
  isEpicChild,
  blockedByCount,
  blocksCount,
  onClick,
  onMouseEnter,
  onMouseLeave 
}) => {
  const getPriorityClass = (priority) => {
    if (priority === 0) return 'priority-p0';
    if (priority === 1) return 'priority-p1';
    return 'priority-default';
  };

  const getTypeClass = (type) => {
    switch (type) {
      case 'epic': return 'type-epic';
      case 'feature': return 'type-feature';
      case 'bug': return 'type-bug';
      default: return 'type-task';
    }
  };

  return (
    <div
      className={`dependency-graph__node ${getPriorityClass(issue.priority)} ${getTypeClass(issue.issue_type)} ${isEpicChild ? 'dependency-graph__node--epic-child' : ''} ${isSelected ? 'dependency-graph__node--selected' : ''} ${isHovered ? 'dependency-graph__node--hovered' : ''} ${isCompleted ? 'dependency-graph__node--completed' : ''}`}
      style={{ left: position.x, top: position.y }}
      onClick={() => onClick(issue)}
      onMouseEnter={() => onMouseEnter(issue.id)}
      onMouseLeave={() => onMouseLeave(null)}
    >
      <div className="dependency-graph__node-header">
        <span className={`dependency-graph__node-status dependency-graph__node-status--${issue.status}`}>
          {getStatusIcon(issue.status)}
        </span>
        <CopyableIssueId id={issue.id} className="dependency-graph__node-id" />
        <span className={`dependency-graph__node-priority dependency-graph__node-priority--p${issue.priority}`}>
          P{issue.priority}
        </span>
      </div>
      <div className="dependency-graph__node-title" title={issue.title}>
        {issue.title}
      </div>
      <div className="dependency-graph__node-type">
        {issue.issue_type}
      </div>
      {/* Blocking count badges */}
      <div className="dependency-graph__node-counts">
        {blockedByCount > 0 && (
          <span className="dependency-graph__count-badge dependency-graph__count-badge--blocked-by" title={`Blocked by ${blockedByCount} item${blockedByCount !== 1 ? 's' : ''}`}>
            ↑ {blockedByCount}
          </span>
        )}
        {blocksCount > 0 && (
          <span className="dependency-graph__count-badge dependency-graph__count-badge--blocks" title={`Blocks ${blocksCount} item${blocksCount !== 1 ? 's' : ''}`}>
            ↓ {blocksCount}
          </span>
        )}
      </div>
    </div>
  );
};

export default DependencyGraphNode;