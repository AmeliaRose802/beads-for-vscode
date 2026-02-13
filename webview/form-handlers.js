/**
 * Build a bd create command string from form state.
 * @param {{ title: string, type: string, priority: string, description: string, parentId: string, blocksId: string, relatedId: string, currentFile: string }} state
 * @returns {string|null} The command string, or null if title is empty
 */
function buildCreateCommand(state) {
  const { title, type, priority, description, parentId, blocksId, relatedId, currentFile } = state;

  if (!title.trim()) return null;

  let command = `create --title "${title}" -t ${type} -p ${priority}`;
  if (description.trim()) {
    command += ` -d "${description}"`;
  }
  if (currentFile) {
    command += ` --notes "File: ${currentFile}"`;
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
  command += ` --title "${title}"`;
  command += ` --type ${type}`;
  command += ` --priority ${priority}`;
  command += ` --status ${status}`;

  if (description.trim()) {
    command += ` --description "${description}"`;
  }

  return command;
}

module.exports = { buildCreateCommand, buildUpdateCommand };
