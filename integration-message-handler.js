const { importAdoToBeads, exportBeadsToAdo } = require("./ado-integration");

/**
 * Utility wrapper to keep webview messaging concise and consistently formatted.
 * @param {import('vscode').WebviewView} webviewView
 * @param {object} payload
 */
function postToWebview(webviewView, payload) {
  webviewView.webview.postMessage(payload);
}

/**
 * Read the integration settings from workspace configuration.
 * @param {import('vscode')} vscode - VS Code API
 * @returns {{ backend: string, ado: { projectUrl: string, areaPath: string, iterationPath: string, pat: string, importLimit: number } }}
 */
function getIntegrationSettings(vscode) {
  const rootCfg = vscode.workspace.getConfiguration("beads-ui");
  const adoCfg = vscode.workspace.getConfiguration("beads-ui.ado");
  return {
    backend: rootCfg.get("backend", "github"),
    ado: {
      projectUrl: adoCfg.get("projectUrl", ""),
      areaPath: adoCfg.get("areaPath", ""),
      iterationPath: adoCfg.get("iterationPath", ""),
      pat: adoCfg.get("pat", ""),
      importLimit: adoCfg.get("importLimit", 200),
    },
  };
}

/**
 * Persist integration settings to workspace configuration.
 * @param {import('vscode')} vscode - VS Code API
 * @param {{ backend?: string, ado?: { projectUrl?: string, areaPath?: string, iterationPath?: string, pat?: string, importLimit?: number } }} payload
 * @returns {Promise<void>}
 */
async function saveIntegrationSettings(vscode, payload) {
  const rootCfg = vscode.workspace.getConfiguration("beads-ui");
  const adoCfg = vscode.workspace.getConfiguration("beads-ui.ado");
  const target = vscode.ConfigurationTarget.Workspace;

  if (typeof payload?.backend === "string") {
    await rootCfg.update("backend", payload.backend, target);
  }

  if (payload?.ado) {
    if (typeof payload.ado.projectUrl === "string") {
      await adoCfg.update("projectUrl", payload.ado.projectUrl, target);
    }
    if (typeof payload.ado.areaPath === "string") {
      await adoCfg.update("areaPath", payload.ado.areaPath, target);
    }
    if (typeof payload.ado.iterationPath === "string") {
      await adoCfg.update("iterationPath", payload.ado.iterationPath, target);
    }
    if (
      typeof payload.ado.importLimit === "number" &&
      Number.isFinite(payload.ado.importLimit)
    ) {
      await adoCfg.update("importLimit", payload.ado.importLimit, target);
    }
    if (typeof payload.ado.pat === "string" && payload.ado.pat.trim()) {
      await adoCfg.update("pat", payload.ado.pat.trim(), target);
    }
  }
}

/**
 * Send integration settings to the webview.
 * @param {import('vscode')} vscode - VS Code API
 * @param {import('vscode').WebviewView} webviewView - Webview to post message to
 */
function handleGetIntegrationSettingsMessage(vscode, webviewView) {
  const settings = getIntegrationSettings(vscode);
  postToWebview(webviewView, {
    type: "integrationSettings",
    settings: {
      backend: settings.backend,
      ado: {
        projectUrl: settings.ado.projectUrl,
        areaPath: settings.ado.areaPath,
        iterationPath: settings.ado.iterationPath,
        importLimit: settings.ado.importLimit,
        tokenSet: Boolean(settings.ado.pat),
      },
    },
  });
}

/**
 * Update integration settings from the webview payload.
 * @param {import('vscode')} vscode - VS Code API
 * @param {import('vscode').WebviewView} webviewView - Webview to post message to
 * @param {object} data - Incoming message data
 * @returns {Promise<void>}
 */
async function handleUpdateIntegrationSettingsMessage(
  vscode,
  webviewView,
  data,
) {
  try {
    await saveIntegrationSettings(vscode, data.settings || {});
    const refreshed = getIntegrationSettings(vscode);
    postToWebview(webviewView, {
      type: "integrationSettingsSaved",
      success: true,
      settings: {
        backend: refreshed.backend,
        ado: {
          projectUrl: refreshed.ado.projectUrl,
          areaPath: refreshed.ado.areaPath,
          iterationPath: refreshed.ado.iterationPath,
          importLimit: refreshed.ado.importLimit,
          tokenSet: Boolean(refreshed.ado.pat),
        },
      },
      commandKey: data.commandKey,
    });
  } catch (error) {
    postToWebview(webviewView, {
      type: "integrationSettingsSaved",
      success: false,
      error: error.message || "Failed to save integration settings",
      commandKey: data.commandKey,
    });
  }
}

/**
 * Run an ADO import and post results to the webview.
 * @param {import('vscode')} vscode - VS Code API
 * @param {import('vscode').WebviewView} webviewView - Webview to post message to
 * @param {object} data - Incoming message data
 * @param {object} provider - Beads webview provider with command executor
 * @returns {Promise<void>}
 */
async function handleAdoImportMessage(vscode, webviewView, data, provider) {
  await runAdoSync({
    action: "import",
    commandKey: data.commandKey,
    operation: importAdoToBeads,
    vscode,
    webviewView,
    provider,
  });
}

/**
 * Run an ADO export and post results to the webview.
 * @param {import('vscode')} vscode - VS Code API
 * @param {import('vscode').WebviewView} webviewView - Webview to post message to
 * @param {object} data - Incoming message data
 * @param {object} provider - Beads webview provider with command executor
 * @returns {Promise<void>}
 */
async function handleAdoExportMessage(vscode, webviewView, data, provider) {
  await runAdoSync({
    action: "export",
    commandKey: data.commandKey,
    operation: exportBeadsToAdo,
    vscode,
    webviewView,
    provider,
  });
}

/**
 * Shared helper for invoking import/export ADO sync flows so payload formatting
 * and error handling stay consistent between the two code paths.
 * @param {object} options
 * @param {'import'|'export'} options.action
 * @param {import('vscode')} options.vscode
 * @param {import('vscode').WebviewView} options.webviewView
 * @param {string} [options.commandKey]
 * @param {object} options.provider
 * @param {(args: { executeBdCommand: Function, settings: { backend: string, ado: object } }) => Promise<object>} options.operation
 */
async function runAdoSync({
  action,
  vscode,
  webviewView,
  commandKey,
  provider,
  operation,
}) {
  try {
    const settings = getIntegrationSettings(vscode);
    const executeBdCommand = (cmd) => provider._executeBdCommand(cmd);
    const summary = await operation({
      executeBdCommand,
      settings,
    });
    postToWebview(webviewView, {
      type: "adoSyncResult",
      action,
      success: true,
      summary,
      commandKey,
    });
  } catch (error) {
    postToWebview(webviewView, {
      type: "adoSyncResult",
      action,
      success: false,
      error: error.message || `ADO ${action} failed`,
      commandKey,
    });
  }
}

module.exports = {
  getIntegrationSettings,
  handleGetIntegrationSettingsMessage,
  handleUpdateIntegrationSettingsMessage,
  handleAdoImportMessage,
  handleAdoExportMessage,
};
