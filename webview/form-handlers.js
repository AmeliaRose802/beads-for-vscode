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

/**
 * Create an async assignee change handler that uses vscode messaging.
 * @param {object} vscode - The VS Code API object
 * @param {object} output - Current output state for refreshing list
 * @param {Function} runCommand - Function to re-run current list command
 * @returns {Function} Handler function (issueId, newAssignee) => Promise
 */
function createAssigneeChangeHandler(vscode, output, runCommand) {
  return function handleAssigneeChange(issueId, newAssignee) {
    return new Promise((resolve, reject) => {
      const assigneeArg = newAssignee.trim() ? `--assignee "${newAssignee}"` : '--assignee ""';
      const command = `update ${issueId} ${assigneeArg}`;
      const successMsg = newAssignee.trim() 
        ? `Assigned ${issueId} to ${newAssignee}`
        : `Cleared assignee for ${issueId}`;
      
      // Execute the command
      vscode.postMessage({
        type: 'executeCommand',
        command: command,
        isInlineAction: true,
        successMessage: successMsg
      });

      // Listen for the response
      // eslint-disable-next-line no-undef
      const handler = (event) => {
        const message = event.data;
        if (message.type === 'inlineActionResult' && message.command === command) {
          // eslint-disable-next-line no-undef
          window.removeEventListener('message', handler);
          if (message.success) {
            resolve();
            // Refresh the list after a short delay
            setTimeout(() => {
              if (typeof output === 'object' && output.command) {
                runCommand(output.command);
              }
            }, 500);
          } else {
            reject(new Error(message.output || 'Failed to update assignee'));
          }
        }
      };

      // eslint-disable-next-line no-undef
      window.addEventListener('message', handler);

      // Timeout after 5 seconds
      setTimeout(() => {
        // eslint-disable-next-line no-undef
        window.removeEventListener('message', handler);
        reject(new Error('Timeout updating assignee'));
      }, 5000);
    });
  };
}

module.exports = { buildCreateCommand, buildUpdateCommand, createAssigneeChangeHandler };
