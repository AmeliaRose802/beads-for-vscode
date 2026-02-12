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

module.exports = { getField };
