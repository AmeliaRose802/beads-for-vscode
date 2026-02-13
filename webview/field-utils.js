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

module.exports = { getField, getStatusIcon };
