export const createAssigneeChangeHandler = ({
  safeShellArg,
  beginCommandProgress,
  completeCommandProgress,
  outputRef,
  runCommand,
  vscode
}) => (issueId, newAssignee) => new Promise((resolve, reject) => {
  const trimmedAssignee = newAssignee.trim();
  const assigneeArg = trimmedAssignee ? `--assignee ${safeShellArg(newAssignee)}` : '--assignee ""';
  const command = `update ${issueId} ${assigneeArg}`;
  const successMsg = trimmedAssignee
    ? `Assigned ${issueId} to ${newAssignee}`
    : `Cleared assignee for ${issueId}`;

  beginCommandProgress(command, 'inline');

  const messageHandler = (event) => {
    const message = event.data;
    if (message.type === 'inlineActionResult' && message.command === command) {
      globalThis.removeEventListener('message', messageHandler);
      if (message.success) {
        resolve();
        setTimeout(() => {
          const currentOutput = outputRef.current;
          if (typeof currentOutput === 'object' && currentOutput.command) {
            runCommand(currentOutput.command);
          }
        }, 500);
      } else {
        reject(new Error(message.output || 'Failed to update assignee'));
      }
    }
  };

  globalThis.addEventListener('message', messageHandler);
  vscode.postMessage({
    type: 'executeCommand',
    command,
    isInlineAction: true,
    successMessage: successMsg
  });

  setTimeout(() => {
    globalThis.removeEventListener('message', messageHandler);
    completeCommandProgress(command);
    reject(new Error('Timeout updating assignee'));
  }, 5000);
});
