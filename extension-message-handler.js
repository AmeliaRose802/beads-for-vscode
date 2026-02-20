const path = require('path');
const fs = require('fs');
const { getAISuggestions } = require('./ai-suggestions');
const { detectBeadsBackend } = require('./beads-backend');
const { convertBeadsItemToGitHubIssue } = require('./github-converter');
const { getGitHubSession, detectGitHubRepo } = require('./github-auth');

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

/**
 * Handle messages from the webview.
 * This module contains the message handler switch statement extracted from extension.js
 * to reduce file length and improve maintainability.
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

  try {
    switch (data.type) {
      case 'executeCommand': {
        // Invalidate cache on modifying commands
        const modifyingCommands = ['create', 'update', 'close', 'reopen', 'link', 'dep'];
        const isModifying = modifyingCommands.some(cmd => data.command.includes(cmd));
        if (isModifying) {
          provider._invalidateCache();
        }

        // Check conditions BEFORE executing commands to avoid unnecessary work
        if (data.command.includes('list') && data.command.includes('--json') && data.command.includes('--id')) {
          // Fetch a single issue by ID for editing
          const result = await provider._executeBdCommand(data.command);
          try {
            const issues = JSON.parse(result.output);
            if (issues && issues.length > 0) {
              webviewView.webview.postMessage({
                type: 'issueDetails',
                issue: issues[0]
              });
            } else {
              webviewView.webview.postMessage({
                type: 'commandResult',
                command: data.command,
                output: 'Issue not found',
                success: false
              });
            }
          } catch (e) {
            webviewView.webview.postMessage({
              type: 'commandResult',
              command: data.command,
              ...result
            });
          }
        } else if (data.useJSON && (data.command === 'list' || data.command === 'ready' || data.command === 'blocked')) {
          // Handle list/ready/blocked commands with JSON output directly
          const jsonCommand = `${data.command} --json`;
          const [jsonResult, graphResult] = await Promise.all([
            provider._executeBdCommand(jsonCommand),
            provider._executeBdCommand('graph --all --json --allow-stale')
          ]);
          if (jsonResult.success) {
            webviewView.webview.postMessage({
              type: 'commandResultJSON',
              command: data.command,
              output: jsonResult.output,
              graphData: graphResult && graphResult.success ? graphResult.output : null,
              graphError: graphResult && !graphResult.success ? graphResult.output : null,
              success: true,
              requestId: data.requestId,
              isBackgroundSync: data.isBackgroundSync
            });
          } else {
            webviewView.webview.postMessage({
              type: 'commandResult',
              command: data.command,
              output: jsonResult.output,
              success: false,
              requestId: data.requestId,
              isBackgroundSync: data.isBackgroundSync
            });
          }
        } else {
          // All other commands: execute once, then route response
          const result = await provider._executeBdCommand(data.command);
          if (data.isInlineAction) {
            webviewView.webview.postMessage({
              type: 'inlineActionResult',
              command: data.command,
              output: result.output,
              success: result.success,
              successMessage: data.successMessage,
              requestId: data.requestId,
              isBackgroundSync: data.isBackgroundSync
            });
          } else {
            webviewView.webview.postMessage({
              type: 'commandResult',
              command: data.command,
              ...result,
              requestId: data.requestId,
              isBackgroundSync: data.isBackgroundSync
            });
          }
        }
        break;
      }
      case 'getCwd': {
        const wsFolders = vscode.workspace.workspaceFolders;
        webviewView.webview.postMessage({ type: 'cwdResult', cwd: wsFolders ? wsFolders[0].uri.fsPath : process.cwd() });
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
        webviewView.webview.postMessage({ type: 'currentFileResult', file: curFile });
        break;
      }
      case 'getBeadsStatus': {
        const wsFolders = vscode.workspace.workspaceFolders;
        const workspacePath = wsFolders ? wsFolders[0].uri.fsPath : '';
        const beadsDir = workspacePath ? path.join(workspacePath, '.beads') : '';
        const initialized = !!(beadsDir && fs.existsSync(beadsDir));
        const backend = workspacePath ? detectBeadsBackend(workspacePath).backend : 'unknown';

        webviewView.webview.postMessage({
          type: 'beadsStatus',
          hasWorkspace: !!wsFolders,
          workspacePath,
          beadsDir,
          initialized,
          backend
        });
        break;
      }
      case 'getAISuggestions': {
        const suggestions = await getAISuggestions((cmd) => provider._executeBdCommand(cmd), data.title, data.currentDescription);
        webviewView.webview.postMessage({ type: 'aiSuggestions', suggestions: suggestions.suggestions, error: suggestions.error });
        break;
      }
      case 'getIssueDetails': {
        const details = await provider._getIssueDetails(data.issueId);
        webviewView.webview.postMessage({ type: 'inlineIssueDetails', issueId: data.issueId, details });
        break;
      }
      case 'getComments': {
        const cmtResult = await provider._executeBdCommand(`comments ${data.issueId}`);
        webviewView.webview.postMessage({ type: 'commentsResult', issueId: data.issueId, output: cmtResult.output, success: cmtResult.success });
        break;
      }
      case 'getGraphData': {
        const graphRes = await provider._executeBdCommand('graph --all --json --allow-stale');
        if (graphRes.success) {
          try { webviewView.webview.postMessage({ type: 'graphData', data: JSON.parse(graphRes.output) }); }
          catch (e) { webviewView.webview.postMessage({ type: 'graphData', error: 'Failed to parse graph data: ' + e.message }); }
        } else {
          webviewView.webview.postMessage({ type: 'graphData', error: graphRes.output || 'Failed to get graph data' });
        }
        break;
      }
      case 'getDependencies': {
        const [depsRes, depsUpRes] = await Promise.all([
          provider._executeBdCommand(`dep list ${data.issueId} --json`),
          provider._executeBdCommand(`dep list ${data.issueId} --direction up --json`)
        ]);
        const parseSafe = (r) => { try { return r.success ? JSON.parse(r.output) || [] : []; } catch { return []; } };
        webviewView.webview.postMessage({
          type: 'dependenciesResult',
          issueId: data.issueId,
          dependencies: parseSafe(depsRes),
          dependents: parseSafe(depsUpRes)
        });
        break;
      }
      case 'pokepokeLaunch': {
        const launchRes = await provider._launchPokePoke(data.itemId, data.title, data.isTree);
        webviewView.webview.postMessage({ type: 'pokepokeLaunchResult', itemId: data.itemId, ...launchRes });
        break;
      }
      case 'pokepokeStop': {
        const stopRes = provider._getPokePokeManager().stop(data.itemId);
        webviewView.webview.postMessage({ type: 'pokepokeStopResult', itemId: data.itemId, ...stopRes });
        break;
      }
      case 'pokepokeGetStatus': {
        webviewView.webview.postMessage({ type: 'pokepokeStatus', instances: provider._getPokePokeManager().getInstances() });
        break;
      }
      case 'pokepokeDismiss': {
        const mgr = provider._getPokePokeManager();
        mgr.remove(data.itemId);
        webviewView.webview.postMessage({ type: 'pokepokeStatus', instances: mgr.getInstances() });
        break;
      }
      case 'getGitHubInfo': {
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
        break;
      }
      case 'dispatchParallelPhase': {
        const wsFolders = vscode.workspace.workspaceFolders;
        if (!wsFolders || wsFolders.length === 0) {
          webviewView.webview.postMessage({
            type: 'parallelPhaseDispatchError',
            success: false,
            error: 'An open workspace is required to dispatch a phase to GitHub Copilot.'
          });
          break;
        }

        const workspacePath = wsFolders[0].uri.fsPath;
        const phaseIndex = Number.isFinite(data.phaseIndex) ? data.phaseIndex : null;
        const issueIds = Array.isArray(data.issueIds)
          ? data.issueIds.map(String).map(s => s.trim()).filter(Boolean)
          : [];
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
              ghResult = await convertBeadsItemToGitHubIssue(item, workspacePath, assignee ? { assignee } : undefined);
            } catch (error) {
              const message = error && error.message ? error.message : String(error);
              if (assignee && /assignee|Could not resolve|Invalid assignee/i.test(message)) {
                warning = `Created issue without assigning ${assignee}: ${message}`;
                assigned = false;
                ghResult = await convertBeadsItemToGitHubIssue(item, workspacePath);
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
        break;
      }
      case 'epicUnblock': {
        const epicA = data.epicA;
        const epicB = data.epicB;
        const cascadedDeps = Array.isArray(data.cascadedDeps) ? data.cascadedDeps : [];

        try {
          // Remove the direct epic-to-epic blocking relationship
          const directResult = await provider._executeBdCommand(
            `dep remove ${epicA} --blocks ${epicB}`
          );
          if (!directResult.success) {
            await provider._executeBdCommand(
              `dep remove ${epicB} --blocks ${epicA}`
            );
          }

          // Remove all cascaded child blocking relationships
          const errors = [];
          for (const dep of cascadedDeps) {
            const removeResult = await provider._executeBdCommand(
              `dep remove ${dep.from} --blocks ${dep.to}`
            );
            if (!removeResult.success) {
              errors.push(`${dep.from} → ${dep.to}`);
            }
          }

          provider._invalidateCache();
          const removedCount = cascadedDeps.length - errors.length + 1;
          webviewView.webview.postMessage({
            type: 'epicUnblockResult',
            success: true,
            epicA,
            epicB,
            removedCount,
            errors
          });
        } catch (error) {
          webviewView.webview.postMessage({
            type: 'epicUnblockResult',
            success: false,
            epicA,
            epicB,
            error: error.message || 'Unknown error during epic unblock'
          });
        }
        break;
      }
      case 'convertToGitHub': {
        const wsFolders = vscode.workspace.workspaceFolders;
        if (!wsFolders || wsFolders.length === 0) {
           webviewView.webview.postMessage({
              type: 'githubConversionResult',
              success: false,
              error: 'An open workspace is required to convert items to GitHub issues.',
              commandKey: data.commandKey
            });
          break;
        }

        const workspacePath = wsFolders[0].uri.fsPath;
        try {
          const result = await provider._executeBdCommand(`list --id ${data.issueId} --json`);
          if (!result.success) {
             webviewView.webview.postMessage({
               type: 'githubConversionResult',
               success: false,
               error: `Failed to fetch issue: ${result.output}`,
               commandKey: data.commandKey
             });
            break;
          }

          const issues = JSON.parse(result.output);
          if (!issues || issues.length === 0) {
             webviewView.webview.postMessage({
               type: 'githubConversionResult',
               success: false,
               error: `Issue ${data.issueId} not found`,
               commandKey: data.commandKey
             });
            break;
          }

          const issue = issues[0];
          const ghResult = await convertBeadsItemToGitHubIssue(issue, workspacePath);

           webviewView.webview.postMessage({
              type: 'githubConversionResult',
              success: true,
              url: ghResult.url,
              number: ghResult.number,
              issueId: data.issueId,
              commandKey: data.commandKey
            });
        } catch (error) {
           webviewView.webview.postMessage({
              type: 'githubConversionResult',
              success: false,
              error: error.message || 'Unknown error occurred',
              commandKey: data.commandKey
            });
        }
        break;
      }
      case 'logError': {
        const ch = vscode.window.createOutputChannel('Beads UI Errors');
        ch.appendLine(`[${new Date().toISOString()}] ${data.boundaryName}: ${data.error?.message || 'No message'}`);
        if (data.error?.stack) ch.appendLine(`Stack:\n${data.error.stack}`);
        if (data.error?.componentStack) ch.appendLine(`Component:\n${data.error.componentStack}`);
        ch.appendLine('---');
        break;
      }
    }
  } catch (err) {
    console.error('Unhandled error in message handler:', err);
    try {
      webviewView.webview.postMessage({
        type: 'commandResult',
        command: data.command || 'unknown',
        output: `Internal error: ${err.message}`,
        success: false
      });
    } catch {
      // Webview may be disposed; nothing we can do
    }
  }
}

module.exports = {
  handleWebviewMessage
};
