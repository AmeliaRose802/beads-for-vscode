/**
 * Escapes a string for safe use in a shell command.
 * Prevents command injection by escaping shell metacharacters.
 * @param {string} str - The string to escape
 * @returns {string} The escaped string safe for shell execution
 */
function escapeShellArg(str) {
  if (typeof str !== 'string') return '';
  
  // On Windows, use double quotes and escape internal quotes and backslashes
  if (process.platform === 'win32') {
    // Replace backslashes and double quotes with escaped versions
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
  }
  
  // On Unix-like systems, escape single quotes and wrap in single quotes
  // This is the safest approach: replace ' with '\'' (end quote, escaped quote, start quote)
  return str.replace(/'/g, "'\\''");
}

/**
 * Wraps an escaped string in the appropriate quotes for the platform.
 * @param {string} str - The string to quote (should already be escaped)
 * @returns {string} The quoted string
 */
function quoteShellArg(str) {
  if (process.platform === 'win32') {
    return `"${str}"`;
  }
  return `'${str}'`;
}

/**
 * Safely escapes and quotes a string for shell command usage.
 * @param {string} str - The string to make safe
 * @returns {string} The escaped and quoted string
 */
function safeShellArg(str) {
  return quoteShellArg(escapeShellArg(str));
}

/**
 * Build a bd create command string from form state.
 * @param {{ title: string, type: string, priority: string, description: string, parentId: string, blocksId: string, relatedId: string, currentFile: string }} state
 * @returns {string|null} The command string, or null if title is empty
 */
function buildCreateCommand(state) {
  const { title, type, priority, description, parentId, blocksId, relatedId, currentFile } = state;

  if (!title.trim()) return null;

  let command = `create --title ${safeShellArg(title)} -t ${type} -p ${priority}`;
  if (description.trim()) {
    command += ` -d ${safeShellArg(description)}`;
  }
  if (currentFile) {
    command += ` --notes ${safeShellArg(`File: ${currentFile}`)}`;
  }
  if (parentId.trim()) {
    command += ` --deps parent:${parentId.trim()}`;
  }
  if (blocksId.trim()) {
    command += ` --deps blocks:${blocksId.trim()}`;
  }
  if (relatedId.trim()) {
    command += ` --deps related:${relatedId.trim()}`;
  }

  return command;
}

/**
 * Build a bd update command string from form state.
 * @param {{ issueId: string, title: string, type: string, priority: string, description: string, status: string }} state
 * @returns {string|null} The command string, or null if title is empty
 */
function buildUpdateCommand(state) {
  const { issueId, title, type, priority, description, status } = state;

  if (!title.trim()) return null;

  let command = `update ${issueId}`;
  command += ` --title ${safeShellArg(title)}`;
  command += ` --type ${type}`;
  command += ` --priority ${priority}`;
  command += ` --status ${status}`;

  if (description.trim()) {
    command += ` --description ${safeShellArg(description)}`;
  }

  return command;
}

module.exports = { buildCreateCommand, buildUpdateCommand, escapeShellArg, safeShellArg };
