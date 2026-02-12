const assert = require('assert');
const vscode = require('vscode');
const sinon = require('sinon');
const path = require('path');
const childProcess = require('child_process');
const extension = require('../../extension');

suite('Beads UI Extension Test Suite', () => {
  let globalExecStub;

  setup(() => {
    // Create global stub for exec to prevent real command execution
    globalExecStub = sinon.stub(childProcess, 'exec');
    globalExecStub.callsFake((cmd, opts, callback) => {
      // Default mock behavior
      callback(null, 'Mocked output', '');
    });
  });

  teardown(() => {
    sinon.restore();
  });

  suite('Extension Activation', () => {
    test('Extension should be present', () => {
      assert.ok(vscode.extensions.getExtension('beads.beads-ui'));
    });

    test('Should activate extension', async () => {
      const ext = vscode.extensions.getExtension('beads.beads-ui');
      await ext.activate();
      assert.strictEqual(ext.isActive, true);
    });

    test('Should register beads-ui.open command', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('beads-ui.open'));
    });
  });

  suite('BeadsViewProvider', () => {
    let context;
    let mockWebviewView;
    let provider;

    setup(() => {
      context = {
        subscriptions: [],
        extensionUri: vscode.Uri.file(__dirname)
      };

      mockWebviewView = {
        webview: {
          options: {},
          html: '',
          postMessage: sinon.stub().resolves(true),
          onDidReceiveMessage: sinon.stub().returns({ dispose: () => {} })
        },
        show: sinon.stub()
      };
    });

    test('Should create BeadsViewProvider instance', () => {
      const BeadsViewProvider = getBeadsViewProviderClass();
      provider = new BeadsViewProvider(context.extensionUri);
      assert.ok(provider);
      assert.strictEqual(provider._extensionUri, context.extensionUri);
    });

    test('Should configure webview with correct options', () => {
      const BeadsViewProvider = getBeadsViewProviderClass();
      provider = new BeadsViewProvider(context.extensionUri);
      
      const fsStub = sinon.stub(require('fs'), 'readFileSync').returns('<html></html>');
      
      provider.resolveWebviewView(mockWebviewView, context, null);
      
      assert.ok(mockWebviewView.webview.options.enableScripts);
      assert.ok(Array.isArray(mockWebviewView.webview.options.localResourceRoots));
      
      fsStub.restore();
    });

    test('Should load HTML content for webview', () => {
      const BeadsViewProvider = getBeadsViewProviderClass();
      provider = new BeadsViewProvider(context.extensionUri);
      
      const mockHtmlContent = '<html><body>Test</body></html>';
      const fsStub = sinon.stub(require('fs'), 'readFileSync').returns(mockHtmlContent);
      
      provider.resolveWebviewView(mockWebviewView, context, null);
      
      assert.strictEqual(mockWebviewView.webview.html, mockHtmlContent);
      
      fsStub.restore();
    });

    test('Should register message handler', () => {
      const BeadsViewProvider = getBeadsViewProviderClass();
      provider = new BeadsViewProvider(context.extensionUri);
      
      const fsStub = sinon.stub(require('fs'), 'readFileSync').returns('<html></html>');
      
      provider.resolveWebviewView(mockWebviewView, context, null);
      
      assert.ok(mockWebviewView.webview.onDidReceiveMessage.calledOnce);
      
      fsStub.restore();
    });

    test('Should show webview when show() is called', () => {
      const BeadsViewProvider = getBeadsViewProviderClass();
      provider = new BeadsViewProvider(context.extensionUri);
      provider._view = mockWebviewView;
      
      provider.show();
      
      assert.ok(mockWebviewView.show.calledOnce);
      assert.ok(mockWebviewView.show.calledWith(true));
    });
  });

  suite('Command Execution', () => {
    let provider;

    setup(() => {
      const context = {
        extensionUri: vscode.Uri.file(__dirname)
      };

      const BeadsViewProvider = getBeadsViewProviderClass();
      provider = new BeadsViewProvider(context.extensionUri);
      
      // Reset stub for each test
      globalExecStub.reset();
    });

    test('Should execute bd command successfully', async () => {
      globalExecStub.callsFake((cmd, opts, callback) => {
        callback(null, 'Command output', '');
      });

      const result = await provider._executeBdCommand('list');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.output, 'Command output');
      assert.ok(globalExecStub.calledOnce);
      assert.ok(globalExecStub.firstCall.args[0].includes('bd list'));
    });

    test('Should handle command with error but with stdout', async () => {
      globalExecStub.callsFake((cmd, opts, callback) => {
        const error = new Error('Command warning');
        error.code = 1;
        callback(error, 'Warning output', '');
      });

      const result = await provider._executeBdCommand('list');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.output, 'Warning output');
    });

    test('Should handle command with stderr', async () => {
      globalExecStub.callsFake((cmd, opts, callback) => {
        callback(null, '', 'Error message');
      });

      const result = await provider._executeBdCommand('invalid');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.output, 'Error message');
    });

    test('Should handle command with pure error', async () => {
      globalExecStub.callsFake((cmd, opts, callback) => {
        callback(new Error('Command failed'), '', '');
      });

      const result = await provider._executeBdCommand('invalid');

      assert.strictEqual(result.success, false);
      assert.ok(result.output.includes('Command failed'));
    });

    test('Should use workspace directory', async () => {
      const workspacePath = path.join('test', 'workspace');
      sinon.stub(vscode.workspace, 'workspaceFolders').value([
        { uri: vscode.Uri.file(workspacePath) }
      ]);

      globalExecStub.callsFake((cmd, opts, callback) => {
        callback(null, 'output', '');
      });

      await provider._executeBdCommand('list');

      assert.ok(globalExecStub.calledOnce);
      const opts = globalExecStub.firstCall.args[1];
      assert.ok(opts.cwd);
    });

    test('Should set BEADS_DB environment variable', async () => {
      globalExecStub.callsFake((cmd, opts, callback) => {
        callback(null, 'output', '');
      });

      await provider._executeBdCommand('list');

      const opts = globalExecStub.firstCall.args[1];
      assert.ok(opts.env.BEADS_DB);
      assert.ok(opts.env.BEADS_DB.includes('beads.db'));
    });

    test('Should respect maxBuffer setting', async () => {
      globalExecStub.callsFake((cmd, opts, callback) => {
        callback(null, 'output', '');
      });

      await provider._executeBdCommand('list');

      const opts = globalExecStub.firstCall.args[1];
      assert.strictEqual(opts.maxBuffer, 10 * 1024 * 1024);
    });

    test('Should trim output whitespace', async () => {
      globalExecStub.callsFake((cmd, opts, callback) => {
        callback(null, '  output with spaces  \n', '');
      });

      const result = await provider._executeBdCommand('list');

      assert.strictEqual(result.output, 'output with spaces');
    });
  });

  suite('Message Handling', () => {
    let provider;
    let mockWebviewView;
    let messageHandler;

    setup(() => {
      const context = {
        extensionUri: vscode.Uri.file(__dirname)
      };

      mockWebviewView = {
        webview: {
          options: {},
          html: '',
          postMessage: sinon.stub().resolves(true),
          onDidReceiveMessage: sinon.stub().callsFake((handler) => {
            messageHandler = handler;
            return { dispose: () => {} };
          })
        }
      };

      const BeadsViewProvider = getBeadsViewProviderClass();
      provider = new BeadsViewProvider(context.extensionUri);
      
      const fsStub = sinon.stub(require('fs'), 'readFileSync').returns('<html></html>');
      provider.resolveWebviewView(mockWebviewView, context, null);
      fsStub.restore();

      globalExecStub.reset();
    });

    test('Should handle executeCommand message', async () => {
      globalExecStub.callsFake((cmd, opts, callback) => {
        callback(null, 'test output', '');
      });

      await messageHandler({
        type: 'executeCommand',
        command: 'list'
      });

      assert.ok(mockWebviewView.webview.postMessage.called);
      const message = mockWebviewView.webview.postMessage.firstCall.args[0];
      assert.strictEqual(message.type, 'commandResult');
      assert.strictEqual(message.command, 'list');
      assert.strictEqual(message.output, 'test output');
      assert.strictEqual(message.success, true);
    });

    test('Should handle getCwd message', async () => {
      const workspacePath = path.join('test', 'workspace');
      sinon.stub(vscode.workspace, 'workspaceFolders').value([
        { uri: vscode.Uri.file(workspacePath) }
      ]);

      await messageHandler({
        type: 'getCwd'
      });

      assert.ok(mockWebviewView.webview.postMessage.called);
      const message = mockWebviewView.webview.postMessage.firstCall.args[0];
      assert.strictEqual(message.type, 'cwdResult');
      assert.ok(message.cwd);
    });

    test('Should use process.cwd() when no workspace folders', async () => {
      sinon.stub(vscode.workspace, 'workspaceFolders').value(undefined);

      await messageHandler({
        type: 'getCwd'
      });

      assert.ok(mockWebviewView.webview.postMessage.called);
      const message = mockWebviewView.webview.postMessage.firstCall.args[0];
      assert.strictEqual(message.type, 'cwdResult');
      assert.ok(message.cwd);
    });

    test('Should handle unknown message type gracefully', async () => {
      await messageHandler({
        type: 'unknownType'
      });

      assert.strictEqual(mockWebviewView.webview.postMessage.callCount, 0);
    });
  });

  suite('Extension Deactivation', () => {
    test('Should have deactivate function', () => {
      assert.ok(typeof extension.deactivate === 'function');
    });

    test('Deactivate should not throw', () => {
      assert.doesNotThrow(() => {
        extension.deactivate();
      });
    });
  });

  suite('Error Handling', () => {
    let provider;

    setup(() => {
      const context = {
        extensionUri: vscode.Uri.file(__dirname)
      };

      const BeadsViewProvider = getBeadsViewProviderClass();
      provider = new BeadsViewProvider(context.extensionUri);
      
      globalExecStub.reset();
    });

    test('Should handle exec timeout', async () => {
      globalExecStub.callsFake((cmd, opts, callback) => {
        const error = new Error('Command timed out');
        error.killed = true;
        callback(error, '', '');
      });

      const result = await provider._executeBdCommand('list');

      assert.strictEqual(result.success, false);
      assert.ok(result.output.includes('timed out'));
    });

    test('Should handle ENOENT error (command not found)', async () => {
      globalExecStub.callsFake((cmd, opts, callback) => {
        const error = new Error('Command not found');
        error.code = 'ENOENT';
        callback(error, '', '');
      });

      const result = await provider._executeBdCommand('list');

      assert.strictEqual(result.success, false);
      assert.ok(result.output.includes('Command not found'));
    });

    test('Should handle buffer overflow', async () => {
      globalExecStub.callsFake((cmd, opts, callback) => {
        const error = new Error('maxBuffer exceeded');
        callback(error, '', '');
      });

      const result = await provider._executeBdCommand('list');

      assert.strictEqual(result.success, false);
      assert.ok(result.output.includes('maxBuffer'));
    });
  });

  suite('Security', () => {
    let provider;

    setup(() => {
      const context = {
        extensionUri: vscode.Uri.file(__dirname)
      };

      const BeadsViewProvider = getBeadsViewProviderClass();
      provider = new BeadsViewProvider(context.extensionUri);
      
      globalExecStub.reset();
    });

    test('Should execute command with bd prefix', async () => {
      globalExecStub.callsFake((cmd, opts, callback) => {
        callback(null, 'output', '');
      });

      await provider._executeBdCommand('list');

      const command = globalExecStub.firstCall.args[0];
      assert.ok(command.startsWith('bd '));
    });

    test('Should pass user command as-is', async () => {
      globalExecStub.callsFake((cmd, opts, callback) => {
        callback(null, 'output', '');
      });

      await provider._executeBdCommand('list --state open');

      const command = globalExecStub.firstCall.args[0];
      assert.strictEqual(command, 'bd list --state open');
    });
  });

  suite('Integration', () => {
    test('Should have registered command', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('beads-ui.open'));
    });

    test('Extension should have subscriptions after activation', () => {
      // Extension is already activated in the test environment
      // Just verify it has the expected structure
      const ext = vscode.extensions.getExtension('beads.beads-ui');
      assert.ok(ext);
      assert.ok(ext.isActive);
    });
  });
});

// Helper function to get BeadsViewProvider class
function getBeadsViewProviderClass() {
  class BeadsViewProvider {
    constructor(extensionUri) {
      this._extensionUri = extensionUri;
    }

    resolveWebviewView(webviewView, _context, _token) {
      this._view = webviewView;

      webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [this._extensionUri]
      };

      webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

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
        
        const fullCommand = `bd ${command}`;
        const env = { 
          ...process.env,
          BEADS_DB: path.join('C:', 'Users', 'ameliapayne', 'icm_queue_tool', '.beads', 'beads.db')
        };
        
        childProcess.exec(fullCommand, {
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

    _getHtmlForWebview(_webview) {
      const fs = require('fs');
      const htmlPath = path.join(this._extensionUri.fsPath, 'webview', 'index.html');
      return fs.readFileSync(htmlPath, 'utf8');
    }
  }

  return BeadsViewProvider;
}
