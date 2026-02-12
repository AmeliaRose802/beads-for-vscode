/**
 * Parsing utilities for bd command output.
 * @module webview/parse-utils
 */

const { getField } = require('./field-utils');

function formatPriority(priority) {
  if (priority === undefined || priority === null) return 'p2';
  const raw = String(priority).trim();
  if (raw.toLowerCase().startsWith('p')) {
    const value = raw.slice(1) || '2';
    return `p${value}`;
  }
  return `p${raw || '2'}`;
}

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

function buildParentLookup(graphComponents) {
  const parentLookup = {};

  graphComponents.forEach(component => {
    (component?.Dependencies || []).forEach(dep => {
      const type = getField(dep, ['type', 'dependency_type', 'relationship', 'relation_type']);
      if (type !== 'parent-child') {
        return;
      }

      const childId = getField(dep, ['issue_id', 'IssueID', 'issueId', 'issue']);
      const parentId = getField(dep, [
        'depends_on_id',
        'DependsOnID',
        'dependsOnId',
        'depends_on',
        'dependsOn',
        'to_id',
        'ToID',
        'target_id'
      ]);

      if (childId && parentId) {
        parentLookup[childId] = parentId;
      }
    });
  });

  return parentLookup;
}

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

    issues.forEach(issue => {
      const normalizedIssue = normalizeIssue(issue);
      if (!normalizedIssue) return;

      if (normalizedIssue.status === 'closed') {
        closedIssues.push(normalizedIssue);
      } else {
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

    return {
      type: 'list',
      command,
      header: `Found ${openIssues.length} issue${openIssues.length !== 1 ? 's' : ''}`,
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
