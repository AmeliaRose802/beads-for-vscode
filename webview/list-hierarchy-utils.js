const MAX_INDENT_DEPTH = 4;

/**
 * Organize a flat issue list into parent-child order with depth tracking.
 * Parents appear before their children; children are grouped under their parent.
 * Issues whose parent is not in the list remain at the root level.
 * @param {Array} issues - Flat array of issue objects with optional parent_id
 * @returns {Array<{issue: object, depth: number}>} Ordered list with depth info
 */
function buildFlatHierarchy(issues) {
  if (!issues || issues.length === 0) return [];

  const issueMap = new Map();
  const childrenMap = new Map();
  const rootIds = [];

  issues.forEach(issue => issueMap.set(issue.id, issue));

  issues.forEach(issue => {
    const parentId = issue.parent_id;
    if (parentId && issueMap.has(parentId)) {
      if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
      childrenMap.get(parentId).push(issue.id);
    } else {
      rootIds.push(issue.id);
    }
  });

  const result = [];
  const addWithChildren = (id, depth) => {
    const issue = issueMap.get(id);
    if (!issue) return;
    result.push({ issue, depth: Math.min(depth, MAX_INDENT_DEPTH) });
    const children = childrenMap.get(id);
    if (children) {
      children.forEach(childId => addWithChildren(childId, depth + 1));
    }
  };

  rootIds.forEach(id => addWithChildren(id, 0));
  return result;
}

module.exports = { buildFlatHierarchy, MAX_INDENT_DEPTH };
