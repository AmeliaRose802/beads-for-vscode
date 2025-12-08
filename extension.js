const vscode = require('vscode');
const { exec } = require('child_process');
const path = require('path');

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
}

class BeadsViewProvider {
  constructor(extensionUri) {
    this._extensionUri = extensionUri;
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
      switch (data.type) {
        case 'executeCommand': {
          const result = await this._executeBdCommand(data.command);
          webviewView.webview.postMessage({
            type: 'commandResult',
            command: data.command,
            ...result
          });
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
      
      // Hardcode to this project's beads database for extension dev host
      const beadsDbPath = path.join('C:', 'Users', 'ameliapayne', 'beads_ui', '.beads', 'beads.db');
      const env = { 
        ...process.env,
        BEADS_DB: beadsDbPath
      };
      
      exec(fullCommand, {
        maxBuffer: 10 * 1024 * 1024,
        cwd: cwd,
        env: env
      }, (error, stdout, stderr) => {
        if (error && !stdout && !stderr) {
          resolve({
            success: false,
            output: `Error: ${error.message}`
          });
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

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
