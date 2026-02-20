/**
 * Handle assignToCopilot messages by converting a beads item to a GitHub issue
 * and dispatching the GitHub Copilot coding agent.
 *
 * @param {object} data - Message payload from the webview
 * @param {object} deps - Dependencies required for execution
 * @param {object} deps.provider - Extension provider with bd helpers
 * @param {object} deps.webviewView - Webview view instance
 * @param {import('vscode')} deps.vscode - VS Code API
 * @param {Function} deps.getCopilotAssignees - Function to read Copilot assignees
 * @param {Function} deps.convertBeadsItemToGitHubIssue - Converter helper
 * @param {Function} deps.detectGitHubRepo - Repo detection helper
 * @param {Function} deps.getGitHubSession - GitHub auth helper
 * @param {Function} deps.assignCopilotToIssue - Copilot assignment helper
 * @returns {Promise<void>}
 */
async function handleAssignToCopilotMessage(
  data,
  {
    provider,
    webviewView,
    vscode,
    getCopilotAssignees,
    convertBeadsItemToGitHubIssue,
    detectGitHubRepo,
    getGitHubSession,
    assignCopilotToIssue
  }
) {
  const wsFolders = vscode.workspace.workspaceFolders;
  if (!wsFolders || wsFolders.length === 0) {
    webviewView.webview.postMessage({
      type: 'copilotDispatchResult',
      success: false,
      error: 'An open workspace is required to assign GitHub Copilot.',
      commandKey: data.commandKey,
      issueId: data.issueId
    });
    return;
  }

  const workspacePath = wsFolders[0].uri.fsPath;
  const copilotAssignees = getCopilotAssignees(vscode);
  const requestedAgent = Array.isArray(copilotAssignees) && copilotAssignees.length > 0
    ? copilotAssignees[0]
    : 'github-copilot';

  let ghResult = null;
  try {
    const result = await provider._executeBdCommand(`list --id ${data.issueId} --json`);
    if (!result.success) {
      webviewView.webview.postMessage({
        type: 'copilotDispatchResult',
        success: false,
        error: `Failed to fetch issue: ${result.output}`,
        commandKey: data.commandKey,
        issueId: data.issueId
      });
      return;
    }

    let issue;
    try {
      const issues = JSON.parse(result.output);
      issue = issues && issues[0];
    } catch (error) {
      webviewView.webview.postMessage({
        type: 'copilotDispatchResult',
        success: false,
        error: `Unable to parse issue details: ${error.message}`,
        commandKey: data.commandKey,
        issueId: data.issueId
      });
      return;
    }

    if (!issue) {
      webviewView.webview.postMessage({
        type: 'copilotDispatchResult',
        success: false,
        error: `Issue ${data.issueId} not found`,
        commandKey: data.commandKey,
        issueId: data.issueId
      });
      return;
    }

    const repo = await detectGitHubRepo(workspacePath);
    if (!repo) {
      webviewView.webview.postMessage({
        type: 'copilotDispatchResult',
        success: false,
        error: 'GitHub repository not detected. Configure a GitHub remote and try again.',
        commandKey: data.commandKey,
        issueId: data.issueId
      });
      return;
    }

    const session = await getGitHubSession(vscode, { createIfNone: true });
    const token = session ? session.token : null;

    ghResult = await convertBeadsItemToGitHubIssue(
      issue,
      workspacePath,
      requestedAgent ? { assignee: requestedAgent } : undefined
    );

    if (!ghResult || !ghResult.number) {
      throw new Error('GitHub issue number missing from conversion result.');
    }

    await assignCopilotToIssue({
      owner: repo.owner,
      repo: repo.repo,
      issueNumber: ghResult.number,
      agent: requestedAgent,
      token,
      cwd: workspacePath
    });

    webviewView.webview.postMessage({
      type: 'copilotDispatchResult',
      success: true,
      issueId: data.issueId,
      url: ghResult.url,
      number: ghResult.number,
      assignedTo: requestedAgent,
      commandKey: data.commandKey
    });
  } catch (error) {
    webviewView.webview.postMessage({
      type: 'copilotDispatchResult',
      success: false,
      error: error.message || 'Failed to assign Copilot',
      commandKey: data.commandKey,
      issueId: data.issueId,
      url: ghResult?.url,
      number: ghResult?.number
    });
  }
}

/**
 * Read and validate the copilotAssignees setting.
 * @param {import('vscode')} vscode - VS Code API
 * @returns {string[]}
 */
function getCopilotAssignees(vscode) {
  const raw = vscode.workspace.getConfiguration('beads-ui.github').get('copilotAssignees', ['github-copilot']);
  return Array.isArray(raw)
    ? raw.map(String).map(s => s.trim()).filter(Boolean)
    : ['github-copilot'];
}

module.exports = {
  handleAssignToCopilotMessage,
  getCopilotAssignees
};
