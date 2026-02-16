/**
 * Safely extract a field value from an object using multiple candidate keys.
 * @param {object} obj - Source object.
 * @param {Array<string>} keys - Keys to test in order.
 * @returns {any} Matching value or undefined.
 */
function getField(obj, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
      return obj[key];
    }
  }
  return undefined;
}

/** @type {string[]} Candidate keys for the source/issue ID of a dependency. */
const DEP_ISSUE_KEYS = ['issue_id', 'IssueID', 'issueId', 'issue'];

/** @type {string[]} Candidate keys for the target/depends-on ID of a dependency. */
const DEP_TARGET_KEYS = [
  'depends_on_id', 'DependsOnID', 'dependsOnId',
  'depends_on', 'dependsOn',
  'to_id', 'ToID', 'target_id'
];

/** @type {string[]} Candidate keys for the from-side ID used in blocking graphs. */
const DEP_FROM_KEYS = ['from_id', 'FromID', 'fromId', 'issue_id', 'IssueID', 'issueId'];

/** @type {string[]} Candidate keys for the to-side ID used in blocking graphs. */
const DEP_TO_KEYS = ['to_id', 'ToID', 'toId', 'depends_on_id', 'DependsOnID', 'dependsOnId'];

/** @type {string[]} Candidate keys for the dependency relationship type. */
const DEP_TYPE_KEYS = ['type', 'dependency_type', 'relationship', 'relation_type'];

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
 * Check whether a status string represents a completed state.
 * @param {string} status - Issue status value.
 * @returns {boolean}
 */
function isClosedStatus(status) {
  return status === 'closed' || status === 'done';
}

/**
 * Map an issue status string to a single-character icon.
 * @param {string} status - Issue status value.
 * @returns {string} Status icon character.
 */
function getStatusIcon(status) {
  switch (status) {
    case 'open': return '○';
    case 'in_progress': return '◐';
    case 'blocked': return '●';
    case 'closed': return '✓';
    case 'deferred': return '❄';
    default: return '○';
  }
}

module.exports = {
  getField,
  getStatusIcon,
  isClosedStatus,
  buildIssueMap,
  DEP_ISSUE_KEYS,
  DEP_TARGET_KEYS,
  DEP_FROM_KEYS,
  DEP_TO_KEYS,
  DEP_TYPE_KEYS
};
