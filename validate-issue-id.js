/**
 * Validate beads issue IDs to prevent malformed arguments in bd commands.
 * 
 * Issue IDs must follow the pattern: prefix-suffix where:
 * - prefix: one or more alphanumeric characters or underscores
 * - suffix: one or more alphanumeric characters
 * 
 * Examples of valid IDs: beads_ui-f27t, bd-123, my_project-abc
 * Examples of invalid IDs: "bd 123" (space), "../etc" (path traversal), "" (empty)
 */

/**
 * Regular expression pattern for valid beads issue IDs.
 * Matches: alphanumeric/underscore prefix, hyphen, alphanumeric suffix
 */
const ISSUE_ID_PATTERN = /^[a-zA-Z0-9_]+-[a-zA-Z0-9]+$/;

/**
 * Check if an issue ID matches the expected format.
 * @param {string} id - The issue ID to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidIssueId(id) {
  if (typeof id !== 'string') {
    return false;
  }
  return ISSUE_ID_PATTERN.test(id);
}

/**
 * Validate an issue ID and throw an error if invalid.
 * @param {string} id - The issue ID to validate
 * @param {string} [context] - Optional context for error message (e.g., 'issueId', 'epicA')
 * @throws {Error} If the ID is invalid
 */
function validateIssueId(id, context = 'Issue ID') {
  if (!isValidIssueId(id)) {
    throw new Error(
      `Invalid ${context}: "${id}". ` +
      'IDs must match pattern: prefix-suffix (e.g., "beads_ui-abc123")'
    );
  }
}

/**
 * Validate multiple issue IDs at once.
 * @param {string[]} ids - Array of issue IDs to validate
 * @param {string} [context] - Optional context for error messages
 * @throws {Error} If any ID is invalid
 */
function validateIssueIds(ids, context = 'Issue ID') {
  if (!Array.isArray(ids)) {
    throw new Error(`Expected array of IDs, got ${typeof ids}`);
  }
  for (const id of ids) {
    validateIssueId(id, context);
  }
}

module.exports = {
  ISSUE_ID_PATTERN,
  isValidIssueId,
  validateIssueId,
  validateIssueIds
};
