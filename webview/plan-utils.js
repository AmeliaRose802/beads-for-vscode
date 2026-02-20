/**
 * Plan view utilities: build wave schedules based on capacity.
 * @module webview/plan-utils
 */

const { isClosedStatus } = require('./field-utils');

/**
 * Build a wave-based execution plan with a configurable parallel limit.
 * Closed items are treated as already complete and omitted from the schedule.
 *
 * @param {Array<object>} issues - Issue objects to schedule.
 * @param {Array<{from: string, to: string}>} edges - Directed edges (from blocks to).
 * @param {Array<object>} [completionOrder] - Optional ordered issue list for deterministic scheduling.
 * @param {number} maxParallel - Maximum items per wave.
 * @returns {{ waves: Array<Array<object>>, totalWaves: number, totalItems: number, averageThroughput: number, capacity: number }}
 */
function buildPlanSchedule(issues, edges, completionOrder, maxParallel) {
  const capacity = normalizeParallelLimit(maxParallel);
  if (!Array.isArray(issues) || issues.length === 0) {
    return {
      waves: [],
      totalWaves: 0,
      totalItems: 0,
      averageThroughput: 0,
      capacity,
      cycleGroups: [],
      cycleIds: []
    };
  }

  const issueMap = {};
  issues.forEach(issue => {
    if (issue && issue.id !== undefined && issue.id !== null) {
      issueMap[issue.id] = issue;
    }
  });

  const nodeIds = Object.keys(issueMap);
  const fallbackIndex = new Map();
  nodeIds.forEach((id, idx) => fallbackIndex.set(id, idx));

  const orderIndex = new Map();
  if (Array.isArray(completionOrder)) {
    completionOrder.forEach((issue, idx) => {
      if (issue && issue.id !== undefined && issue.id !== null) {
        orderIndex.set(issue.id, idx);
      }
    });
  }

  const blockersById = {};
  nodeIds.forEach(id => { blockersById[id] = []; });
  edges.forEach(({ from, to }) => {
    if (blockersById[to]) {
      blockersById[to].push(from);
    }
  });

  const completed = new Set(nodeIds.filter(id => isClosedStatus(issueMap[id]?.status)));
  // Epics are organizational containers, not actionable work items
  const remaining = new Set(nodeIds.filter(id => !completed.has(id) && issueMap[id]?.issue_type !== 'epic'));
  const openNodeIds = Array.from(remaining);
  const cycleGroups = findCycleGroups(openNodeIds, edges)
    .map(group => group.map(id => issueMap[id]).filter(Boolean));
  const cycleIdSet = new Set();
  cycleGroups.forEach(group => {
    group.forEach(issue => {
      if (issue && issue.id !== undefined && issue.id !== null) {
        cycleIdSet.add(issue.id);
      }
    });
  });
  const waves = [];

  const compareIds = (a, b) => {
    const aIndex = orderIndex.has(a) ? orderIndex.get(a) : fallbackIndex.get(a);
    const bIndex = orderIndex.has(b) ? orderIndex.get(b) : fallbackIndex.get(b);
    if (aIndex !== undefined && bIndex !== undefined && aIndex !== bIndex) {
      return aIndex - bIndex;
    }
    return String(a).localeCompare(String(b));
  };

  while (remaining.size > 0) {
    const ready = [];
    remaining.forEach(id => {
      const blockers = blockersById[id] || [];
      const isBlocked = blockers.some(blockerId => remaining.has(blockerId) && !completed.has(blockerId));
      if (!isBlocked) {
        ready.push(id);
      }
    });

    const candidates = ready.length > 0 ? ready : Array.from(remaining);
    candidates.sort(compareIds);
    const waveIds = candidates.slice(0, capacity);

    waves.push(waveIds.map(id => issueMap[id]).filter(Boolean));
    waveIds.forEach(id => {
      completed.add(id);
      remaining.delete(id);
    });
  }

  const totalItems = waves.reduce((sum, wave) => sum + wave.length, 0);
  const totalWaves = waves.length;
  const averageThroughput = totalWaves === 0 ? 0 : totalItems / totalWaves;

  return {
    waves,
    totalWaves,
    totalItems,
    averageThroughput,
    capacity,
    cycleGroups,
    cycleIds: Array.from(cycleIdSet)
  };
}

/**
 * Normalize a parallel limit to a positive integer.
 * @param {number} maxParallel - Parallel limit input.
 * @returns {number} Normalized capacity.
 */
function normalizeParallelLimit(maxParallel) {
  const parsed = Number(maxParallel);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }
  return Math.floor(parsed);
}

/**
 * Detect strongly connected components that represent circular dependencies.
 * @param {Array<string>} nodeIds - IDs of open issues.
 * @param {Array<{from: string, to: string}>} edges - Directed edges (blocker -> blocked).
 * @returns {Array<Array<string>>} List of cycle groups (each group is a list of IDs).
 */
function findCycleGroups(nodeIds, edges) {
  if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
    return [];
  }

  const nodeSet = new Set(nodeIds);
  const adjacency = {};
  nodeIds.forEach(id => {
    adjacency[id] = [];
  });

  edges.forEach(({ from, to }) => {
    if (nodeSet.has(from) && nodeSet.has(to)) {
      adjacency[from].push(to);
    }
  });

  const indexMap = new Map();
  const lowlink = new Map();
  const stack = [];
  const onStack = new Set();
  const groups = [];
  let index = 0;

  function strongConnect(nodeId) {
    indexMap.set(nodeId, index);
    lowlink.set(nodeId, index);
    index += 1;
    stack.push(nodeId);
    onStack.add(nodeId);

    const neighbors = adjacency[nodeId] || [];
    neighbors.forEach(neighborId => {
      if (!indexMap.has(neighborId)) {
        strongConnect(neighborId);
        lowlink.set(nodeId, Math.min(lowlink.get(nodeId), lowlink.get(neighborId)));
      } else if (onStack.has(neighborId)) {
        lowlink.set(nodeId, Math.min(lowlink.get(nodeId), indexMap.get(neighborId)));
      }
    });

    if (lowlink.get(nodeId) === indexMap.get(nodeId)) {
      const component = [];
      let member;
      do {
        member = stack.pop();
        onStack.delete(member);
        component.push(member);
      } while (member !== nodeId);

      const hasSelfLoop = (adjacency[nodeId] || []).includes(nodeId);
      if (component.length > 1 || hasSelfLoop) {
        groups.push(component);
      }
    }
  }

  nodeIds.forEach(nodeId => {
    if (!indexMap.has(nodeId)) {
      strongConnect(nodeId);
    }
  });

  return groups;
}

module.exports = {
  buildPlanSchedule
};
