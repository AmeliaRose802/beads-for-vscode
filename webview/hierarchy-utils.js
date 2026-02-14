const { getField, buildIssueMap, DEP_ISSUE_KEYS, DEP_TARGET_KEYS, DEP_TYPE_KEYS } = require('./field-utils');

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
 * Normalize dependency edges into a simple list.
 * @param {Array} components - Graph components containing Dependencies.
 * @returns {Array<{issueId: string, dependsOnId: string, type: string}>} Edge list.
 */
function buildEdgeList(components) {
  const edges = [];

  components.forEach(component => {
    (component?.Dependencies || []).forEach(dep => {
      const issueId = getField(dep, DEP_ISSUE_KEYS);
      const dependsOnId = getField(dep, DEP_TARGET_KEYS);
      const rawType = getField(dep, DEP_TYPE_KEYS) || 'related';
      const type = rawType === 'relates-to' ? 'related' : rawType;

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
  const alreadyVisited = context.visited.has(issueId);

  // Categorize relationship types
  const nonBlockingRelationTypes = new Set(['parent-child', 'related']);
  const blockingRelationTypes = new Set(['blocks', 'blocked-by']);

  // A back-reference is when we revisit a node via a non-blocking relationship.
  // This is expected and normal for structural (parent-child) and informational (related) links.
  const isBackReference = alreadyVisited && nonBlockingRelationTypes.has(context.relationType);
  
  // A cycle is when we revisit a node via a blocking relationship (blocks/blocked-by).
  // This indicates a true dependency cycle that prevents work from progressing.
  // Important: Only blocking relationships can form true cycles.
  const isCycle = alreadyVisited && blockingRelationTypes.has(context.relationType);

  const node = {
    id: issue.id,
    title: issue.title,
    status: issue.status,
    priority: issue.priority,
    issue_type: issue.issue_type,
    relationType: context.relationType,
    direction: context.direction,
    isCycle,
    isBackReference,
    children: []
  };

  if (alreadyVisited) {
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

/**
 * Filter a hierarchy tree to only include nodes matching the enabled relationship types.
 * The root node is always kept. Children whose relationType is not in the enabled set
 * are pruned, along with their subtrees.
 *
 * @param {object} tree - The dependency tree root node from buildHierarchyModel.
 * @param {Set<string>} enabledTypes - Set of relationship type strings to keep (e.g. 'blocks', 'parent-child').
 * @returns {object} A new tree with filtered children.
 */
function filterHierarchyTree(tree, enabledTypes) {
  if (!tree) return tree;
  if (!enabledTypes || enabledTypes.size === 0) {
    return { ...tree, children: [] };
  }

  const filteredChildren = (tree.children || [])
    .filter(child => !child.relationType || enabledTypes.has(child.relationType))
    .map(child => filterHierarchyTree(child, enabledTypes));

  return { ...tree, children: filteredChildren };
}

/**
 * Count total descendant nodes in a subtree.
 * @param {object} node - Tree node with children array.
 * @returns {number} Total descendant count.
 */
function countDescendants(node) {
  if (!node || !node.children || node.children.length === 0) return 0;
  return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
}

module.exports = { buildHierarchyModel, filterHierarchyTree, countDescendants };
