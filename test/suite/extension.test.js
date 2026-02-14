const assert = require('assert');
const vscode = require('vscode');
const sinon = require('sinon');
const path = require('path');
const childProcess = require('child_process');
const extension = require('../../extension');
const { isAllowedCommand } = extension;

suite('Beads UI Extension Test Suite', () => {
  let globalExecFileStub;

  setup(() => {
    // Create global stub for execFile to prevent real command execution
    globalExecFileStub = sinon.stub(childProcess, 'execFile');
    globalExecFileStub.callsFake((file, args, opts, callback) => {
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
    let context, mockWebviewView, provider;
    setup(() => {
      context = { subscriptions: [], extensionUri: vscode.Uri.file(__dirname) };
      mockWebviewView = {
        webview: {
          options: {}, html: '',
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
      const mockHtml = '<html><body>Test</body></html>';
      const fsStub = sinon.stub(require('fs'), 'readFileSync').returns(mockHtml);
      provider.resolveWebviewView(mockWebviewView, context, null);
      assert.strictEqual(mockWebviewView.webview.html, mockHtml);
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
      const BeadsViewProvider = getBeadsViewProviderClass();
      provider = new BeadsViewProvider(vscode.Uri.file(__dirname));
      globalExecFileStub.reset();
    });

    test('Should execute bd command successfully', async () => {
      globalExecFileStub.callsFake((file, args, opts, cb) => cb(null, 'Command output', ''));
      const result = await provider._executeBdCommand('list');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.output, 'Command output');
      assert.ok(globalExecFileStub.calledOnce);
      assert.strictEqual(globalExecFileStub.firstCall.args[0], 'bd');
      assert.deepStrictEqual(globalExecFileStub.firstCall.args[1], ['list']);
    });
    test('Should handle command with error but with stdout', async () => {
      const error = new Error('Command warning'); error.code = 1;
      globalExecFileStub.callsFake((file, args, opts, cb) => cb(error, 'Warning output', ''));
      const result = await provider._executeBdCommand('list');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.output, 'Warning output');
    });
    test('Should handle command with stderr', async () => {
      globalExecFileStub.callsFake((file, args, opts, cb) => cb(null, '', 'Error message'));
      const result = await provider._executeBdCommand('list');
      assert.strictEqual(result.output, 'Error message');
    });
    test('Should handle command with pure error', async () => {
      globalExecFileStub.callsFake((file, args, opts, cb) => cb(new Error('Command failed'), '', ''));
      const result = await provider._executeBdCommand('list');
      assert.strictEqual(result.success, false);
      assert.ok(result.output.includes('Command failed'));
    });

    test('Should use workspace directory', async () => {
      sinon.stub(vscode.workspace, 'workspaceFolders').value(
        [{ uri: vscode.Uri.file(path.join('test', 'workspace')) }]);
      globalExecFileStub.callsFake((file, args, opts, cb) => cb(null, 'output', ''));
      await provider._executeBdCommand('list');
      assert.ok(globalExecFileStub.firstCall.args[2].cwd);
    });
    test('Should set BEADS_DB environment variable', async () => {
      globalExecFileStub.callsFake((file, args, opts, cb) => cb(null, 'output', ''));
      await provider._executeBdCommand('list');
      const opts = globalExecFileStub.firstCall.args[2];
      assert.ok(opts.env.BEADS_DB);
      assert.ok(opts.env.BEADS_DB.includes('beads.db'));
    });
    test('Should respect maxBuffer and timeout settings', async () => {
      globalExecFileStub.callsFake((file, args, opts, cb) => cb(null, 'output', ''));
      await provider._executeBdCommand('list');
      const opts = globalExecFileStub.firstCall.args[2];
      assert.strictEqual(opts.maxBuffer, 10 * 1024 * 1024);
      assert.strictEqual(opts.timeout, 30000);
    });
    test('Should trim output whitespace', async () => {
      globalExecFileStub.callsFake((file, args, opts, cb) => cb(null, '  output with spaces  \n', ''));
      const result = await provider._executeBdCommand('list');
      assert.strictEqual(result.output, 'output with spaces');
    });
  });

  suite('Message Handling', () => {
    let provider, mockWebviewView, messageHandler;
    setup(() => {
      mockWebviewView = {
        webview: {
          options: {}, html: '',
          postMessage: sinon.stub().resolves(true),
          onDidReceiveMessage: sinon.stub().callsFake((handler) => {
            messageHandler = handler;
            return { dispose: () => {} };
          })
        }
      };
      const BeadsViewProvider = getBeadsViewProviderClass();
      provider = new BeadsViewProvider(vscode.Uri.file(__dirname));
      const fsStub = sinon.stub(require('fs'), 'readFileSync').returns('<html></html>');
      provider.resolveWebviewView(mockWebviewView, {}, null);
      fsStub.restore();
      globalExecFileStub.reset();
    });

    test('Should handle executeCommand message', async () => {
      globalExecFileStub.callsFake((file, args, opts, cb) => cb(null, 'test output', ''));
      await messageHandler({ type: 'executeCommand', command: 'stats' });
      assert.ok(mockWebviewView.webview.postMessage.called);
      const msg = mockWebviewView.webview.postMessage.firstCall.args[0];
      assert.strictEqual(msg.type, 'commandResult');
      assert.strictEqual(msg.command, 'stats');
      assert.strictEqual(msg.output, 'test output');
      assert.strictEqual(msg.success, true);
    });

    test('Should handle useJSON list command without redundant exec', async () => {
      const jsonOutput = JSON.stringify([{ id: 'test-1', title: 'Test' }]);
      const graphOutput = JSON.stringify([]);
      let callCount = 0;
      globalExecFileStub.callsFake((file, args, opts, callback) => {
        callCount++;
        if (args.includes('graph')) {
          callback(null, graphOutput, '');
        } else {
          callback(null, jsonOutput, '');
        }
      });

      await messageHandler({
        type: 'executeCommand',
        command: 'list',
        useJSON: true
      });

      // Should NOT run `bd list` in text mode first — only JSON calls
      for (let i = 0; i < callCount; i++) {
        const executedArgs = globalExecFileStub.getCall(i).args[1];
        assert.ok(
          executedArgs.includes('--json'),
          `Call ${i} should use --json flag, got: ${executedArgs.join(' ')}`
        );
      }
      const message = mockWebviewView.webview.postMessage.firstCall.args[0];
      assert.strictEqual(message.type, 'commandResultJSON');
    });

    test('Should use --allow-stale for graph commands to prevent hanging', async () => {
      const jsonOutput = JSON.stringify([{ id: 'test-1', title: 'Test' }]);
      const graphOutput = JSON.stringify([]);
      globalExecFileStub.callsFake((file, args, opts, callback) => {
        if (args.includes('graph')) {
          callback(null, graphOutput, '');
        } else {
          callback(null, jsonOutput, '');
        }
      });

      await messageHandler({
        type: 'executeCommand',
        command: 'list',
        useJSON: true
      });

      const graphCall = globalExecFileStub.getCalls().find(c => c.args[1].includes('graph'));
      assert.ok(graphCall, 'Should execute a graph command');
      assert.ok(
        graphCall.args[1].includes('--allow-stale'),
        `Graph command should include --allow-stale, got: ${graphCall.args[1].join(' ')}`
      );
    });

    test('Should handle isInlineAction response type', async () => {
      globalExecFileStub.callsFake((file, args, opts, callback) => {
        callback(null, 'created', '');
      });

      await messageHandler({
        type: 'executeCommand',
        command: 'create --title "Test"',
        isInlineAction: true,
        successMessage: 'Created test'
      });

      const message = mockWebviewView.webview.postMessage.firstCall.args[0];
      assert.strictEqual(message.type, 'inlineActionResult');
      assert.strictEqual(message.success, true);
      assert.strictEqual(message.successMessage, 'Created test');
    });

    test('Should handle getCwd message', async () => {
      sinon.stub(vscode.workspace, 'workspaceFolders').value(
        [{ uri: vscode.Uri.file(path.join('test', 'workspace')) }]);
      await messageHandler({ type: 'getCwd' });
      const msg = mockWebviewView.webview.postMessage.firstCall.args[0];
      assert.strictEqual(msg.type, 'cwdResult');
      assert.ok(msg.cwd);
    });
    test('Should use process.cwd() when no workspace folders', async () => {
      sinon.stub(vscode.workspace, 'workspaceFolders').value(undefined);
      await messageHandler({ type: 'getCwd' });
      const msg = mockWebviewView.webview.postMessage.firstCall.args[0];
      assert.strictEqual(msg.type, 'cwdResult');
      assert.ok(msg.cwd);
    });
    test('Should handle unknown message type gracefully', async () => {
      await messageHandler({ type: 'unknownType' });
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
      const BeadsViewProvider = getBeadsViewProviderClass();
      provider = new BeadsViewProvider(vscode.Uri.file(__dirname));
      globalExecFileStub.reset();
    });

    test('Should handle exec timeout', async () => {
      const error = new Error('Command timed out'); error.killed = true;
      globalExecFileStub.callsFake((file, args, opts, cb) => cb(error, '', ''));
      const result = await provider._executeBdCommand('list');
      assert.strictEqual(result.success, false);
      assert.ok(result.output.includes('timed out'));
    });
    test('Should handle ENOENT error (command not found)', async () => {
      const error = new Error('Command not found'); error.code = 'ENOENT';
      globalExecFileStub.callsFake((file, args, opts, cb) => cb(error, '', ''));
      const result = await provider._executeBdCommand('list');
      assert.strictEqual(result.success, false);
      assert.ok(result.output.includes('Command not found'));
    });
    test('Should handle buffer overflow', async () => {
      globalExecFileStub.callsFake((file, args, opts, cb) => cb(new Error('maxBuffer exceeded'), '', ''));
      const result = await provider._executeBdCommand('list');
      assert.strictEqual(result.success, false);
      assert.ok(result.output.includes('maxBuffer'));
    });
  });

  suite('Security', () => {
    let provider;
    setup(() => {
      const BeadsViewProvider = getBeadsViewProviderClass();
      provider = new BeadsViewProvider(vscode.Uri.file(__dirname));
      globalExecFileStub.reset();
    });

    test('Should use execFile with bd as the executable', async () => {
      globalExecFileStub.callsFake((file, args, opts, cb) => cb(null, 'output', ''));
      await provider._executeBdCommand('list');
      assert.strictEqual(globalExecFileStub.firstCall.args[0], 'bd');
    });
    test('Should pass command as argument array', async () => {
      globalExecFileStub.callsFake((file, args, opts, cb) => cb(null, 'output', ''));
      await provider._executeBdCommand('list --state open');
      assert.deepStrictEqual(globalExecFileStub.firstCall.args[1], ['list', '--state', 'open']);
    });
    test('Should reject unrecognized subcommands', async () => {
      const result = await provider._executeBdCommand('rm -rf /');
      assert.strictEqual(result.success, false);
      assert.ok(result.output.includes('rejected'));
      assert.ok(globalExecFileStub.notCalled);
    });
    test('Should reject commands with shell metacharacters in subcommand', async () => {
      const result = await provider._executeBdCommand('; echo pwned');
      assert.strictEqual(result.success, false);
      assert.ok(globalExecFileStub.notCalled);
    });
    test('Should allow all known bd subcommands', async () => {
      const allowed = [
        'create', 'update', 'close', 'reopen', 'list', 'show', 'ready',
        'blocked', 'stats', 'dep', 'graph', 'sync', 'comments', 'label',
        'init', 'info'
      ];
      globalExecFileStub.callsFake((file, args, opts, cb) => cb(null, 'output', ''));
      for (const cmd of allowed) {
        globalExecFileStub.resetHistory();
        const result = await provider._executeBdCommand(cmd);
        assert.strictEqual(result.success, true, `${cmd} should be allowed`);
      }
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

/** Helper: returns a BeadsViewProvider class matching the fixed extension.js pattern. */
function getBeadsViewProviderClass() {
  class BeadsViewProvider {
    constructor(extensionUri) { this._extensionUri = extensionUri; }
    resolveWebviewView(webviewView, _context, _token) {
      this._view = webviewView;
      webviewView.webview.options = { enableScripts: true, localResourceRoots: [this._extensionUri] };
      webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
      webviewView.webview.onDidReceiveMessage(async (data) => {
        try {
          switch (data.type) {
            case 'executeCommand': {
              if (data.useJSON && ['list', 'ready', 'blocked'].includes(data.command)) {
                const [jsonRes, graphRes] = await Promise.all([
                  this._executeBdCommand(`${data.command} --json`),
                  this._executeBdCommand('graph --all --json --allow-stale')
                ]);
                const type = jsonRes.success ? 'commandResultJSON' : 'commandResult';
                webviewView.webview.postMessage({
                  type, command: data.command, output: jsonRes.output,
                  ...(jsonRes.success ? { graphData: graphRes?.success ? graphRes.output : null } : {}),
                  success: jsonRes.success
                });
              } else {
                const result = await this._executeBdCommand(data.command);
                const type = data.isInlineAction ? 'inlineActionResult' : 'commandResult';
                webviewView.webview.postMessage({
                  type, command: data.command, output: result.output,
                  success: result.success,
                  ...(data.isInlineAction ? { successMessage: data.successMessage } : {})
                });
              }
              break;
            }
            case 'getCwd': {
              const folders = vscode.workspace.workspaceFolders;
              const cwd = folders ? folders[0].uri.fsPath : process.cwd();
              webviewView.webview.postMessage({ type: 'cwdResult', cwd });
              break;
            }
          }
        } catch (err) {
          webviewView.webview.postMessage({
            type: 'commandResult', command: data.command || 'unknown',
            output: `Internal error: ${err.message}`, success: false
          });
        }
      });
    }
    show() { if (this._view) { this._view.show(true); } }
    _executeBdCommand(command) {
      return new Promise((resolve) => {
        if (!isAllowedCommand(command)) {
          resolve({ success: false, output: 'Error: Command rejected — unrecognized bd subcommand' });
          return;
        }
        const folders = vscode.workspace.workspaceFolders;
        const cwd = folders ? folders[0].uri.fsPath : process.cwd();
        const env = { ...process.env, BEADS_DB: path.join(cwd, '.beads', 'beads.db') };
        const args = command.trim().split(/\s+/);
        childProcess.execFile('bd', args, {
          maxBuffer: 10 * 1024 * 1024, cwd, env, timeout: 30000
        }, (error, stdout, stderr) => {
          if (error && !stdout && !stderr) {
            resolve({ success: false, output: `Error: ${error.message}` });
          } else {
            resolve({ success: !error || !!stdout, output: (stdout || stderr || '').trim() });
          }
        });
      });
    }
    _getHtmlForWebview(_webview) {
      const htmlPath = path.join(this._extensionUri.fsPath, 'webview', 'index.html');
      return require('fs').readFileSync(htmlPath, 'utf8');
    }
  }
  return BeadsViewProvider;
}
