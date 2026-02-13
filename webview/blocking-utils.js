/**
 * Blocking view utilities: topological sort, critical path, and completion order.
 * @module webview/blocking-utils
 */

const { getField } = require('./field-utils');

const PRIORITY_WEIGHT_BASE = 3;
const MAX_PRIORITY_LEVEL = 4;

/**
 * Build a blocking model from graph components data.
 * Extracts only "blocks"/"blocked-by" edges, computes topological sort,
 * critical path, and parallel work opportunities.
 *
 * @param {Array} components - Graph data from `bd graph --all --json`.
 * @param {object} [filters] - Optional filters to apply.
 * @param {number} [filters.priority] - Filter by priority (0-4).
 * @param {string} [filters.assignee] - Filter by assignee.
 * @param {string} [filters.label] - Filter by label.
 * @returns {{ issues: Array, edges: Array, completionOrder: Array, criticalPath: Array, readyItems: Array, parallelGroups: Array<Array> }}
 */
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
  const criticalPath = findCriticalPath(filteredIds, filteredEdges, issueMap);
  const readyItems = findReadyItems(filteredIds, filteredEdges, issueMap);
  const parallelGroups = findParallelGroups(filteredIds, filteredEdges, issueMap);

  const issues = filteredIds.map(id => issueMap[id]);

  return {
    issues,
    edges: filteredEdges,
    completionOrder: sortedIds.map(id => issueMap[id]),
    criticalPath: criticalPath.map(id => issueMap[id]),
    readyItems: readyItems.map(id => issueMap[id]),
    parallelGroups: parallelGroups.map(group => group.map(id => issueMap[id]))
  };
}

/**
 * Return an empty blocking model.
 * @returns {{ issues: Array, edges: Array, completionOrder: Array, criticalPath: Array, readyItems: Array, parallelGroups: Array }}
 */
function emptyModel() {
  return {
    issues: [],
    edges: [],
    completionOrder: [],
    criticalPath: [],
    readyItems: [],
    parallelGroups: []
  };
}

/**
 * Extract issues and blocking edges from graph components.
 * @param {Array} components - Graph data components.
 * @returns {{ issueMap: Record<string, object>, edges: Array<{from: string, to: string}> }}
 */
function extractBlockingGraph(components) {
  const issueMap = {};
  const edges = [];

  components.forEach(component => {
    if (component && component.IssueMap && typeof component.IssueMap === 'object') {
      Object.entries(component.IssueMap).forEach(([id, issue]) => {
        issueMap[id] = issue;
      });
    }
    (component?.Issues || []).forEach(issue => {
      if (issue && issue.id) {
        issueMap[issue.id] = issue;
      }
    });

    (component?.Dependencies || []).forEach(dep => {
      const fromId = getField(dep, ['from_id', 'FromID', 'fromId', 'issue_id', 'IssueID', 'issueId']);
      const toId = getField(dep, ['to_id', 'ToID', 'toId', 'depends_on_id', 'DependsOnID', 'dependsOnId']);
      const type = getField(dep, ['type', 'dependency_type', 'relationship']) || 'related';

      if (fromId && toId && (type === 'blocks' || type === 'blocked-by')) {
        // Normalize: "A blocks B" means B depends on A => edge from A to B
        if (type === 'blocks') {
          edges.push({ from: fromId, to: toId });
        } else {
          edges.push({ from: toId, to: fromId });
        }
      }
    });
  });

  return { issueMap, edges };
}

/**
 * Perform topological sort using Kahn's algorithm.
 * Returns items in dependency-safe completion order (dependencies first).
 * Handles cycles by appending remaining nodes at the end.
 *
 * @param {Array<string>} nodeIds - All node identifiers.
 * @param {Array<{from: string, to: string}>} edges - Directed edges (from blocks to).
 * @returns {Array<string>} Sorted node IDs.
 */
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

/**
 * Find the critical path (longest chain of blocking dependencies).
 * Uses dynamic programming on the DAG to find the longest path.
 *
 * @param {Array<string>} nodeIds - All node identifiers.
 * @param {Array<{from: string, to: string}>} edges - Directed edges.
 * @param {Record<string, object>} [issueMap] - Issue lookup used for priority weighting.
 * @returns {Array<string>} Node IDs on the critical path.
 */
function findCriticalPath(nodeIds, edges, issueMap) {
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

  const weights = {};
  nodeIds.forEach(id => {
    weights[id] = getPriorityWeight(issueMap?.[id]);
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

  // Find the node with the maximum distance
  let maxDist = 0;
  let endNode = sorted[0];
  nodeIds.forEach(id => {
    if (dist[id] > maxDist) {
      maxDist = dist[id];
      endNode = id;
    }
  });

  // Trace back to reconstruct path
  const path = [];
  let current = endNode;
  while (current !== null) {
    path.unshift(current);
    current = predecessor[current];
  }

  return path;
}

/**
 * Compute a weight for priority so that higher-priority (lower number) items dominate path scoring.
 * @param {object} issue - Issue metadata.
 * @returns {number} Priority weight (>=1).
 */
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

/**
 * Find items that are currently unblocked (no incomplete blockers).
 * An item is ready if it has no incoming blocking edges from non-closed items.
 *
 * @param {Array<string>} nodeIds - All node identifiers.
 * @param {Array<{from: string, to: string}>} edges - Directed edges (from blocks to).
 * @param {Record<string, object>} issueMap - Issue data lookup.
 * @returns {Array<string>} IDs of ready items.
 */
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

/**
 * Identify groups of items that can be worked on in parallel.
 * Items at the same topological depth can be done simultaneously.
 *
 * @param {Array<string>} nodeIds - All node identifiers.
 * @param {Array<{from: string, to: string}>} edges - Directed edges.
 * @param {Record<string, object>} [issueMap] - Optional issue lookup to ignore completed blockers.
 * @returns {Array<Array<string>>} Groups of node IDs at the same depth.
 */
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

/**
 * Apply filters to a list of issue IDs.
 * @param {Array<string>} ids - Issue IDs to filter.
 * @param {Record<string, object>} issueMap - Issue lookup table.
 * @param {object} filters - Filter criteria.
 * @param {number} [filters.priority] - Priority level to match.
 * @param {string} [filters.assignee] - Assignee to match.
 * @param {string} [filters.label] - Label to match.
 * @returns {Array<string>} Filtered issue IDs.
 */
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
  findReadyItems,
  findParallelGroups,
  applyFilters
};
