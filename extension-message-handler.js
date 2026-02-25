const path = require("path");
const fs = require("fs");

const { getAISuggestions } = require("./ai-suggestions");
const { detectBeadsBackend } = require("./beads-backend");
const { validateIssueId } = require("./validate-issue-id");
const {
  handleGetGitHubInfoMessage,
  handleConvertToGitHubMessage,
  handleCheckAgentStatusMessage,
  handleParallelPhaseDispatchMessage,
  handleAssignToCopilotMessageWrapper,
} = require("./github-message-handler");
const {
  handleGetIntegrationSettingsMessage,
  handleUpdateIntegrationSettingsMessage,
  handleAdoImportMessage,
  handleAdoExportMessage,
} = require("./integration-message-handler");

const ERROR_CHANNEL_NAME = "Beads UI Errors";
const MODIFYING_COMMANDS = [
  "create",
  "update",
  "close",
  "reopen",
  "link",
  "dep",
];
const JSON_SUMMARY_COMMANDS = ["list", "ready", "blocked"];

const WEBVIEW_MESSAGE_HANDLERS = Object.freeze({
  // Command execution + error logging
  executeCommand: handleExecuteCommandCase,
  logError: handleLogErrorCase,

  // Workspace + metadata requests
  getCwd: handleGetCwdCase,
  getCurrentFile: handleGetCurrentFileCase,
  getBeadsStatus: handleGetBeadsStatusCase,

  // Issue data + visualization helpers
  getAISuggestions: handleGetAISuggestionsCase,
  getIssueDetails: handleGetIssueDetailsCase,
  getComments: handleGetCommentsCase,
  getGraphData: handleGetGraphDataCase,
  getDependencies: handleGetDependenciesCase,
  epicUnblock: handleEpicUnblockCase,

  // PokePoke orchestrator integration
  pokepokeLaunch: handlePokepokeLaunchCase,
  pokepokeStop: handlePokepokeStopCase,
  pokepokeGetStatus: handlePokepokeGetStatusCase,
  pokepokeDismiss: handlePokepokeDismissCase,

  // GitHub + integration bridges
  getGitHubInfo: handleGetGitHubInfoCase,
  convertToGitHub: handleConvertToGitHubCase,
  checkAgentStatus: handleCheckAgentStatusCase,
  assignToCopilot: handleAssignToCopilotCase,
  dispatchParallelPhase: handleDispatchParallelPhaseCase,
  getIntegrationSettings: handleGetIntegrationSettingsCase,
  updateIntegrationSettings: handleUpdateIntegrationSettingsCase,
  adoImport: handleAdoImportCase,
  adoExport: handleAdoExportCase,
});

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
  const runtimeContext = buildRuntimeContext(data, context, vscode);

  try {
    const handler = WEBVIEW_MESSAGE_HANDLERS[data.type];
    if (!handler) {
      logUnknownMessageType(data.type);
      return;
    }

    await handler(runtimeContext);
  } catch (error) {
    reportUnhandledHandlerError(runtimeContext, data.command, error);
  }
}

module.exports = {
  handleWebviewMessage,
};

/**
 * Build the runtime context object passed into each handler so that the
 * messaging helpers all receive the same shape and helper callbacks.
 * @param {object} data
 * @param {{ provider: any, webviewView: import('vscode').WebviewView }} context
 * @param {import('vscode')} vscode
 */
function buildRuntimeContext(data, context, vscode) {
  const { provider, webviewView } = context;
  return {
    data,
    provider,
    vscode,
    webviewView,
    postMessage: (payload) => webviewView.webview.postMessage(payload),
    executeCommand: (command) => provider._executeBdCommand(command),
  };
}

/**
 * Warn when the webview sends a message type that we do not recognize.
 * @param {string} type
 */
function logUnknownMessageType(type) {
  if (!type) {
    return;
  }
  console.warn(`[Beads UI] Unhandled webview message type: ${type}`);
}

/**
 * Gracefully report unexpected handler failures back to the webview.
 * @param {{ postMessage: Function }} runtimeContext
 * @param {string} command
 * @param {Error} error
 */
function reportUnhandledHandlerError(runtimeContext, command, error) {
  console.error("Unhandled error in message handler:", error);
  try {
    runtimeContext.postMessage({
      type: "commandResult",
      command: command || "unknown",
      output: `Internal error: ${error.message}`,
      success: false,
    });
  } catch {
    // The target webview may already be disposed.
  }
}

/**
 * Workspace command handlers keep metadata lookups isolated for readability.
 */
async function handleExecuteCommandCase(context) {
  await handleExecuteCommandMessage(context);
}

// -----------------------------------------------------------------------------
// Workspace + VS Code metadata helpers
// -----------------------------------------------------------------------------
function handleGetCwdCase({ vscode, postMessage }) {
  const wsFolders = vscode.workspace.workspaceFolders;
  postMessage({
    type: "cwdResult",
    cwd:
      wsFolders && wsFolders.length > 0
        ? wsFolders[0].uri.fsPath
        : process.cwd(),
  });
}

function handleGetCurrentFileCase({ vscode, postMessage }) {
  const editor = vscode.window.activeTextEditor;
  let curFile = "";
  if (editor) {
    curFile = vscode.workspace.workspaceFolders
      ? vscode.workspace.asRelativePath(editor.document.uri)
      : editor.document.fileName;
  }
  postMessage({ type: "currentFileResult", file: curFile });
}

function handleGetBeadsStatusCase({ vscode, postMessage }) {
  const wsFolders = vscode.workspace.workspaceFolders;
  const workspacePath =
    wsFolders && wsFolders.length > 0 ? wsFolders[0].uri.fsPath : "";
  const beadsDir = workspacePath ? path.join(workspacePath, ".beads") : "";
  const initialized = !!(beadsDir && fs.existsSync(beadsDir));
  const backend = workspacePath
    ? detectBeadsBackend(workspacePath).backend
    : "unknown";

  postMessage({
    type: "beadsStatus",
    hasWorkspace: !!wsFolders,
    workspacePath,
    beadsDir,
    initialized,
    backend,
  });
}

async function handleGetAISuggestionsCase({
  data,
  executeCommand,
  postMessage,
}) {
  const suggestions = await getAISuggestions(
    executeCommand,
    data.title,
    data.currentDescription,
  );
  postMessage({
    type: "aiSuggestions",
    suggestions: suggestions.suggestions,
    error: suggestions.error,
  });
}

async function handleGetIssueDetailsCase({ data, provider, postMessage }) {
  const details = await provider._getIssueDetails(data.issueId);
  postMessage({ type: "inlineIssueDetails", issueId: data.issueId, details });
}

async function handleGetCommentsCase({ data, executeCommand, postMessage }) {
  try {
    validateIssueId(data.issueId, "issueId");
    const cmtResult = await executeCommand(`comments ${data.issueId}`);
    postMessage({
      type: "commentsResult",
      issueId: data.issueId,
      output: cmtResult.output,
      success: cmtResult.success,
    });
  } catch (error) {
    postMessage({
      type: "commentsResult",
      issueId: data.issueId,
      success: false,
      output: error.message,
    });
  }
}

async function handleGetGraphDataCase({ executeCommand, postMessage }) {
  const graphRes = await executeCommand("graph --all --json --allow-stale");
  if (graphRes.success) {
    try {
      postMessage({ type: "graphData", data: JSON.parse(graphRes.output) });
    } catch (error) {
      postMessage({
        type: "graphData",
        error: `Failed to parse graph data: ${error.message}`,
      });
    }
    return;
  }

  postMessage({
    type: "graphData",
    error: graphRes.output || "Failed to get graph data",
  });
}

async function handleGetDependenciesCase({
  data,
  executeCommand,
  postMessage,
}) {
  try {
    validateIssueId(data.issueId, "issueId");
    const [depsRes, depsUpRes] = await Promise.all([
      executeCommand(`dep list ${data.issueId} --json`),
      executeCommand(`dep list ${data.issueId} --direction up --json`),
    ]);
    postMessage({
      type: "dependenciesResult",
      issueId: data.issueId,
      dependencies: tryParseJsonArray(depsRes),
      dependents: tryParseJsonArray(depsUpRes),
    });
  } catch (error) {
    postMessage({
      type: "dependenciesResult",
      issueId: data.issueId,
      success: false,
      error: error.message,
      dependencies: [],
      dependents: [],
    });
  }
}

/**
 * PokePoke orchestrator state helpers.
 */
async function handlePokepokeLaunchCase({ data, provider, postMessage }) {
  const launchRes = await provider._launchPokePoke(
    data.itemId,
    data.title,
    data.isTree,
  );
  postMessage({
    type: "pokepokeLaunchResult",
    itemId: data.itemId,
    ...launchRes,
  });
}

function handlePokepokeStopCase({ data, provider, postMessage }) {
  const stopRes = provider._getPokePokeManager().stop(data.itemId);
  postMessage({ type: "pokepokeStopResult", itemId: data.itemId, ...stopRes });
}

function handlePokepokeGetStatusCase({ provider, postMessage }) {
  postMessage({
    type: "pokepokeStatus",
    instances: provider._getPokePokeManager().getInstances(),
  });
}

function handlePokepokeDismissCase({ data, provider, postMessage }) {
  const mgr = provider._getPokePokeManager();
  mgr.remove(data.itemId);
  postMessage({ type: "pokepokeStatus", instances: mgr.getInstances() });
}

/**
 * Integration + GitHub bridge helpers.
 */
async function handleGetGitHubInfoCase({ vscode, webviewView, data }) {
  await handleGetGitHubInfoMessage(vscode, webviewView, data);
}

function handleGetIntegrationSettingsCase({ vscode, webviewView }) {
  handleGetIntegrationSettingsMessage(vscode, webviewView);
}

async function handleUpdateIntegrationSettingsCase({
  vscode,
  webviewView,
  data,
}) {
  await handleUpdateIntegrationSettingsMessage(vscode, webviewView, data);
}

async function handleAdoImportCase({ vscode, webviewView, data, provider }) {
  await handleAdoImportMessage(vscode, webviewView, data, provider);
}

async function handleAdoExportCase({ vscode, webviewView, data, provider }) {
  await handleAdoExportMessage(vscode, webviewView, data, provider);
}

async function handleDispatchParallelPhaseCase({
  vscode,
  webviewView,
  data,
  provider,
}) {
  await handleParallelPhaseDispatchMessage(vscode, webviewView, data, provider);
}

async function handleEpicUnblockCase(context) {
  await handleEpicUnblockMessage(context);
}

async function handleConvertToGitHubCase({
  vscode,
  webviewView,
  data,
  provider,
}) {
  await handleConvertToGitHubMessage(vscode, webviewView, data, provider);
}

async function handleCheckAgentStatusCase({ vscode, webviewView, data }) {
  await handleCheckAgentStatusMessage(vscode, webviewView, data);
}

async function handleAssignToCopilotCase({
  vscode,
  webviewView,
  data,
  provider,
}) {
  await handleAssignToCopilotMessageWrapper(
    vscode,
    webviewView,
    data,
    provider,
  );
}

function handleLogErrorCase({ vscode, data }) {
  logWebviewBoundaryError(vscode, data);
}

/**
 * Funnel executeCommand calls through a single helper so we can centralize cache
 * invalidation plus the JSON/inline/standard permutations.
 */
async function handleExecuteCommandMessage({
  data,
  executeCommand,
  provider,
  postMessage,
}) {
  const command = data.command || "";

  if (isModifyingCommand(command)) {
    provider._invalidateCache();
  }

  if (isSingleIssueFetch(command)) {
    await respondWithSingleIssueFetch({ data, executeCommand, postMessage });
    return;
  }

  if (wantsJsonSummary(data)) {
    await respondWithJsonSummary({ data, executeCommand, postMessage });
    return;
  }

  await respondWithStandardCommand({ data, executeCommand, postMessage });
}

/**
 * Handle `bd list --id --json` style commands by returning the single issue as a
 * structured payload whenever possible.
 */
async function respondWithSingleIssueFetch({
  data,
  executeCommand,
  postMessage,
}) {
  const result = await executeCommand(data.command);
  try {
    const issues = JSON.parse(result.output);
    if (issues && issues.length > 0) {
      postMessage({ type: "issueDetails", issue: issues[0] });
    } else {
      postMessage({
        type: "commandResult",
        command: data.command,
        output: "Issue not found",
        success: false,
      });
    }
  } catch (error) {
    postMessage({ type: "commandResult", command: data.command, ...result });
  }
}

/**
 * Attach parsed JSON summaries and auxiliary graph data to the response payload
 * so the webview can render richer status cards.
 */
async function respondWithJsonSummary({ data, executeCommand, postMessage }) {
  const jsonCommand = `${data.command} --json`;
  const [jsonResult, graphResult] = await Promise.all([
    executeCommand(jsonCommand),
    executeCommand("graph --all --json --allow-stale"),
  ]);

  if (jsonResult.success) {
    postMessage({
      type: "commandResultJSON",
      command: data.command,
      output: jsonResult.output,
      graphData: graphResult && graphResult.success ? graphResult.output : null,
      graphError:
        graphResult && !graphResult.success ? graphResult.output : null,
      success: true,
      requestId: data.requestId,
      isBackgroundSync: data.isBackgroundSync,
    });
    return;
  }

  postMessage({
    type: "commandResult",
    command: data.command,
    output: jsonResult.output,
    success: false,
    requestId: data.requestId,
    isBackgroundSync: data.isBackgroundSync,
  });
}

async function respondWithStandardCommand({
  data,
  executeCommand,
  postMessage,
}) {
  const result = await executeCommand(data.command);
  if (data.isInlineAction) {
    postMessage({
      type: "inlineActionResult",
      command: data.command,
      output: result.output,
      success: result.success,
      successMessage: data.successMessage,
      requestId: data.requestId,
      isBackgroundSync: data.isBackgroundSync,
    });
    return;
  }

  postMessage({
    type: "commandResult",
    command: data.command,
    ...result,
    requestId: data.requestId,
    isBackgroundSync: data.isBackgroundSync,
  });
}

/**
 * Determine whether a command is expected to mutate the local bd cache.
 * @param {string} command
 */
function isModifyingCommand(command) {
  return MODIFYING_COMMANDS.some((cmd) => command.includes(cmd));
}

/**
 * Identify `bd list --json --id` combinations so we can surface a single issue.
 * @param {string} command
 */
function isSingleIssueFetch(command) {
  return (
    command.includes("list") &&
    command.includes("--json") &&
    command.includes("--id")
  );
}

/**
 * Decide if a command prefers the JSON-rich response format.
 * @param {object} data
 */
function wantsJsonSummary(data) {
  return data.useJSON && JSON_SUMMARY_COMMANDS.includes(data.command);
}

/**
 * Safely parse JSON arrays from command output, returning fallbacks otherwise.
 * @param {{ success: boolean, output?: string }} result
 */
function tryParseJsonArray(result) {
  if (!result || !result.success) {
    return [];
  }
  try {
    return JSON.parse(result.output) || [];
  } catch {
    return [];
  }
}

/**
 * Remove dependencies between two epics (and any cascaded edges) so parallel
 * phases can proceed.
 */
async function handleEpicUnblockMessage({
  data,
  executeCommand,
  provider,
  postMessage,
}) {
  const epicA = data.epicA;
  const epicB = data.epicB;
  const cascadedDeps = Array.isArray(data.cascadedDeps)
    ? data.cascadedDeps
    : [];

  try {
    validateIssueId(epicA, "epicA");
    validateIssueId(epicB, "epicB");
    for (const dep of cascadedDeps) {
      validateIssueId(dep.from, "cascadedDep.from");
      validateIssueId(dep.to, "cascadedDep.to");
    }

    const directResult = await executeCommand(
      `dep remove ${epicA} --blocks ${epicB}`,
    );
    if (!directResult.success) {
      await executeCommand(`dep remove ${epicB} --blocks ${epicA}`);
    }

    const errors = [];
    for (const dep of cascadedDeps) {
      const removeResult = await executeCommand(
        `dep remove ${dep.from} --blocks ${dep.to}`,
      );
      if (!removeResult.success) {
        errors.push(`${dep.from} → ${dep.to}`);
      }
    }

    provider._invalidateCache();
    const removedCount = cascadedDeps.length - errors.length + 1;
    postMessage({
      type: "epicUnblockResult",
      success: true,
      epicA,
      epicB,
      removedCount,
      errors,
    });
  } catch (error) {
    postMessage({
      type: "epicUnblockResult",
      success: false,
      epicA,
      epicB,
      error: error.message || "Unknown error during epic unblock",
    });
  }
}

/**
 * Surface boundary errors inside a VS Code output channel for easier debugging.
 */
function logWebviewBoundaryError(vscode, data) {
  const channel = vscode.window.createOutputChannel(ERROR_CHANNEL_NAME);
  channel.appendLine(
    `[${new Date().toISOString()}] ${data.boundaryName}: ${data.error?.message || "No message"}`,
  );
  if (data.error?.stack) channel.appendLine(`Stack:\n${data.error.stack}`);
  if (data.error?.componentStack)
    channel.appendLine(`Component:\n${data.error.componentStack}`);
  channel.appendLine("---");
}
