import React from 'react';
import CopyableIssueId from './CopyableIssueId';
const { getStatusIcon } = require('../field-utils');

/**
 * Build a unified tree structure from multiple critical paths that share common nodes.
 * @param {Array<Array<Object>>} criticalPaths - Array of paths (each path is an array of issues)
 * @returns {Array<Object>} Tree structure where each node has { issue, children }
 */
function buildCriticalPathTree(criticalPaths) {
  if (!criticalPaths || criticalPaths.length === 0) return [];

  const adjacency = new Map(); // Maps issue.id -> Set of child issue.ids
  const issueById = new Map();
  const hasIncomingEdge = new Set();

  criticalPaths.forEach(path => {
    path.forEach((issue, idx) => {
      issueById.set(issue.id, issue);
      if (!adjacency.has(issue.id)) {
        adjacency.set(issue.id, new Set());
      }

      if (idx < path.length - 1) {
        const nextIssue = path[idx + 1];
        adjacency.get(issue.id).add(nextIssue.id);
        hasIncomingEdge.add(nextIssue.id);
      }
    });
  });

  const allIds = Array.from(issueById.keys());
  const rootIds = allIds.filter(id => !hasIncomingEdge.has(id));
  const roots = rootIds.length > 0 ? rootIds : (allIds.length ? [allIds[0]] : []);

  function buildTree(nodeId, visited = new Set()) {
    if (visited.has(nodeId)) {
      return { issue: issueById.get(nodeId), children: [], isCycleRef: true };
    }

    const newVisited = new Set(visited);
    newVisited.add(nodeId);

    const childIds = adjacency.get(nodeId) || new Set();
    const children = Array.from(childIds).map(childId => buildTree(childId, newVisited));

    return {
      issue: issueById.get(nodeId),
      children
    };
  }

  return roots.map(rootId => buildTree(rootId));
}

/**
 * CriticalPathView - Displays one or more critical paths as a unified tree with branches.
 */
const CriticalPathView = ({ criticalPaths, fanOutCounts, onNodeClick, onEdgeClick, renderEdgeMenu, isClosedStatus }) => {
  const totalPaths = criticalPaths.length;
  const treeRoots = buildCriticalPathTree(criticalPaths);

  return (
    <div className="blocking-view__critical">
      <div className="blocking-view__critical-header">
        <span className="blocking-view__critical-label">
          {totalPaths === 1 
            ? `Critical path (${criticalPaths[0].length} items, longest dependency chain):`
            : `Unified critical dependency tree (merged from ${totalPaths} critical paths; shared dependencies shown once):`
          }
        </span>
        <div className="blocking-view__critical-subtitle">
          Flow: blockers start at the top, most-blocked work lands at the bottom.
          {totalPaths > 1 && ' Paths branch where dependencies diverge.'}
        </div>
      </div>
      
      <div className="blocking-view__critical-tree">
        {treeRoots.map((root, rootIdx) => (
          <CriticalTreeNode
            key={root.issue.id}
            node={root}
            fanOutCounts={fanOutCounts}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            renderEdgeMenu={renderEdgeMenu}
            isClosedStatus={isClosedStatus}
            depth={0}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Recursive component to render a tree node and its children.
 */
const CriticalTreeNode = ({ node, fanOutCounts, onNodeClick, onEdgeClick, renderEdgeMenu, isClosedStatus, depth }) => {
  const { issue, children, isCycleRef } = node;
  const fanOutCount = fanOutCounts?.[issue.id] || 0;
  const fanOutLabel = fanOutCount > 0 ? `Unblocks ${fanOutCount} item${fanOutCount !== 1 ? 's' : ''}` : 'No downstream items';
  const hasBranches = children && children.length > 1;

  // Find actionable issue in this subtree
  const findActionableIssue = (n) => {
    if (!isClosedStatus(n.issue)) return n.issue;
    for (const child of n.children || []) {
      const actionable = findActionableIssue(child);
      if (actionable) return actionable;
    }
    return null;
  };
  const actionableIssue = findActionableIssue(node);
  const isActionable = actionableIssue && actionableIssue.id === issue.id;

  return (
    <div className={`blocking-view__critical-tree-node ${depth > 0 ? 'blocking-view__critical-tree-node--nested' : ''}`}>
      <div className="blocking-view__critical-item">
        <div
          className={`blocking-view__critical-node${isActionable ? ' blocking-view__critical-node--actionable' : ''}${isCycleRef ? ' blocking-view__critical-node--cycle' : ''}`}
          onClick={() => onNodeClick(issue)}
        >
          <span className="blocking-view__critical-status">{getStatusIcon(issue.status)}</span>
          <CopyableIssueId id={issue.id} className="blocking-view__critical-id" />
          <span className="blocking-view__critical-title">{issue.title}</span>
          <span className="blocking-view__critical-priority">P{issue.priority}</span>
          {fanOutCount > 0 && (
            <span className="blocking-view__critical-fanout" title={fanOutLabel}>🔓 {fanOutCount}</span>
          )}
          {isCycleRef && (
            <span className="blocking-view__critical-cycle-badge" title="Cycle detected">🔄</span>
          )}
        </div>

        {children && children.length > 0 && !isCycleRef && (
          <>
            {hasBranches && (
              <div className="blocking-view__critical-branch-indicator">
                ⤷ {children.length} branches
              </div>
            )}
            <div className={`blocking-view__critical-children ${hasBranches ? 'blocking-view__critical-children--branched' : ''}`}>
              {children.map((child, idx) => (
                <div key={child.issue.id} className="blocking-view__critical-child-branch">
                  <div
                    className="blocking-view__critical-arrow blocking-view__critical-arrow--interactive"
                    onClick={(e) => onEdgeClick(issue.id, child.issue.id, e)}
                    title={`Edit: ${issue.id} blocks ${child.issue.id}`}
                  >
                    ↓ blocks
                    {renderEdgeMenu(issue.id, child.issue.id)}
                  </div>
                  <CriticalTreeNode
                    node={child}
                    fanOutCounts={fanOutCounts}
                    onNodeClick={onNodeClick}
                    onEdgeClick={onEdgeClick}
                    renderEdgeMenu={renderEdgeMenu}
                    isClosedStatus={isClosedStatus}
                    depth={depth + 1}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CriticalPathView;
