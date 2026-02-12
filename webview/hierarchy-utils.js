const { getField } = require('./field-utils');

/**
 * Build the hierarchy model (parent chain + dependency tree) for an issue.
 *
 * @param {string} issueId - The issue to build hierarchy for.
 * @param {Array} components - Graph data from `bd graph --all --json`.
 * @returns {{ issue: object, parentChain: Array<object>, tree: object }} Hierarchy model.
 */
function buildHierarchyModel(issueId, components) {
  if (!issueId) {
    throw new Error('issueId is required to build hierarchy data');
  }

  const graphComponents = Array.isArray(components) ? components : [];

  const issueMap = buildIssueMap(graphComponents);
  const edges = buildEdgeList(graphComponents);

  const issue = issueMap[issueId] || createFallbackIssue(issueId);
  const parentChain = buildParentChain(issueId, edges, issueMap);
  const tree = buildDependencyTree(issueId, edges, issueMap);

  return { issue, parentChain, tree };
}

/**
 * Build a map of issue id to issue details from graph components.
 * @param {Array} components - Graph data components.
 * @returns {Record<string, object>} Issue lookup table.
 */
function buildIssueMap(components) {
  const map = {};

  components.forEach(component => {
    if (component && component.IssueMap && typeof component.IssueMap === 'object') {
      Object.assign(map, component.IssueMap);
    }

    (component?.Issues || []).forEach(issue => {
      if (issue && issue.id) {
        map[issue.id] = issue;
      }
    });
  });

  return map;
}

/**
 * Normalize dependency edges into a simple list.
 * @param {Array} components - Graph components containing Dependencies.
 * @returns {Array<{issueId: string, dependsOnId: string, type: string}>} Edge list.
 */
function buildEdgeList(components) {
  const edges = [];

  components.forEach(component => {
    (component?.Dependencies || []).forEach(dep => {
      const issueId = getField(dep, ['issue_id', 'IssueID', 'issueId', 'issue']);
      const dependsOnId = getField(dep, [
        'depends_on_id',
        'DependsOnID',
        'dependsOnId',
        'depends_on',
        'dependsOn',
        'to_id',
        'ToID',
        'target_id'
      ]);
      const type = getField(dep, ['type', 'dependency_type', 'relationship', 'relation_type']) || 'related';

      if (issueId && dependsOnId) {
        edges.push({ issueId, dependsOnId, type });
      }
    });
  });

  return edges;
}

/**
 * Build the parent chain from the issue up to the root ancestor.
 * @param {string} issueId - Starting issue id.
 * @param {Array} edges - Normalized dependency edges.
 * @param {Record<string, object>} issueMap - Issue lookup table.
 * @returns {Array<object>} Ordered ancestor list ending with the current issue.
 */
function buildParentChain(issueId, edges, issueMap) {
  const visited = new Set();
  const ancestors = [];
  let currentId = issueId;

  while (!visited.has(currentId)) {
    visited.add(currentId);
    const parentEdge = edges.find(edge => edge.issueId === currentId && edge.type === 'parent-child');

    if (!parentEdge || !parentEdge.dependsOnId || visited.has(parentEdge.dependsOnId)) {
      break;
    }

    const parentId = parentEdge.dependsOnId;
    const parentIssue = issueMap[parentId] || createFallbackIssue(parentId);
    ancestors.push(parentIssue);
    currentId = parentId;
  }

  const orderedAncestors = ancestors.reverse();
  const currentIssue = issueMap[issueId] || createFallbackIssue(issueId);
  return [...orderedAncestors, currentIssue];
}

/**
 * Recursively build the dependency tree for an issue.
 * @param {string} issueId - Current issue id.
 * @param {Array} edges - Normalized dependency edges.
 * @param {Record<string, object>} issueMap - Issue lookup table.
 * @param {{visited: Set<string>, relationType: string | null, direction: string | null}} context - Traversal context.
 * @returns {object} Tree node representing this issue and its relations.
 */
function buildDependencyTree(issueId, edges, issueMap, context = { visited: new Set(), relationType: null, direction: null }) {
  const issue = issueMap[issueId] || createFallbackIssue(issueId);
  const isCycle = context.visited.has(issueId);

  const node = {
    id: issue.id,
    title: issue.title,
    status: issue.status,
    priority: issue.priority,
    issue_type: issue.issue_type,
    relationType: context.relationType,
    direction: context.direction,
    isCycle,
    children: []
  };

  if (isCycle) {
    return node;
  }

  const nextVisited = new Set(context.visited);
  nextVisited.add(issueId);

  const outgoing = edges.filter(edge => edge.issueId === issueId);
  const incoming = edges.filter(edge => edge.dependsOnId === issueId);

  const children = [];

  outgoing.forEach(edge => {
    const direction = edge.type === 'parent-child' ? 'incoming' : 'outgoing';
    children.push(
      buildDependencyTree(edge.dependsOnId, edges, issueMap, {
        visited: nextVisited,
        relationType: edge.type,
        direction
      })
    );
  });

  incoming.forEach(edge => {
    const direction = edge.type === 'parent-child' ? 'incoming' : 'outgoing';
    children.push(
      buildDependencyTree(edge.issueId, edges, issueMap, {
        visited: nextVisited,
        relationType: edge.type,
        direction
      })
    );
  });

  node.children = children;
  return node;
}

/**
 * Create a fallback issue when metadata is missing.
 * @param {string} issueId - Issue identifier.
 * @returns {{id: string, title: string, status: string, priority: string | number, issue_type: string}} Basic issue object.
 */
function createFallbackIssue(issueId) {
  return {
    id: issueId,
    title: issueId,
    status: 'unknown',
    priority: 'unknown',
    issue_type: 'task'
  };
}

module.exports = { buildHierarchyModel };
