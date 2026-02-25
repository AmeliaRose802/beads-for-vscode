const path = require('path');
const fs = require('fs');

const { getAISuggestions } = require('./ai-suggestions');
const { detectBeadsBackend } = require('./beads-backend');
const { validateIssueId } = require('./validate-issue-id');
const {
  handleGetGitHubInfoMessage,
  handleConvertToGitHubMessage,
  handleCheckAgentStatusMessage,
  handleParallelPhaseDispatchMessage,
  handleAssignToCopilotMessageWrapper,
} = require('./github-message-handler');
const {
  handleGetIntegrationSettingsMessage,
  handleUpdateIntegrationSettingsMessage,
  handleAdoImportMessage,
  handleAdoExportMessage,
} = require('./integration-message-handler');

/**
 * Routes messages from the Beads UI webview to VS Code APIs or bd commands.
 * Keeps UX responsive by centralizing validation, formatting, and side-effects.
 */
/**
 * Handle a message from the webview
 * @param {object} data - The message data from the webview
 * @param {object} context - Context object containing provider methods
 * @param {import('vscode')} vscode - VS Code API
 * @returns {Promise<void>}
 */
async function handleWebviewMessage(data, context, vscode) {
  const { provider, webviewView } = context;
  const postMessage = (payload) => webviewView.webview.postMessage(payload);
  const executeCommand = (command) => provider._executeBdCommand(command);
  try {
    // Dispatch each message type to a focused handler block.
    switch (data.type) {
      case 'executeCommand': {
        // Invalidate cache on modifying commands
        const modifyingCommands = ['create', 'update', 'close', 'reopen', 'link', 'dep'];
        const isModifying = modifyingCommands.some((cmd) => data.command.includes(cmd));
        if (isModifying) {
          provider._invalidateCache();
        }

        const isSingleIssueFetch =
          data.command.includes('list') &&
          data.command.includes('--json') &&
          data.command.includes('--id');

        if (isSingleIssueFetch) {
          // Fetch a single issue by ID for editing
          const result = await executeCommand(data.command);
          try {
            const issues = JSON.parse(result.output);
            if (issues && issues.length > 0) {
              postMessage({ type: 'issueDetails', issue: issues[0] });
            } else {
              postMessage({
                type: 'commandResult',
                command: data.command,
                output: 'Issue not found',
                success: false,
              });
            }
          } catch (error) {
            postMessage({ type: 'commandResult', command: data.command, ...result });
          }
          break;
        }

        const jsonEligibleCommands = ['list', 'ready', 'blocked'];
        const wantsJsonSummary = data.useJSON && jsonEligibleCommands.includes(data.command);

        if (wantsJsonSummary) {
          // Handle list/ready/blocked commands with JSON output directly
          const jsonCommand = `${data.command} --json`;
          const [jsonResult, graphResult] = await Promise.all([
            executeCommand(jsonCommand),
            executeCommand('graph --all --json --allow-stale'),
          ]);
          if (jsonResult.success) {
            postMessage({
              type: 'commandResultJSON',
              command: data.command,
              output: jsonResult.output,
              graphData: graphResult && graphResult.success ? graphResult.output : null,
              graphError: graphResult && !graphResult.success ? graphResult.output : null,
              success: true,
              requestId: data.requestId,
              isBackgroundSync: data.isBackgroundSync,
            });
          } else {
            postMessage({
              type: 'commandResult',
              command: data.command,
              output: jsonResult.output,
              success: false,
              requestId: data.requestId,
              isBackgroundSync: data.isBackgroundSync,
            });
          }
          break;
        }

        // All other commands: execute once, then route response
        const result = await executeCommand(data.command);
        if (data.isInlineAction) {
          postMessage({
            type: 'inlineActionResult',
            command: data.command,
            output: result.output,
            success: result.success,
            successMessage: data.successMessage,
            requestId: data.requestId,
            isBackgroundSync: data.isBackgroundSync,
          });
        } else {
          postMessage({
            type: 'commandResult',
            command: data.command,
            ...result,
            requestId: data.requestId,
            isBackgroundSync: data.isBackgroundSync,
          });
        }
        break;
      }
      case 'getCwd': {
        const wsFolders = vscode.workspace.workspaceFolders;
        postMessage({
          type: 'cwdResult',
          cwd: wsFolders ? wsFolders[0].uri.fsPath : process.cwd(),
        });
        break;
      }
      case 'getCurrentFile': {
        const editor = vscode.window.activeTextEditor;
        let curFile = '';
        if (editor) {
          curFile = vscode.workspace.workspaceFolders
            ? vscode.workspace.asRelativePath(editor.document.uri)
            : editor.document.fileName;
        }
        postMessage({ type: 'currentFileResult', file: curFile });
        break;
      }
      case 'getBeadsStatus': {
        const wsFolders = vscode.workspace.workspaceFolders;
        const workspacePath = wsFolders ? wsFolders[0].uri.fsPath : '';
        const beadsDir = workspacePath ? path.join(workspacePath, '.beads') : '';
        const initialized = !!(beadsDir && fs.existsSync(beadsDir));
        const backend = workspacePath ? detectBeadsBackend(workspacePath).backend : 'unknown';
        postMessage({
          type: 'beadsStatus',
          hasWorkspace: !!wsFolders,
          workspacePath,
          beadsDir,
          initialized,
          backend,
        });
        break;
      }
      case 'getAISuggestions': {
        const suggestions = await getAISuggestions(
          executeCommand,
          data.title,
          data.currentDescription,
        );
        postMessage({
          type: 'aiSuggestions',
          suggestions: suggestions.suggestions,
          error: suggestions.error,
        });
        break;
      }
      case 'getIssueDetails': {
        const details = await provider._getIssueDetails(data.issueId);
        postMessage({ type: 'inlineIssueDetails', issueId: data.issueId, details });
        break;
      }
      case 'getComments': {
        try {
          validateIssueId(data.issueId, 'issueId');
          const cmtResult = await executeCommand(`comments ${data.issueId}`);
          postMessage({
            type: 'commentsResult',
            issueId: data.issueId,
            output: cmtResult.output,
            success: cmtResult.success,
          });
        } catch (e) {
          postMessage({
            type: 'commentsResult',
            issueId: data.issueId,
            success: false,
            output: e.message,
          });
        }
        break;
      }
      case 'getGraphData': {
        const graphRes = await executeCommand('graph --all --json --allow-stale');
        if (graphRes.success) {
          try {
            postMessage({ type: 'graphData', data: JSON.parse(graphRes.output) });
          } catch (e) {
            postMessage({ type: 'graphData', error: 'Failed to parse graph data: ' + e.message });
          }
        } else {
          postMessage({ type: 'graphData', error: graphRes.output || 'Failed to get graph data' });
        }
        break;
      }
      case 'getDependencies': {
        try {
          validateIssueId(data.issueId, 'issueId');
          const [depsRes, depsUpRes] = await Promise.all([
            executeCommand(`dep list ${data.issueId} --json`),
            executeCommand(`dep list ${data.issueId} --direction up --json`),
          ]);
          const parseSafe = (r) => {
            try {
              return r.success ? JSON.parse(r.output) || [] : [];
            } catch {
              return [];
            }
          };
          postMessage({
            type: 'dependenciesResult',
            issueId: data.issueId,
            dependencies: parseSafe(depsRes),
            dependents: parseSafe(depsUpRes),
          });
        } catch (e) {
          postMessage({
            type: 'dependenciesResult',
            issueId: data.issueId,
            success: false,
            error: e.message,
            dependencies: [],
            dependents: [],
          });
        }
        break;
      }
      // PokePoke orchestration helpers
      case 'pokepokeLaunch': {
        const launchRes = await provider._launchPokePoke(data.itemId, data.title, data.isTree);
        postMessage({ type: 'pokepokeLaunchResult', itemId: data.itemId, ...launchRes });
        break;
      }
      case 'pokepokeStop': {
        const stopRes = provider._getPokePokeManager().stop(data.itemId);
        postMessage({ type: 'pokepokeStopResult', itemId: data.itemId, ...stopRes });
        break;
      }
      case 'pokepokeGetStatus': {
        postMessage({
          type: 'pokepokeStatus',
          instances: provider._getPokePokeManager().getInstances(),
        });
        break;
      }
      case 'pokepokeDismiss': {
        const mgr = provider._getPokePokeManager();
        mgr.remove(data.itemId);
        postMessage({ type: 'pokepokeStatus', instances: mgr.getInstances() });
        break;
      }
      case 'getGitHubInfo': {
        await handleGetGitHubInfoMessage(vscode, webviewView, data);
        break;
      }
      case 'getIntegrationSettings': {
        handleGetIntegrationSettingsMessage(vscode, webviewView);
        break;
      }
      case 'updateIntegrationSettings': {
        await handleUpdateIntegrationSettingsMessage(vscode, webviewView, data);
        break;
      }
      case 'adoImport': {
        await handleAdoImportMessage(vscode, webviewView, data, provider);
        break;
      }
      case 'adoExport': {
        await handleAdoExportMessage(vscode, webviewView, data, provider);
        break;
      }
      case 'dispatchParallelPhase': {
        await handleParallelPhaseDispatchMessage(vscode, webviewView, data, provider);
        break;
      }
      case 'epicUnblock': {
        // Remove direct and cascaded blocking edges between two epics.
        const epicA = data.epicA;
        const epicB = data.epicB;
        const cascadedDeps = Array.isArray(data.cascadedDeps) ? data.cascadedDeps : [];
        try {
          // Validate all issue IDs before executing any commands
          validateIssueId(epicA, 'epicA');
          validateIssueId(epicB, 'epicB');
          for (const dep of cascadedDeps) {
            validateIssueId(dep.from, 'cascadedDep.from');
            validateIssueId(dep.to, 'cascadedDep.to');
          }
          // Remove the direct epic-to-epic blocking relationship
          const directResult = await executeCommand(`dep remove ${epicA} --blocks ${epicB}`);
          if (!directResult.success) {
            await executeCommand(`dep remove ${epicB} --blocks ${epicA}`);
          }
          // Remove all cascaded child blocking relationships
          const errors = [];
          for (const dep of cascadedDeps) {
            const removeResult = await executeCommand(`dep remove ${dep.from} --blocks ${dep.to}`);
            if (!removeResult.success) {
              errors.push(`${dep.from} → ${dep.to}`);
            }
          }
          provider._invalidateCache();
          const removedCount = cascadedDeps.length - errors.length + 1;
          postMessage({
            type: 'epicUnblockResult',
            success: true,
            epicA,
            epicB,
            removedCount,
            errors,
          });
        } catch (error) {
          postMessage({
            type: 'epicUnblockResult',
            success: false,
            epicA,
            epicB,
            error: error.message || 'Unknown error during epic unblock',
          });
        }
        break;
      }
      case 'convertToGitHub': {
        await handleConvertToGitHubMessage(vscode, webviewView, data, provider);
        break;
      }
      case 'checkAgentStatus': {
        await handleCheckAgentStatusMessage(vscode, webviewView, data);
        break;
      }
      case 'assignToCopilot': {
        await handleAssignToCopilotMessageWrapper(vscode, webviewView, data, provider);
        break;
      }
      case 'logError': {
        const ch = vscode.window.createOutputChannel('Beads UI Errors');
        ch.appendLine(
          `[${new Date().toISOString()}] ${data.boundaryName}: ${data.error?.message || 'No message'}`,
        );
        if (data.error?.stack) ch.appendLine(`Stack:\n${data.error.stack}`);
        if (data.error?.componentStack) ch.appendLine(`Component:\n${data.error.componentStack}`);
        ch.appendLine('---');
        break;
      }
    }
  } catch (err) {
    console.error('Unhandled error in message handler:', err);
    try {
      postMessage({
        type: 'commandResult',
        command: data.command || 'unknown',
        output: `Internal error: ${err.message}`,
        success: false,
      });
    } catch {
      // Webview may be disposed; nothing we can do
    }
  }
}

module.exports = {
  handleWebviewMessage,
};
