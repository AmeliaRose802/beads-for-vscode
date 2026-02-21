const vscode = require('vscode');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PokePokeManager } = require('./pokepoke-manager');
const { getBeadsEnv } = require('./beads-backend');
const { handleWebviewMessage } = require('./extension-message-handler');

/**
 * Allowed bd subcommands. Commands from the webview must start with one of
 * these tokens to be executed. This prevents arbitrary command injection.
 * @type {string[]}
 */
const ALLOWED_BD_SUBCOMMANDS = [
  'create', 'update', 'close', 'reopen', 'list', 'show', 'ready',
  'blocked', 'stats', 'dep', 'graph', 'sync', 'comments', 'label',
  'init', 'info'
];

/**
 * Parse a command string into an array of arguments, respecting
 * double-quoted segments so that multi-word values stay as one token.
 * Quotes are stripped from the resulting tokens.
 * @param {string} command - The command string to parse
 * @returns {string[]} Array of argument tokens
 */
function parseCommandArgs(command) {
  const args = [];
  const regex = /"((?:[^"\\]|\\.)*)"|(\S+)/g;
  let match;
  while ((match = regex.exec(command)) !== null) {
    if (match[1] !== undefined) {
      // Quoted segment – unescape inner backslash sequences
      args.push(match[1].replace(/\\(.)/g, '$1'));
    } else {
      args.push(match[2]);
    }
  }
  return args;
}

/**
 * Validate that a command string starts with an allowed bd subcommand.
 * @param {string} command - The command string to validate
 * @returns {boolean} True if the command is allowed
 */
function isAllowedCommand(command) {
  const trimmed = command.trim();
  const firstToken = trimmed.split(/\s+/)[0];
  return ALLOWED_BD_SUBCOMMANDS.includes(firstToken);
}

/**
 * Activate the Beads UI extension.
 * @param {import('vscode').ExtensionContext} context - VS Code extension context
 */
function activate(context) {
  // Register the webview provider for the sidebar
  const provider = new BeadsViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('beadsMainView', provider)
  );

  // Register command to open the UI
  let disposable = vscode.commands.registerCommand('beads-ui.open', () => {
    provider.show();
  });

  context.subscriptions.push(disposable);

  // Ensure PokePoke processes are cleaned up when the extension deactivates
  context.subscriptions.push({
    dispose() {
      if (provider._pokepokeManager) {
        provider._pokepokeManager.dispose();
      }
    }
  });
}

class BeadsViewProvider {
  constructor(extensionUri) {
    this._extensionUri = extensionUri;
    this._issueCache = null;
    this._cacheTimestamp = 0;
    this._cacheTTL = 5000;
    this._pokepokeManager = null;
  }

  resolveWebviewView(webviewView, _context, _token) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this._extensionUri.fsPath, 'webview'))
      ]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      await handleWebviewMessage(data, { provider: this, webviewView }, vscode);
    });
  }

  show() {
    if (this._view) {
      this._view.show(true);
    }
  }

  /**
   * Get or create the PokePoke process manager.
   * @returns {import('./pokepoke-manager').PokePokeManager}
   */
  _getPokePokeManager() {
    if (!this._pokepokeManager) {
      const cfg = vscode.workspace.getConfiguration('beads-ui.pokepoke');
      const folders = vscode.workspace.workspaceFolders;
      const wsPath = folders ? folders[0].uri.fsPath : process.cwd();
      this._pokepokeManager = new PokePokeManager({
        pythonPath: cfg.get('pythonPath', 'python'),
        workspacePath: wsPath,
        outputChannelFactory: (name) => vscode.window.createOutputChannel(name)
      });
      this._pokepokeManager.on('stateChange', (event) => {
        if (this._view) {
          this._view.webview.postMessage({ type: 'pokepokeStateChange', ...event });
        }
      });
    }
    return this._pokepokeManager;
  }

  /**
   * Launch PokePoke for an item, optionally syncing first.
   * @param {string} itemId - The beads item ID
   * @param {string} title - The item title
   * @param {boolean} isTree - Whether to process the full tree
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async _launchPokePoke(itemId, title, isTree) {
    const cfg = vscode.workspace.getConfiguration('beads-ui.pokepoke');
    if (cfg.get('autoSync', true)) {
      const syncResult = await this._executeBdCommand('sync');
      if (!syncResult.success) {
        return { success: false, error: syncResult.output || 'Sync failed before PokePoke launch' };
      }
    }
    const mgr = this._getPokePokeManager();
    return isTree ? mgr.launchForTree(itemId, title) : mgr.launchForItem(itemId, title);
  }

  _executeBdCommand(command) {
    return new Promise((resolve) => {
      // Validate command against allowed subcommands
      if (!isAllowedCommand(command)) {
        resolve({
          success: false,
          output: `Error: Command rejected — unrecognized bd subcommand`
        });
        return;
      }
      const workspaceFolders = vscode.workspace.workspaceFolders;
      const cwd = workspaceFolders ? workspaceFolders[0].uri.fsPath : process.cwd();
      // Try to use bundled bd binary first, fall back to system bd
      const platform = process.platform;
      const bundledBdPath = this._getBundledBdPath(platform);
      const bdCommand = bundledBdPath || 'bd';
      // Parse command into arguments array, respecting quoted strings
      const args = parseCommandArgs(command);
      const beadsEnv = getBeadsEnv(cwd);

      // Prefer BEADS_DIR and only set BEADS_DB for legacy SQLite metadata.
      const env = {
        ...process.env,
        ...beadsEnv.env
      };
      execFile(bdCommand, args, {
        maxBuffer: 10 * 1024 * 1024,
        cwd: cwd,
        env: env,
        timeout: 30000
      }, (error, stdout, stderr) => {
        if (error && !stdout && !stderr) {
          // Check if this is a "command not found" error
          const errorMsg = error.message.toLowerCase();
          if (errorMsg.includes('enoent') || errorMsg.includes('not found')) {
            resolve({
              success: false,
              output: 'Error: The "bd" command is not installed.\n\nPlease install beads from: https://github.com/steveyegge/beads\n\nOnce installed, restart VS Code and try again.',
              isNotInstalledError: true
            });
          } else {
            resolve({
              success: false,
              output: `Error: ${error.message}`
            });
          }
        } else {
          const output = stdout || stderr || '';
          resolve({
            success: !error || !!stdout,
            output: output.trim()
          });
        }
      });
    });
  }

  async _getIssueDetails(issueId) {
    try {
      // Use cached issue list if available and fresh
      const issues = await this._getCachedIssues();
      
      if (!issues) {
        console.error('Failed to get issue list');
        return null;
      }
      
      // Find the specific issue by ID
      const issue = issues.find(item => item.id === issueId);
      
      if (!issue) {
        console.error(`Issue ${issueId} not found in list`);
        return null;
      }
      
      return issue;
    } catch (error) {
      console.error('Error fetching issue details:', error);
      return null;
    }
  }

  async _getCachedIssues() {
    const now = Date.now();
    
    // Return cached data if still fresh
    if (this._issueCache && (now - this._cacheTimestamp) < this._cacheTTL) {
      return this._issueCache;
    }
    
    // Fetch fresh data
    const result = await this._executeBdCommand('list --json --limit 0');
    
    if (!result.success) {
      console.error('Failed to execute bd list:', result.output);
      return null;
    }

    try {
      const issues = JSON.parse(result.output);
      
      // Update cache
      this._issueCache = issues;
      this._cacheTimestamp = now;
      
      return issues;
    } catch (e) {
      console.error('Failed to parse issue list:', e, 'Output:', result.output);
      return null;
    }
  }

  _invalidateCache() {
    this._issueCache = null;
    this._cacheTimestamp = 0;
  }

  _getBundledBdPath(platform) {
    const binaryName = platform === 'win32' ? 'bd.exe' : 'bd';
    const bundledPath = path.join(this._extensionUri.fsPath, 'bin', platform, binaryName);
    return fs.existsSync(bundledPath) ? bundledPath : null;
  }

  _getHtmlForWebview(webview) {
    const htmlPath = path.join(this._extensionUri.fsPath, 'webview', 'index.html');
    const cssPath = path.join(this._extensionUri.fsPath, 'webview', 'styles', 'index.css');
    const jsPath = path.join(this._extensionUri.fsPath, 'webview', 'bundle.js');
    
    const cssUri = webview.asWebviewUri(vscode.Uri.file(cssPath));
    const jsUri = webview.asWebviewUri(vscode.Uri.file(jsPath));
    
    let html = fs.readFileSync(htmlPath, 'utf8');
    html = html.replace('{{CSS_URI}}', cssUri.toString());
    html = html.replace('{{JS_URI}}', jsUri.toString());
    
    return html;
  }
}
/** Deactivate the Beads UI extension. */
function deactivate() {
  // PokePoke cleanup is handled via context.subscriptions in activate()
}
module.exports = {
  activate,
  deactivate,
  isAllowedCommand,
  parseCommandArgs,
  ALLOWED_BD_SUBCOMMANDS
};
