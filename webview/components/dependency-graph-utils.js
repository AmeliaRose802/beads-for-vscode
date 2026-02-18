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
 * Normalizes a raw relationship type string to a canonical form.
 */
const normalizeRelType = (rawType) => {
  const value = String(rawType || 'related').toLowerCase();
  if (value === 'parent') return 'parent-child';
  if (value === 'relates-to') return 'related';
  return value;
};

/**
 * Resolves the dependency type from a dependency object using known field keys.
 */
const resolveDepType = (dep) => {
  const typeKeys = ['type', 'dependency_type', 'relationship', 'relation_type'];
  for (const key of typeKeys) {
    if (dep[key] !== undefined && dep[key] !== null) return dep[key];
  }
  return undefined;
};

/**
 * Resolves from/to IDs from a dependency object.
 */
const resolveDepIds = (dep) => {
  const fromId = dep.depends_on_id || dep.from_id || dep.FromID;
  const toId = dep.issue_id || dep.to_id || dep.ToID;
  return { fromId, toId };
};

/**
 * Filters graphData to show only epic-level view.
 * Keeps epics and inter-epic dependencies; excludes child tasks.
 */
export const filterGraphDataEpicLevel = (graphData) => {
  if (!Array.isArray(graphData)) return [];

  return graphData.map(component => {
    const issues = component.Issues || [];
    const deps = component.Dependencies || [];

    const epicIssues = issues.filter(i => i.issue_type === 'epic');
    const epicIds = new Set(epicIssues.map(i => i.id));

    // Build parent lookup to find which epic each issue belongs to
    const parentLookup = {};
    deps.forEach(dep => {
      const rawType = resolveDepType(dep);
      if (normalizeRelType(rawType) !== 'parent-child') return;
      const { fromId: parentId, toId: childId } = resolveDepIds(dep);
      if (childId && parentId) parentLookup[childId] = parentId;
    });

    const rootEpicFor = (id) => {
      const visited = new Set();
      let cur = id;
      while (cur && !visited.has(cur)) {
        visited.add(cur);
        const issue = issues.find(i => i.id === cur);
        if (issue && issue.issue_type === 'epic') return cur;
        cur = parentLookup[cur];
      }
      return null;
    };

    // Keep non-parent-child deps, mapped to epic-level endpoints
    const epicDeps = [];
    const seenKeys = new Set();
    deps.forEach(dep => {
      const rawType = resolveDepType(dep);
      const depType = normalizeRelType(rawType);
      if (depType === 'parent-child') return;

      const { fromId, toId } = resolveDepIds(dep);
      if (!fromId || !toId) return;

      const fromEpic = rootEpicFor(fromId) || (epicIds.has(fromId) ? fromId : null);
      const toEpic = rootEpicFor(toId) || (epicIds.has(toId) ? toId : null);
      if (!fromEpic || !toEpic || fromEpic === toEpic) return;

      const key = `${fromEpic}|${toEpic}|${depType}`;
      if (seenKeys.has(key)) return;
      seenKeys.add(key);

      epicDeps.push({
        ...dep,
        depends_on_id: fromEpic,
        issue_id: toEpic
      });
    });

    return { Issues: epicIssues, Dependencies: epicDeps };
  }).filter(c => c.Issues.length > 0);
};

/**
 * Filters graphData to show only task-level view.
 * Keeps non-epic issues and their inter-task dependencies.
 */
export const filterGraphDataTaskLevel = (graphData) => {
  if (!Array.isArray(graphData)) return [];

  return graphData.map(component => {
    const issues = component.Issues || [];
    const deps = component.Dependencies || [];

    const taskIssues = issues.filter(i => i.issue_type !== 'epic');
    const taskIds = new Set(taskIssues.map(i => i.id));

    const taskDeps = deps.filter(dep => {
      const rawType = resolveDepType(dep);
      if (normalizeRelType(rawType) === 'parent-child') return false;
      const { fromId, toId } = resolveDepIds(dep);
      return fromId && toId && taskIds.has(fromId) && taskIds.has(toId);
    });

    return { Issues: taskIssues, Dependencies: taskDeps };
  }).filter(c => c.Issues.length > 0);
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