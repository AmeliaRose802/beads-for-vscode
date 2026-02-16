import React from 'react';
const { getStatusIcon } = require('../field-utils');

/**
 * Build a unified tree structure from multiple critical paths that share common nodes.
 * @param {Array<Array<Object>>} criticalPaths - Array of paths (each path is an array of issues)
 * @returns {Array<Object>} Tree structure where each node has { issue, children }
 */
function buildCriticalPathTree(criticalPaths) {
  if (!criticalPaths || criticalPaths.length === 0) return [];
  if (criticalPaths.length === 1) {
    // Single path - convert to linear tree
    return criticalPaths[0].map((issue, idx) => ({
      issue,
      children: idx < criticalPaths[0].length - 1 ? [{ issue: criticalPaths[0][idx + 1], children: [] }] : []
    })).slice(0, 1); // Return only root
  }

  // Build adjacency list from all paths
  const adjacency = new Map(); // Maps issue.id -> Set of child issue.ids
  const issueById = new Map();
  const allIds = new Set();

  criticalPaths.forEach(path => {
    path.forEach((issue, idx) => {
      issueById.set(issue.id, issue);
      allIds.add(issue.id);
      
      if (!adjacency.has(issue.id)) {
        adjacency.set(issue.id, new Set());
      }
      
      if (idx < path.length - 1) {
        const nextIssue = path[idx + 1];
        adjacency.get(issue.id).add(nextIssue.id);
      }
    });
  });

  // Find root nodes (nodes with no incoming edges in the critical paths)
  const hasIncomingEdge = new Set();
  adjacency.forEach(children => {
    children.forEach(childId => hasIncomingEdge.add(childId));
  });
  const rootIds = Array.from(allIds).filter(id => !hasIncomingEdge.has(id));

  // Build tree recursively
  function buildTree(nodeId, visited = new Set()) {
    if (visited.has(nodeId)) {
      // Cycle detection - return reference node
      return { issue: issueById.get(nodeId), children: [], isCycleRef: true };
    }

    const newVisited = new Set(visited);
    newVisited.add(nodeId);

    const children = [];
    const childIds = adjacency.get(nodeId);
    if (childIds && childIds.size > 0) {
      childIds.forEach(childId => {
        children.push(buildTree(childId, newVisited));
      });
    }

    return {
      issue: issueById.get(nodeId),
      children
    };
  }

  return rootIds.map(rootId => buildTree(rootId));
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
            : `Top ${totalPaths} critical paths as unified tree (shared dependencies shown once):`
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
          <span className="blocking-view__critical-id">{issue.id}</span>
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
