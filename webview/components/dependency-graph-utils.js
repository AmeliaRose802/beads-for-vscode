/**
 * Graph filtering utilities for the dependency graph component
 */

/**
 * Determines if a node should be visible based on current filters
 */
export const shouldShowNode = (issue, filters, selectedNode, allDeps) => {
  const isCompleted = issue.status === 'closed' || issue.status === 'done';
  const isBlocked = issue.status === 'blocked';
  const isHighPriority = issue.priority <= 1;
  
  if (!filters.showCompleted && isCompleted) return false;
  if (!filters.showBlocked && isBlocked) return false;
  if (filters.showHighPriorityOnly && !isHighPriority) return false;
  
  if (filters.focusMode && selectedNode) {
    // In focus mode, show selected node and its immediate neighbors
    const isSelected = issue.id === selectedNode;
    const isConnected = allDeps.some(dep => {
      const fromId = dep.depends_on_id || dep.from_id || dep.FromID;
      const toId = dep.issue_id || dep.to_id || dep.ToID;
      return (fromId === selectedNode && toId === issue.id) || 
             (toId === selectedNode && fromId === issue.id);
    });
    if (!isSelected && !isConnected) return false;
  }
  
  return true;
};

/**
 * Determines if an edge should be visible based on current filters
 */
export const shouldShowEdge = (dep, issueMap, nodeFilter) => {
  const fromId = dep.depends_on_id || dep.from_id || dep.FromID;
  const toId = dep.issue_id || dep.to_id || dep.ToID;
  const fromIssue = issueMap[fromId];
  const toIssue = issueMap[toId];
  
  if (!fromIssue || !toIssue) return false;
  if (!nodeFilter(fromIssue) || !nodeFilter(toIssue)) return false;
  
  return true;
};

/**
 * Calculates blocking counts for issues
 */
export const calculateBlockingCounts = (issues, dependencies) => {
  const blocksCount = {}; // How many items each node blocks (outgoing)
  const blockedByCount = {}; // How many items each node is blocked by (incoming)
  
  // Initialize counts
  issues.forEach(issue => {
    blocksCount[issue.id] = 0;
    blockedByCount[issue.id] = 0;
  });
  
  // Count relationships from dependencies
  dependencies.forEach(dep => {
    const fromId = dep.depends_on_id || dep.from_id || dep.FromID;
    const toId = dep.issue_id || dep.to_id || dep.ToID;
    
    if (fromId && toId) {
      if (blocksCount[fromId] !== undefined) {
        blocksCount[fromId]++;
      }
      if (blockedByCount[toId] !== undefined) {
        blockedByCount[toId]++;
      }
    }
  });
  
  return { blocksCount, blockedByCount };
};