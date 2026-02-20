/**
 * Blocking view utilities: topological sort, critical path, and completion order.
 */

const { getField, buildIssueMap, isClosedStatus, DEP_FROM_KEYS, DEP_TO_KEYS, DEP_TYPE_KEYS } = require('./field-utils');
const { topologicalSort, findCriticalPaths, calculateFanOut } = require('./blocking-utils-algorithms');

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
  const { blocksCount, blockedByCount } = calculateBlockingCounts(filteredIds, filteredEdges);

  const issues = filteredIds.map(id => issueMap[id]);

  return {
    issues,
    edges: filteredEdges,
    completionOrder: sortedIds.map(id => issueMap[id]),
    criticalPath: criticalPaths.length > 0 ? criticalPaths[0].map(id => issueMap[id]) : [],
    criticalPaths: criticalPaths.map(path => path.map(id => issueMap[id])),
    readyItems: readyItems.map(id => issueMap[id]),
    parallelGroups: parallelGroups.map(group => group.map(id => issueMap[id])),
    fanOutCounts,
    blocksCount,
    blockedByCount
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
    fanOutCounts: {},
    blocksCount: {},
    blockedByCount: {}
  };
}

/**
 * Normalize a dependency relationship type into a canonical value.
 * @param {string|undefined|null} rawType - Raw relationship type from bd output.
 * @returns {string} Canonicalized relationship type string.
 */
function normalizeRelationshipType(rawType) {
  const value = String(rawType || 'related').toLowerCase();
  if (value === 'parent') return 'parent-child';
  if (value === 'relates-to') return 'related';
  return value;
}

/** Extract issues and blocking edges from graph components. */
function extractBlockingGraph(components) {
  const issueMap = buildIssueMap(components);
  const edges = [];

  components.forEach(component => {
    (component?.Dependencies || []).forEach(dep => {
      const fromId = getField(dep, DEP_FROM_KEYS);
      const toId = getField(dep, DEP_TO_KEYS);
      const type = normalizeRelationshipType(getField(dep, DEP_TYPE_KEYS));

      if (!fromId || !toId) {
        return;
      }

      const hasBeadsIssueKey = Object.prototype.hasOwnProperty.call(dep, 'issue_id')
        || Object.prototype.hasOwnProperty.call(dep, 'IssueID')
        || Object.prototype.hasOwnProperty.call(dep, 'issueId');
      const hasBeadsDependsOnKey = Object.prototype.hasOwnProperty.call(dep, 'depends_on_id')
        || Object.prototype.hasOwnProperty.call(dep, 'DependsOnID')
        || Object.prototype.hasOwnProperty.call(dep, 'dependsOnId');
      const isBeadsOrientation = hasBeadsIssueKey || hasBeadsDependsOnKey;

      if (type === 'parent-child') {
        if (isBeadsOrientation) {
          // Child (issue_id) must complete before parent (depends_on_id).
          edges.push({ from: fromId, to: toId });
        } else {
          // Legacy format where from = parent, to = child. Child blocks parent.
          edges.push({ from: toId, to: fromId });
        }
        return;
      }

      if (type === 'blocks' || type === 'blocked-by') {
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
    if (issue && isClosedStatus(issue.status)) {
      return false;
    }
    // Ready if all blockers are closed/done
    return blockedBy[id].every(blockerId => {
      const blocker = issueMap[blockerId];
      return blocker && isClosedStatus(blocker.status);
    });
  });
}

/** Identify groups of items that can be worked on in parallel. */
function findParallelGroups(nodeIds, edges, issueMap) {
  if (nodeIds.length === 0) return [];

  // Epics are organizational containers, not actionable work items
  if (issueMap) {
    nodeIds = nodeIds.filter(id => issueMap[id]?.issue_type !== 'epic');
    if (nodeIds.length === 0) return [];
  }

  const inDegree = {};
  const outEdges = {};
  nodeIds.forEach(id => {
    inDegree[id] = 0;
    outEdges[id] = [];
  });

  edges.forEach(({ from, to }) => {
    // Completed blockers should not push work into later phases.
    if (issueMap && isClosedStatus(issueMap[from]?.status)) return;

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

/** Calculate blocking and blocked-by counts for each node. */
function calculateBlockingCounts(nodeIds, edges) {
  const blocksCount = {}; // How many items each node blocks (outgoing)
  const blockedByCount = {}; // How many items each node is blocked by (incoming)
  
  // Initialize counts
  nodeIds.forEach(id => {
    blocksCount[id] = 0;
    blockedByCount[id] = 0;
  });
  
  // Count relationships from edges
  edges.forEach(({ from, to }) => {
    if (blocksCount[from] !== undefined) {
      blocksCount[from]++;
    }
    if (blockedByCount[to] !== undefined) {
      blockedByCount[to]++;
    }
  });
  
  return { blocksCount, blockedByCount };
}

module.exports = {
  buildBlockingModel,
  topologicalSort,
  findCriticalPaths,
  findReadyItems,
  findParallelGroups,
  applyFilters,
  calculateFanOut,
  calculateBlockingCounts
};
