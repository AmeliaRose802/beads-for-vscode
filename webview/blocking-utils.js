/**
 * Blocking view utilities: topological sort, critical path, and completion order.
 */

const { getField, buildIssueMap, DEP_FROM_KEYS, DEP_TO_KEYS, DEP_TYPE_KEYS } = require('./field-utils');

const PRIORITY_WEIGHT_BASE = 3;
const MAX_PRIORITY_LEVEL = 4;
const ESTIMATE_MINUTES_KEYS = [
  'estimate_minutes',
  'estimateMinutes',
  'EstimateMinutes',
  'estimate_min',
  'estimateMin',
  'estimate',
  'Estimate',
  'duration_minutes',
  'durationMinutes'
];

/** Build blocking model from graph components. */
function buildBlockingModel(components, filters) {
  if (!Array.isArray(components) || components.length === 0) {
    return emptyModel();
  }

  const { issueMap, edges } = extractBlockingGraph(components);

  let filteredIds = Object.keys(issueMap);
  if (filters) {
    filteredIds = applyFilters(filteredIds, issueMap, filters);
  }

  const filteredEdges = edges.filter(
    e => filteredIds.includes(e.from) && filteredIds.includes(e.to)
  );

  const sortedIds = topologicalSort(filteredIds, filteredEdges);
  const criticalPaths = findCriticalPaths(filteredIds, filteredEdges, issueMap);
  const readyItems = findReadyItems(filteredIds, filteredEdges, issueMap);
  const parallelGroups = findParallelGroups(filteredIds, filteredEdges, issueMap);
  const fanOutCounts = calculateFanOut(filteredIds, filteredEdges);

  const issues = filteredIds.map(id => issueMap[id]);

  return {
    issues,
    edges: filteredEdges,
    completionOrder: sortedIds.map(id => issueMap[id]),
    criticalPath: criticalPaths.length > 0 ? criticalPaths[0].map(id => issueMap[id]) : [],
    criticalPaths: criticalPaths.map(path => path.map(id => issueMap[id])),
    readyItems: readyItems.map(id => issueMap[id]),
    parallelGroups: parallelGroups.map(group => group.map(id => issueMap[id])),
    fanOutCounts
  };
}

/** Return empty blocking model. */
function emptyModel() {
  return {
    issues: [],
    edges: [],
    completionOrder: [],
    criticalPath: [],
    criticalPaths: [],
    readyItems: [],
    parallelGroups: [],
    fanOutCounts: {}
  };
}

/** Extract issues and blocking edges from graph components. */
function extractBlockingGraph(components) {
  const issueMap = buildIssueMap(components);
  const edges = [];

  components.forEach(component => {
    (component?.Dependencies || []).forEach(dep => {
      const fromId = getField(dep, DEP_FROM_KEYS);
      const toId = getField(dep, DEP_TO_KEYS);
      const type = getField(dep, DEP_TYPE_KEYS) || 'related';

      if (fromId && toId && (type === 'blocks' || type === 'blocked-by')) {
        const hasBeadsIssueKey = Object.prototype.hasOwnProperty.call(dep, 'issue_id')
          || Object.prototype.hasOwnProperty.call(dep, 'IssueID')
          || Object.prototype.hasOwnProperty.call(dep, 'issueId');
        const hasBeadsDependsOnKey = Object.prototype.hasOwnProperty.call(dep, 'depends_on_id')
          || Object.prototype.hasOwnProperty.call(dep, 'DependsOnID')
          || Object.prototype.hasOwnProperty.call(dep, 'dependsOnId');
        const isBeadsOrientation = hasBeadsIssueKey || hasBeadsDependsOnKey;

        if (isBeadsOrientation) {
          // Beads graph data uses issue -> depends_on orientation.
          // Normalize to edges from blocker to blocked: depends_on (blocker) -> issue (blocked).
          edges.push({ from: toId, to: fromId });
        } else if (type === 'blocks') {
          // Legacy from/to format where `from` blocks `to`.
          edges.push({ from: fromId, to: toId });
        } else {
          // Legacy `blocked-by` format where `from` is blocked by `to`.
          edges.push({ from: toId, to: fromId });
        }
      }
    });
  });

  return { issueMap, edges };
}

/** Topological sort using Kahn's algorithm. Returns items in dependency-safe order. */
function topologicalSort(nodeIds, edges) {
  const inDegree = {};
  const outEdges = {};

  nodeIds.forEach(id => {
    inDegree[id] = 0;
    outEdges[id] = [];
  });

  edges.forEach(({ from, to }) => {
    if (inDegree[to] !== undefined && outEdges[from] !== undefined) {
      inDegree[to]++;
      outEdges[from].push(to);
    }
  });

  const queue = [];
  nodeIds.forEach(id => {
    if (inDegree[id] === 0) {
      queue.push(id);
    }
  });

  const sorted = [];
  while (queue.length > 0) {
    const id = queue.shift();
    sorted.push(id);

    outEdges[id].forEach(targetId => {
      inDegree[targetId]--;
      if (inDegree[targetId] === 0) {
        queue.push(targetId);
      }
    });
  }

  // Append remaining nodes (in cycles)
  nodeIds.forEach(id => {
    if (!sorted.includes(id)) {
      sorted.push(id);
    }
  });

  return sorted;
}

/** Calculate fan-out impact (how many items each node transitively unblocks). */
function calculateFanOut(nodeIds, edges) {
  const outEdges = {};
  nodeIds.forEach(id => { outEdges[id] = []; });
  
  edges.forEach(({ from, to }) => {
    if (outEdges[from]) {
      outEdges[from].push(to);
    }
  });

  // Compute transitive closure using DFS
  const fanOut = {};
  const visited = new Set();

  function dfs(nodeId) {
    if (visited.has(nodeId)) {
      return fanOut[nodeId] || new Set();
    }
    
    visited.add(nodeId);
    const reachable = new Set();
    
    outEdges[nodeId].forEach(childId => {
      reachable.add(childId);
      const childDescendants = dfs(childId);
      childDescendants.forEach(d => reachable.add(d));
    });
    
    fanOut[nodeId] = reachable;
    return reachable;
  }

  nodeIds.forEach(id => {
    if (!visited.has(id)) {
      dfs(id);
    }
  });

  // Convert sets to counts
  const fanOutCounts = {};
  nodeIds.forEach(id => {
    fanOutCounts[id] = fanOut[id] ? fanOut[id].size : 0;
  });

  return fanOutCounts;
}

/** Find top critical paths (longest chains of blocking dependencies) using DP. */
function findCriticalPaths(nodeIds, edges, issueMap, maxPaths = 3) {
  if (nodeIds.length === 0) return [];

  const outEdges = {};
  const inEdges = {};
  nodeIds.forEach(id => {
    outEdges[id] = [];
    inEdges[id] = [];
  });

  edges.forEach(({ from, to }) => {
    if (outEdges[from] && inEdges[to]) {
      outEdges[from].push(to);
      inEdges[to].push(from);
    }
  });

  const sorted = topologicalSort(nodeIds, edges);

  const estimateById = {};
  let hasEstimates = false;
  nodeIds.forEach(id => {
    const estimate = getEstimateMinutes(issueMap?.[id]);
    if (estimate !== null) {
      estimateById[id] = estimate;
      hasEstimates = true;
    }
  });

  const weights = {};
  nodeIds.forEach(id => {
    const priorityWeight = getPriorityWeight(issueMap?.[id]);
    if (hasEstimates) {
      const estimateMinutes = estimateById[id];
      weights[id] = estimateMinutes === undefined ? 1 : estimateMinutes;
    } else {
      weights[id] = priorityWeight;
    }
  });

  // Longest path DP
  const dist = {};
  const predecessor = {};
  nodeIds.forEach(id => {
    dist[id] = weights[id];
    predecessor[id] = null;
  });

  sorted.forEach(id => {
    outEdges[id].forEach(toId => {
      const candidateScore = dist[id] + weights[toId];
      if (candidateScore > dist[toId]) {
        dist[toId] = candidateScore;
        predecessor[toId] = id;
      }
    });
  });

  // Find top nodes by distance, ensuring they represent distinct paths
  const nodesByDist = nodeIds
    .map(id => ({ id, dist: dist[id] }))
    .sort((a, b) => b.dist - a.dist);

  const paths = [];
  const usedNodes = new Set();
  
  for (const { id: endNode, dist: endDist } of nodesByDist) {
    if (paths.length >= maxPaths) break;
    
    // Skip if this node is already part of an existing path
    if (usedNodes.has(endNode)) continue;
    
    // Trace back to reconstruct path
    const path = [];
    let current = endNode;
    while (current !== null) {
      path.unshift(current);
      current = predecessor[current];
    }
    
    // Only include paths that are reasonably significant
    // (at least 70% of the longest path's distance)
    if (paths.length === 0 || endDist >= nodesByDist[0].dist * 0.7) {
      paths.push(path);
      // Mark all nodes in this path as used to avoid subpaths
      path.forEach(nodeId => usedNodes.add(nodeId));
    }
  }

  return paths;
}

/** Find single critical path (longest chain) - maintained for backward compatibility. */
function findCriticalPath(nodeIds, edges, issueMap) {
  const paths = findCriticalPaths(nodeIds, edges, issueMap, 1);
  return paths.length > 0 ? paths[0] : [];
}

/** Compute priority weight (higher-priority/lower-number items get higher weight). */
function getPriorityWeight(issue) {
  if (!issue || issue.priority === undefined || issue.priority === null) {
    return 1;
  }

  const numericPriority = Number(issue.priority);
  if (Number.isNaN(numericPriority)) {
    return 1;
  }

  const clamped = Math.min(MAX_PRIORITY_LEVEL, Math.max(0, numericPriority));
  const exponent = MAX_PRIORITY_LEVEL - clamped;
  return Math.pow(PRIORITY_WEIGHT_BASE, exponent);
}

/** Extract estimated duration in minutes from an issue if available. */
function getEstimateMinutes(issue) {
  if (!issue) {
    return null;
  }

  const raw = getField(issue, ESTIMATE_MINUTES_KEYS);
  if (raw === undefined || raw === null) {
    return null;
  }

  const minutes = Number(raw);
  if (!Number.isFinite(minutes) || minutes < 0) {
    return null;
  }

  return minutes;
}

/** Find items that are currently unblocked (no incomplete blockers). */
function findReadyItems(nodeIds, edges, issueMap) {
  const blockedBy = {};
  nodeIds.forEach(id => { blockedBy[id] = []; });

  // For each edge "from blocks to", "to" is blocked by "from"
  edges.forEach(({ from, to }) => {
    if (blockedBy[to]) {
      blockedBy[to].push(from);
    }
  });

  return nodeIds.filter(id => {
    const issue = issueMap[id];
    if (issue && (issue.status === 'closed' || issue.status === 'done')) {
      return false;
    }
    // Ready if all blockers are closed/done
    return blockedBy[id].every(blockerId => {
      const blocker = issueMap[blockerId];
      return blocker && (blocker.status === 'closed' || blocker.status === 'done');
    });
  });
}

/** Identify groups of items that can be worked on in parallel. */
function findParallelGroups(nodeIds, edges, issueMap) {
  if (nodeIds.length === 0) return [];

  const isClosed = (id) => {
    const status = issueMap?.[id]?.status;
    return status === 'closed' || status === 'done';
  };

  const inDegree = {};
  const outEdges = {};
  nodeIds.forEach(id => {
    inDegree[id] = 0;
    outEdges[id] = [];
  });

  edges.forEach(({ from, to }) => {
    // Completed blockers should not push work into later phases.
    if (issueMap && isClosed(from)) return;

    if (inDegree[to] !== undefined && outEdges[from] !== undefined) {
      inDegree[to]++;
      outEdges[from].push(to);
    }
  });

  const depth = {};
  const queue = [];
  nodeIds.forEach(id => {
    if (inDegree[id] === 0) {
      queue.push(id);
      depth[id] = 0;
    }
  });

  while (queue.length > 0) {
    const id = queue.shift();
    outEdges[id].forEach(toId => {
      inDegree[toId]--;
      const newDepth = depth[id] + 1;
      if (depth[toId] === undefined || newDepth > depth[toId]) {
        depth[toId] = newDepth;
      }
      if (inDegree[toId] === 0) {
        queue.push(toId);
      }
    });
  }

  // Assign remaining cyclic nodes
  nodeIds.forEach(id => {
    if (depth[id] === undefined) {
      depth[id] = 0;
    }
  });

  // Group by depth
  const groups = {};
  nodeIds.forEach(id => {
    const d = depth[id];
    if (!groups[d]) groups[d] = [];
    groups[d].push(id);
  });

  return Object.keys(groups)
    .sort((a, b) => Number(a) - Number(b))
    .map(key => groups[key]);
}

/** Apply filters to a list of issue IDs. */
function applyFilters(ids, issueMap, filters) {
  return ids.filter(id => {
    const issue = issueMap[id];
    if (!issue) return false;

    if (filters.priority !== undefined && filters.priority !== null) {
      if (issue.priority !== filters.priority) return false;
    }
    if (filters.assignee) {
      if (!issue.assignee || !issue.assignee.includes(filters.assignee)) return false;
    }
    if (filters.label) {
      const labels = Array.isArray(issue.labels) ? issue.labels : [];
      if (!labels.includes(filters.label)) return false;
    }
    return true;
  });
}

module.exports = {
  buildBlockingModel,
  topologicalSort,
  findCriticalPath,
  findCriticalPaths,
  findReadyItems,
  findParallelGroups,
  applyFilters,
  calculateFanOut
};
