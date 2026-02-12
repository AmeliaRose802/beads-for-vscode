const vscode = require('vscode');
const { exec } = require('child_process');
const path = require('path');
const { getAISuggestions } = require('./ai-suggestions');

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
    const fs = require('fs');
    
    if (!fs.existsSync(beadsDbPath)) {
      // Initialize bd quietly
      exec('bd init --quiet', { cwd: workspacePath }, (error, _stdout, _stderr) => {
        if (error) {
          console.error('Failed to auto-initialize bd:', error);
        } else {
          console.log('Beads auto-initialized successfully');
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
}

class BeadsViewProvider {
  constructor(extensionUri) {
    this._extensionUri = extensionUri;
    this._issueCache = null; // Cache for issue list
    this._cacheTimestamp = 0; // Last cache update time
    this._cacheTTL = 5000; // Cache time-to-live in milliseconds (5 seconds)
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
              this._executeBdCommand('graph --all --json')
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
          const workspaceFolders = vscode.workspace.workspaceFolders;
          const cwd = workspaceFolders ? workspaceFolders[0].uri.fsPath : process.cwd();
          webviewView.webview.postMessage({
            type: 'cwdResult',
            cwd: cwd
          });
          break;
        }
        case 'getCurrentFile': {
          const activeEditor = vscode.window.activeTextEditor;
          let currentFile = '';
          if (activeEditor) {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders) {
              currentFile = vscode.workspace.asRelativePath(activeEditor.document.uri);
            } else {
              currentFile = activeEditor.document.fileName;
            }
          }
          webviewView.webview.postMessage({
            type: 'currentFileResult',
            file: currentFile
          });
          break;
        }
        case 'getAISuggestions': {
          const suggestions = await getAISuggestions(
            (cmd) => this._executeBdCommand(cmd), data.title, data.currentDescription
          );
          webviewView.webview.postMessage({
            type: 'aiSuggestions',
            suggestions: suggestions.suggestions,
            error: suggestions.error
          });
          break;
        }
        case 'getIssueDetails': {
          const details = await this._getIssueDetails(data.issueId);
          webviewView.webview.postMessage({
            type: 'inlineIssueDetails',
            issueId: data.issueId,
            details: details
          });
          break;
        }
        case 'getComments': {
          const result = await this._executeBdCommand(`comments ${data.issueId}`);
          webviewView.webview.postMessage({
            type: 'commentsResult',
            issueId: data.issueId,
            output: result.output,
            success: result.success
          });
          break;
        }
        case 'getGraphData': {
          const result = await this._executeBdCommand('graph --all --json');
          if (result.success) {
            try {
              const graphData = JSON.parse(result.output);
              webviewView.webview.postMessage({
                type: 'graphData',
                data: graphData
              });
            } catch (e) {
              webviewView.webview.postMessage({
                type: 'graphData',
                error: 'Failed to parse graph data: ' + e.message
              });
            }
          } else {
            webviewView.webview.postMessage({
              type: 'graphData',
              error: result.output || 'Failed to get graph data'
            });
          }
          break;
        }
        case 'getDependencies': {
          // Fetch both dependencies and dependents for an issue
          const depsResult = await this._executeBdCommand(`dep list ${data.issueId} --json`);
          const dependentsResult = await this._executeBdCommand(`dep list ${data.issueId} --direction up --json`);
          
          let dependencies = [];
          let dependents = [];
          
          if (depsResult.success) {
            try {
              dependencies = JSON.parse(depsResult.output) || [];
            } catch (e) {
              console.error('Failed to parse dependencies:', e);
            }
          }
          
          if (dependentsResult.success) {
            try {
              dependents = JSON.parse(dependentsResult.output) || [];
            } catch (e) {
              console.error('Failed to parse dependents:', e);
            }
          }
          
          webviewView.webview.postMessage({
            type: 'dependenciesResult',
            issueId: data.issueId,
            dependencies: dependencies,
            dependents: dependents
          });
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

  _executeBdCommand(command) {
    return new Promise((resolve) => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      const cwd = workspaceFolders ? workspaceFolders[0].uri.fsPath : process.cwd();
      
      // Try to use bundled bd binary first, fall back to system bd
      const platform = process.platform;
      const bundledBdPath = this._getBundledBdPath(platform);
      const bdCommand = bundledBdPath || 'bd';
      
      const fullCommand = `${bdCommand} ${command}`;
      
      // Use the current workspace's beads database
      const beadsDbPath = path.join(cwd, '.beads', 'beads.db');
      const env = { 
        ...process.env,
        BEADS_DB: beadsDbPath
      };
      
      exec(fullCommand, {
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
      console.error('Failed to execute bd list:', result.error);
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
    // Check if bundled bd binary exists
    const fs = require('fs');
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
    const fs = require('fs');
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
function deactivate() {}

module.exports = {
  activate,
  deactivate
};
