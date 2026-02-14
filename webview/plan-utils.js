/**
 * Plan view utilities: build wave schedules based on capacity.
 * @module webview/plan-utils
 */

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
      capacity
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

  const isClosed = (id) => {
    const status = issueMap[id]?.status;
    return status === 'closed' || status === 'done';
  };

  const completed = new Set(nodeIds.filter(isClosed));
  const remaining = new Set(nodeIds.filter(id => !completed.has(id)));
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
    capacity
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

module.exports = {
  buildPlanSchedule
};
