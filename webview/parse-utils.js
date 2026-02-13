/**
 * Parsing utilities for bd command output.
 * @module webview/parse-utils
 */

const { getField, buildIssueMap, DEP_ISSUE_KEYS, DEP_TARGET_KEYS, DEP_TYPE_KEYS, DEP_FROM_KEYS, DEP_TO_KEYS } = require('./field-utils');

/**
 * Format a priority value into a normalized string like 'p0', 'p1', etc.
 * @param {number|string|null|undefined} priority - Raw priority value
 * @returns {string} Normalized priority string
 */
function formatPriority(priority) {
  if (priority === undefined || priority === null) return 'p2';
  const raw = String(priority).trim();
  if (raw.toLowerCase().startsWith('p')) {
    const value = raw.slice(1) || '2';
    return `p${value}`;
  }
  return `p${raw || '2'}`;
}

/**
 * Normalize a raw issue object into a consistent shape.
 * @param {Object} issue - Raw issue from bd output
 * @returns {Object|null} Normalized issue or null if invalid
 */
function normalizeIssue(issue) {
  if (!issue || !issue.id) {
    return null;
  }

  return {
    id: issue.id,
    title: issue.title || issue.id,
    type: issue.issue_type || 'task',
    priority: formatPriority(issue.priority),
    status: issue.status || 'open',
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    closed_at: issue.closed_at,
    description: issue.description,
    assignee: issue.assignee,
    labels: Array.isArray(issue.labels) ? issue.labels : [],
    dependency_count: issue.dependency_count || 0,
    dependent_count: issue.dependent_count || 0
  };
}

/**
 * Build a set of issue IDs that are blocked by open dependencies.
 * An item is blocked if it has an incoming "blocks" edge from a non-closed item.
 * @param {string|Array} graphData - Raw graph data
 * @returns {Set<string>} Set of blocked issue IDs
 */
function buildBlockedSet(graphData) {
  const components = parseGraphComponents(graphData);
  if (components.length === 0) return new Set();

  const issueMap = buildIssueMap(components);
  const blockedBy = {};

  components.forEach(component => {
    (component?.Dependencies || []).forEach(dep => {
      const fromId = getField(dep, DEP_FROM_KEYS);
      const toId = getField(dep, DEP_TO_KEYS);
      const type = getField(dep, DEP_TYPE_KEYS) || 'related';

      if (!fromId || !toId) return;
      if (type === 'blocks') {
        if (!blockedBy[toId]) blockedBy[toId] = [];
        blockedBy[toId].push(fromId);
      } else if (type === 'blocked-by') {
        if (!blockedBy[fromId]) blockedBy[fromId] = [];
        blockedBy[fromId].push(toId);
      }
    });
  });

  const blockedSet = new Set();
  for (const [id, blockers] of Object.entries(blockedBy)) {
    const hasOpenBlocker = blockers.some(blockerId => {
      const blocker = issueMap[blockerId];
      return !blocker || (blocker.status !== 'closed' && blocker.status !== 'done');
    });
    if (hasOpenBlocker) {
      blockedSet.add(id);
    }
  }

  return blockedSet;
}

/**
 * Parse graph component data from a string or array.
 * @param {string|Array} graphData - Raw graph data
 * @returns {Array} Parsed array of graph components
 */
function parseGraphComponents(graphData) {
  if (!graphData) return [];
  try {
    if (typeof graphData === 'string') {
      return JSON.parse(graphData) || [];
    }
    return Array.isArray(graphData) ? graphData : [];
  } catch (error) {
    console.error('Failed to parse graph data:', error);
    return [];
  }
}

/**
 * Build a lookup map of child ID to parent ID from graph components.
 * @param {Array} graphComponents - Parsed graph components with dependencies
 * @returns {Object} Map of child issue ID to parent issue ID
 */
function buildParentLookup(graphComponents) {
  const parentLookup = {};

  graphComponents.forEach(component => {
    (component?.Dependencies || []).forEach(dep => {
      const type = getField(dep, DEP_TYPE_KEYS);
      if (type !== 'parent-child') {
        return;
      }

      const childId = getField(dep, DEP_ISSUE_KEYS);
      const parentId = getField(dep, DEP_TARGET_KEYS);

      if (childId && parentId) {
        parentLookup[childId] = parentId;
      }
    });
  });

  return parentLookup;
}

/**
 * Build a hierarchy tree from open issues and graph dependency data.
 * @param {Array} openIssues - Array of normalized open issues
 * @param {string|Array} graphData - Raw graph data for parent-child relationships
 * @returns {Array<{issue: Object, children: Array}>} Tree of issues with children
 */
function buildHierarchyFromGraph(openIssues, graphData) {
  if (!Array.isArray(openIssues) || openIssues.length === 0) {
    return [];
  }

  const graphComponents = parseGraphComponents(graphData);
  if (graphComponents.length === 0) {
    return openIssues.map(issue => ({ issue, children: [] }));
  }

  const parentLookup = buildParentLookup(graphComponents);
  const nodeMap = {};

  openIssues.forEach(issue => {
    nodeMap[issue.id] = { issue, children: [] };
  });

  const roots = [];

  openIssues.forEach(issue => {
    const parentId = parentLookup[issue.id];
    const parentNode = parentId ? nodeMap[parentId] : null;

    if (parentNode) {
      parentNode.children.push(nodeMap[issue.id]);
    } else {
      roots.push(nodeMap[issue.id]);
    }
  });

  return roots;
}

/**
 * Parse JSON output from bd list/ready/blocked commands into structured data.
 * @param {string} jsonOutput - Raw JSON string from bd command
 * @param {string} command - The command that produced this output
 * @param {string|Array} [graphData] - Optional graph data used to build hierarchy
 * @returns {{ type: string, command: string, header?: string, openIssues?: Array, closedIssues?: Array, hierarchy?: Array, message?: string }}
 */
function parseListJSON(jsonOutput, command, graphData) {
  try {
    const issues = JSON.parse(jsonOutput);
    const openIssues = [];
    const closedIssues = [];
    const blockedSet = buildBlockedSet(graphData);

    issues.forEach(issue => {
      const normalizedIssue = normalizeIssue(issue);
      if (!normalizedIssue) return;

      if (normalizedIssue.status === 'closed') {
        closedIssues.push(normalizedIssue);
      } else {
        normalizedIssue.isBlocked = blockedSet.has(normalizedIssue.id);
        openIssues.push(normalizedIssue);
      }
    });

    closedIssues.sort((a, b) => {
      if (a.closed_at && b.closed_at) {
        return new Date(b.closed_at) - new Date(a.closed_at);
      }
      return 0;
    });

    const hierarchy = buildHierarchyFromGraph(openIssues, graphData);
    const totalCount = openIssues.length + closedIssues.length;
    const blockedCount = openIssues.filter(i => i.isBlocked).length;
    const details = [];
    if (closedIssues.length > 0) {
      details.push(`${openIssues.length} open`);
      details.push(`${closedIssues.length} closed`);
    }
    if (blockedCount > 0) {
      details.push(`${blockedCount} blocked`);
    }
    let header = `Found ${totalCount} issue${totalCount !== 1 ? 's' : ''}`;
    if (details.length > 0) {
      header += ` (${details.join(', ')})`;
    }

    return {
      type: 'list',
      command,
      header: header,
      openIssues,
      closedIssues,
      hierarchy
    };
  } catch (error) {
    console.error('Failed to parse JSON list output:', error);
    return { type: 'error', message: 'Failed to parse issue list', command };
  }
}

/**
 * Parse text output from bd stats command into structured data.
 * @param {string} text - Raw text from bd stats
 * @returns {{ type: string, header: string, stats: Object }}
 */
function parseStatsOutput(text) {
  const lines = text.split('\n');
  const stats = {};
  let header = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.includes('Statistics')) {
      header = trimmed;
      continue;
    }

    const match = trimmed.match(/^([^:]+):\s+(.+)$/);
    if (match) {
      const [, key, value] = match;
      stats[key.trim()] = value.trim();
    }
  }

  return { type: 'stats', header, stats };
}

module.exports = { parseListJSON, parseStatsOutput };
