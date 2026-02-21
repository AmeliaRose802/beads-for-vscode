/**
 * Graph algorithm utilities for blocking analysis.
 * Extracted from blocking-utils.js to reduce file length.
 */

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

const { getField } = require('./field-utils');

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

/** Trace back through predecessor map to reconstruct a path ending at endNode. */
function reconstructPath(endNode, predecessor) {
  const path = [];
  let current = endNode;
  const visited = new Set();

  while (current !== null && !visited.has(current)) {
    path.unshift(current);
    visited.add(current);
    current = predecessor[current] ?? null;
  }

  if (current !== null) {
    path.unshift(current);
  }

  return path;
}

/** Check if candidate is a subsequence of an existing path. */
function isSubpathOf(candidate, existingPath) {
  let matchIdx = 0;
  for (const nodeId of existingPath) {
    if (candidate[matchIdx] === nodeId) {
      matchIdx++;
      if (matchIdx === candidate.length) return true;
    }
  }
  return false;
}

/** Find top critical paths (longest chains of blocking dependencies) using DP. */
function findCriticalPaths(nodeIds, edges, issueMap, maxPaths = Infinity) {
  if (nodeIds.length === 0) return [];

  const outEdges = {};
  nodeIds.forEach(id => { outEdges[id] = []; });

  edges.forEach(({ from, to }) => {
    if (outEdges[from] && outEdges[to] !== undefined) {
      outEdges[from].push(to);
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
    if (hasEstimates) {
      const estimateMinutes = estimateById[id];
      weights[id] = estimateMinutes === undefined ? 1 : estimateMinutes;
    } else {
      weights[id] = getPriorityWeight(issueMap?.[id]);
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
  const usedEndpoints = new Set();
  
  for (const { id: endNode } of nodesByDist) {
    if (paths.length >= maxPaths) break;
    if (usedEndpoints.has(endNode)) continue;
    
    const path = reconstructPath(endNode, predecessor);
    
    if (paths.some(existing => isSubpathOf(path, existing))) continue;
    
    paths.push(path);
    usedEndpoints.add(endNode);
  }

  return paths;
}

/** Compute priority weight (higher-priority/lower-number items get higher weight). */
function getPriorityWeight(issue) {
  if (!issue || issue.priority == null) {
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
  if (raw == null) {
    return null;
  }

  const minutes = Number(raw);
  if (!Number.isFinite(minutes) || minutes < 0) {
    return null;
  }

  return minutes;
}

module.exports = {
  topologicalSort,
  calculateFanOut,
  findCriticalPaths
};
