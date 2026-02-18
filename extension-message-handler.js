const path = require('path');
const fs = require('fs');
const { getAISuggestions } = require('./ai-suggestions');
const { detectBeadsBackend } = require('./beads-backend');

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
