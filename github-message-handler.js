const { convertBeadsItemToGitHubIssue, checkGitHubIssueStatus } = require('./github-converter');
const { assignCopilotToIssue } = require('./github-copilot');
const { getGitHubSession, detectGitHubRepo } = require('./github-auth');
const { handleAssignToCopilotMessage, getCopilotAssignees } = require('./assign-copilot-handler');
const { validateIssueId, validateIssueIds } = require('./validate-issue-id');

/**
 * Get GitHub auth session and repo info for the workspace.
 * @param {import('vscode')} vscode - VS Code API
 * @param {string} workspacePath - Workspace root path
 * @param {object} [authOpts] - Options for getGitHubSession
 * @returns {Promise<{token: string|null, repo: {owner: string, repo: string}|null}>}
 */
async function resolveGitHubContext(vscode, workspacePath, authOpts = {}) {
  const [session, repo] = await Promise.all([
    getGitHubSession(vscode, authOpts),
    workspacePath ? detectGitHubRepo(workspacePath) : Promise.resolve(null)
  ]);
  return { token: session ? session.token : null, repo };
}

/**
 * Handle GitHub info request.
 * @param {import('vscode')} vscode - VS Code API
 * @param {import('vscode').WebviewView} webviewView - Webview to post message to
 * @param {object} data - Incoming message data
 * @returns {Promise<void>}
 */
async function handleGetGitHubInfoMessage(vscode, webviewView, data) {
  const wsFolders = vscode.workspace.workspaceFolders;
  const workspacePath = wsFolders ? wsFolders[0].uri.fsPath : '';
  const silent = data.silent !== false;
  const [session, repo] = await Promise.all([
    getGitHubSession(vscode, { createIfNone: !silent, silent }),
    workspacePath ? detectGitHubRepo(workspacePath) : Promise.resolve(null)
  ]);
  const copilotAssignees = getCopilotAssignees(vscode);
  webviewView.webview.postMessage({
    type: 'githubInfo',
    authenticated: !!session,
    account: session ? session.account : null,
    repo: repo ? { owner: repo.owner, repo: repo.repo, remote: repo.remote } : null,
    copilotAssignees
  });
}

/**
 * Handle GitHub issue conversion request.
 * @param {import('vscode')} vscode - VS Code API
 * @param {import('vscode').WebviewView} webviewView - Webview to post message to
 * @param {object} data - Incoming message data
 * @param {object} provider - Beads webview provider with command executor
 * @returns {Promise<void>}
 */
async function handleConvertToGitHubMessage(vscode, webviewView, data, provider) {
  const wsFolders = vscode.workspace.workspaceFolders;
  if (!wsFolders || wsFolders.length === 0) {
    webviewView.webview.postMessage({ type: 'githubConversionResult', success: false, error: 'An open workspace is required to convert items to GitHub issues.', commandKey: data.commandKey });
    return;
  }
  const workspacePath = wsFolders[0].uri.fsPath;
  try {
    validateIssueId(data.issueId, 'issueId');
    const { token, repo } = await resolveGitHubContext(vscode, workspacePath, { createIfNone: true });
    if (!repo) {
      webviewView.webview.postMessage({ type: 'githubConversionResult', success: false, error: 'GitHub repository not detected. Ensure your workspace has a GitHub remote.', commandKey: data.commandKey });
      return;
    }
    const result = await provider._executeBdCommand(`list --id ${data.issueId} --json`);
    if (!result.success) {
      webviewView.webview.postMessage({ type: 'githubConversionResult', success: false, error: `Failed to fetch issue: ${result.output}`, commandKey: data.commandKey });
      return;
    }
    const issues = JSON.parse(result.output);
    if (!issues || issues.length === 0) {
      webviewView.webview.postMessage({ type: 'githubConversionResult', success: false, error: `Issue ${data.issueId} not found`, commandKey: data.commandKey });
      return;
    }

    const ghResult = await convertBeadsItemToGitHubIssue(issues[0], { token, owner: repo.owner, repo: repo.repo });
    webviewView.webview.postMessage({ type: 'githubConversionResult', success: true, url: ghResult.url, number: ghResult.number, issueId: data.issueId, commandKey: data.commandKey });
  } catch (error) {
    webviewView.webview.postMessage({ type: 'githubConversionResult', success: false, error: error.message || 'Unknown error occurred', commandKey: data.commandKey });
  }
}

/**
 * Handle GitHub agent status check.
 * @param {import('vscode')} vscode - VS Code API
 * @param {import('vscode').WebviewView} webviewView - Webview to post message to
 * @param {object} data - Incoming message data
 * @returns {Promise<void>}
 */
async function handleCheckAgentStatusMessage(vscode, webviewView, data) {
  const cwdPath = (vscode.workspace.workspaceFolders || [])[0]?.uri.fsPath;
  try {
    const { token, repo } = await resolveGitHubContext(vscode, cwdPath, { silent: true });
    const statusResult = await checkGitHubIssueStatus(data.issueNumber, { token, owner: repo?.owner, repo: repo?.repo });
    webviewView.webview.postMessage({
      type: 'agentStatusResult', beadsItemId: data.beadsItemId,
      issueState: statusResult.issueState, pr: statusResult.pr, success: true
    });
  } catch (error) {
    webviewView.webview.postMessage({
      type: 'agentStatusResult', beadsItemId: data.beadsItemId,
      success: false, error: error.message || 'Failed to check agent status'
    });
  }
}

/**
 * Handle dispatching a parallel phase to GitHub.
 * @param {import('vscode')} vscode - VS Code API
 * @param {import('vscode').WebviewView} webviewView - Webview to post message to
 * @param {object} data - Incoming message data
 * @param {object} provider - Beads webview provider with command executor
 * @returns {Promise<void>}
 */
async function handleParallelPhaseDispatchMessage(vscode, webviewView, data, provider) {
  try {
    const wsFolders = vscode.workspace.workspaceFolders;
    if (!wsFolders || wsFolders.length === 0) {
      webviewView.webview.postMessage({ type: 'parallelPhaseDispatchError', success: false, error: 'An open workspace is required to dispatch a phase to GitHub Copilot.' });
      return;
    }
    const workspacePath = wsFolders[0].uri.fsPath;
    const { token: ghToken, repo: ghRepo } = await resolveGitHubContext(vscode, workspacePath, { createIfNone: true });
    if (!ghRepo) {
      webviewView.webview.postMessage({ type: 'parallelPhaseDispatchError', success: false, error: 'GitHub repository not detected. Ensure your workspace has a GitHub remote.' });
      return;
    }
    const phaseIndex = Number.isFinite(data.phaseIndex) ? data.phaseIndex : null;
    const issueIds = Array.isArray(data.issueIds) ? data.issueIds.map(String).map(s => s.trim()).filter(Boolean) : [];
    validateIssueIds(issueIds, 'issueId');
    const uniqueIssueIds = [...new Set(issueIds)];
    const copilotAssignees = getCopilotAssignees(vscode);
    const plannedAssignments = uniqueIssueIds.map((id, idx) => {
      const assignee = copilotAssignees.length > 0 ? copilotAssignees[idx % copilotAssignees.length] : null;
      return { issueId: id, assignee };
    });
    webviewView.webview.postMessage({
      type: 'parallelPhaseDispatchStarted',
      phaseIndex,
      total: plannedAssignments.length,
      assignments: plannedAssignments
    });
    const results = [];
    for (let idx = 0; idx < plannedAssignments.length; idx++) {
      const { issueId, assignee } = plannedAssignments[idx];
      webviewView.webview.postMessage({
        type: 'parallelPhaseDispatchProgress',
        phaseIndex,
        issueId,
        assignee,
        index: idx,
        total: plannedAssignments.length,
        state: 'creating'
      });
      try {
        const bdResult = await provider._executeBdCommand(`list --id ${issueId} --json`);
        if (!bdResult.success) {
          throw new Error(`Failed to fetch issue: ${bdResult.output}`);
        }
        const issues = JSON.parse(bdResult.output);
        if (!issues || issues.length === 0) {
          throw new Error(`Issue ${issueId} not found`);
        }
        const item = issues[0];
        let ghResult;
        let assigned = !!assignee;
        let warning = null;
        try {
          ghResult = await convertBeadsItemToGitHubIssue(item, {
            token: ghToken, owner: ghRepo.owner, repo: ghRepo.repo,
            assignee: assignee || undefined
          });
        } catch (error) {
          const message = error && error.message ? error.message : String(error);
          if (assignee && /assignee|Could not resolve|Invalid assignee|Validation Failed/i.test(message)) {
            warning = `Created issue without assigning ${assignee}: ${message}`;
            assigned = false;
            ghResult = await convertBeadsItemToGitHubIssue(item, {
              token: ghToken, owner: ghRepo.owner, repo: ghRepo.repo
            });
          } else {
            throw error;
          }
        }
        results.push({
          issueId,
          assignee,
          url: ghResult.url,
          number: ghResult.number,
          assigned,
          warning,
          success: true
        });
        webviewView.webview.postMessage({
          type: 'parallelPhaseDispatchProgress',
          phaseIndex,
          issueId,
          assignee,
          index: idx,
          total: plannedAssignments.length,
          state: 'created',
          url: ghResult.url,
          number: ghResult.number,
          assigned,
          warning
        });
      } catch (error) {
        const message = error && error.message ? error.message : String(error);
        results.push({ issueId, assignee, success: false, error: message });
        webviewView.webview.postMessage({
          type: 'parallelPhaseDispatchProgress',
          phaseIndex,
          issueId,
          assignee,
          index: idx,
          total: plannedAssignments.length,
          state: 'failed',
          error: message
        });
      }
    }
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    webviewView.webview.postMessage({
      type: 'parallelPhaseDispatchComplete',
      phaseIndex,
      successCount,
      failureCount,
      results
    });
  } catch (e) {
    webviewView.webview.postMessage({ type: 'parallelPhaseDispatchError', success: false, error: e.message });
  }
}

/**
 * Handle Copilot assignment requests.
 * @param {import('vscode')} vscode - VS Code API
 * @param {import('vscode').WebviewView} webviewView - Webview to post message to
 * @param {object} data - Incoming message data
 * @param {object} provider - Beads webview provider with command executor
 * @returns {Promise<void>}
 */
async function handleAssignToCopilotMessageWrapper(vscode, webviewView, data, provider) {
  await handleAssignToCopilotMessage(data, {
    provider,
    webviewView,
    vscode,
    getCopilotAssignees,
    convertBeadsItemToGitHubIssue,
    detectGitHubRepo,
    getGitHubSession,
    assignCopilotToIssue
  });
}

module.exports = {
  handleGetGitHubInfoMessage,
  handleConvertToGitHubMessage,
  handleCheckAgentStatusMessage,
  handleParallelPhaseDispatchMessage,
  handleAssignToCopilotMessageWrapper
};
