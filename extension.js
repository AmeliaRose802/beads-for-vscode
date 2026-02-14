const vscode = require('vscode');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getAISuggestions } = require('./ai-suggestions');
const { PokePokeManager } = require('./pokepoke-manager');

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
  // Auto-initialize bd if not already initialized
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    const workspacePath = workspaceFolders[0].uri.fsPath;
    const beadsDbPath = path.join(workspacePath, '.beads', 'beads.db');

    if (!fs.existsSync(beadsDbPath)) {
      // Initialize bd quietly
      execFile('bd', ['init', '--quiet'], { cwd: workspacePath }, (error, _stdout, _stderr) => {
        if (error) {
          console.error('Failed to auto-initialize bd:', error);
        }
      });
    }
  }
  
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
      try {
      switch (data.type) {
        case 'executeCommand': {
          // Invalidate cache on modifying commands
          const modifyingCommands = ['create', 'update', 'close', 'reopen', 'link', 'dep'];
          const isModifying = modifyingCommands.some(cmd => data.command.includes(cmd));
          if (isModifying) {
            this._invalidateCache();
          }

          // Check conditions BEFORE executing commands to avoid unnecessary work
          if (data.command.includes('list') && data.command.includes('--json') && data.command.includes('--id')) {
            // Fetch a single issue by ID for editing
            const result = await this._executeBdCommand(data.command);
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
              this._executeBdCommand(jsonCommand),
              this._executeBdCommand('graph --all --json --allow-stale')
            ]);
            if (jsonResult.success) {
              webviewView.webview.postMessage({
                type: 'commandResultJSON',
                command: data.command,
                output: jsonResult.output,
                graphData: graphResult && graphResult.success ? graphResult.output : null,
                graphError: graphResult && !graphResult.success ? graphResult.output : null,
                success: true
              });
            } else {
              webviewView.webview.postMessage({
                type: 'commandResult',
                command: data.command,
                output: jsonResult.output,
                success: false
              });
            }
          } else {
            // All other commands: execute once, then route response
            const result = await this._executeBdCommand(data.command);
            if (data.isInlineAction) {
              webviewView.webview.postMessage({
                type: 'inlineActionResult',
                command: data.command,
                output: result.output,
                success: result.success,
                successMessage: data.successMessage
              });
            } else {
              webviewView.webview.postMessage({
                type: 'commandResult',
                command: data.command,
                ...result
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
        case 'getAISuggestions': {
          const suggestions = await getAISuggestions((cmd) => this._executeBdCommand(cmd), data.title, data.currentDescription);
          webviewView.webview.postMessage({ type: 'aiSuggestions', suggestions: suggestions.suggestions, error: suggestions.error });
          break;
        }
        case 'getIssueDetails': {
          const details = await this._getIssueDetails(data.issueId);
          webviewView.webview.postMessage({ type: 'inlineIssueDetails', issueId: data.issueId, details });
          break;
        }
        case 'getComments': {
          const cmtResult = await this._executeBdCommand(`comments ${data.issueId}`);
          webviewView.webview.postMessage({ type: 'commentsResult', issueId: data.issueId, output: cmtResult.output, success: cmtResult.success });
          break;
        }
        case 'getGraphData': {
          const graphRes = await this._executeBdCommand('graph --all --json --allow-stale');
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
            this._executeBdCommand(`dep list ${data.issueId} --json`),
            this._executeBdCommand(`dep list ${data.issueId} --direction up --json`)
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
          const launchRes = this._launchPokePoke(data.itemId, data.title, data.isTree);
          webviewView.webview.postMessage({ type: 'pokepokeLaunchResult', itemId: data.itemId, ...launchRes });
          break;
        }
        case 'pokepokeStop': {
          const stopRes = this._getPokePokeManager().stop(data.itemId);
          webviewView.webview.postMessage({ type: 'pokepokeStopResult', itemId: data.itemId, ...stopRes });
          break;
        }
        case 'pokepokeGetStatus': {
          webviewView.webview.postMessage({ type: 'pokepokeStatus', instances: this._getPokePokeManager().getInstances() });
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
        } catch (_postErr) {
          // Webview may be disposed; nothing we can do
        }
      }
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
   * @returns {{ success: boolean, error?: string }}
   */
  _launchPokePoke(itemId, title, isTree) {
    const cfg = vscode.workspace.getConfiguration('beads-ui.pokepoke');
    if (cfg.get('autoSync', true)) { this._executeBdCommand('sync'); }
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
      
      // Use the current workspace's beads database
      const beadsDbPath = path.join(cwd, '.beads', 'beads.db');
      const env = { 
        ...process.env,
        BEADS_DB: beadsDbPath
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
    const result = await this._executeBdCommand('list --json');
    
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
    let binaryName = 'bd';
    
    if (platform === 'win32') {
      binaryName = 'bd.exe';
    }
    
    const bundledPath = path.join(this._extensionUri.fsPath, 'bin', platform, binaryName);
    
    if (fs.existsSync(bundledPath)) {
      return bundledPath;
    }
    
    return null; // Fall back to system bd
  }

  _getHtmlForWebview(webview) {
    const htmlPath = path.join(this._extensionUri.fsPath, 'webview', 'index.html');
    const cssPath = path.join(this._extensionUri.fsPath, 'webview', 'styles.css');
    const jsPath = path.join(this._extensionUri.fsPath, 'webview', 'bundle.js');
    
    // Get URIs for the webview
    const cssUri = webview.asWebviewUri(vscode.Uri.file(cssPath));
    const jsUri = webview.asWebviewUri(vscode.Uri.file(jsPath));
    
    // Read HTML and replace placeholders
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
