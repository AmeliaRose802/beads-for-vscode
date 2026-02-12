const assert = require('assert');
const vscode = require('vscode');
const sinon = require('sinon');
const childProcess = require('child_process');

suite('Issue Details Test Suite', () => {
  let globalExecStub;
  let provider;
  let BeadsViewProvider;

  setup(() => {
    // Create global stub for exec to prevent real command execution
    globalExecStub = sinon.stub(childProcess, 'exec');
    
    // Get BeadsViewProvider class
    BeadsViewProvider = getBeadsViewProviderClass();
    
    const context = {
      extensionUri: vscode.Uri.file(__dirname)
    };
    
    provider = new BeadsViewProvider(context.extensionUri);
  });

  teardown(() => {
    sinon.restore();
  });

  suite('_getIssueDetails', () => {
    test('Should successfully retrieve issue details by ID', async () => {
      const mockIssues = [
        {
          id: 'beads_ui-61',
          title: 'Loading item details hangs forever',
          description: 'Test description',
          status: 'in_progress',
          priority: 2,
          issue_type: 'task',
          created_at: '2025-12-08T14:28:43.143414-08:00',
          updated_at: '2025-12-08T14:37:49.4638897-08:00'
        },
        {
          id: 'beads_ui-62',
          title: 'Another issue',
          status: 'open',
          priority: 1,
          issue_type: 'bug'
        }
      ];

      globalExecStub.callsFake((cmd, opts, callback) => {
        callback(null, JSON.stringify(mockIssues), '');
      });

      const details = await provider._getIssueDetails('beads_ui-61');

      assert.ok(details);
      assert.strictEqual(details.id, 'beads_ui-61');
      assert.strictEqual(details.title, 'Loading item details hangs forever');
      assert.strictEqual(details.status, 'in_progress');
      assert.strictEqual(details.priority, 2);
      assert.strictEqual(details.issue_type, 'task');
    });

    test('Should return null when issue not found', async () => {
      const mockIssues = [
        {
          id: 'beads_ui-62',
          title: 'Another issue',
          status: 'open',
          priority: 1
        }
      ];

      globalExecStub.callsFake((cmd, opts, callback) => {
        callback(null, JSON.stringify(mockIssues), '');
      });

      const details = await provider._getIssueDetails('beads_ui-999');

      assert.strictEqual(details, null);
    });

    test('Should return null when bd list command fails', async () => {
      globalExecStub.callsFake((cmd, opts, callback) => {
        callback(new Error('Command failed'), '', '');
      });

      const details = await provider._getIssueDetails('beads_ui-61');

      assert.strictEqual(details, null);
    });

    test('Should return null when JSON parsing fails', async () => {
      globalExecStub.callsFake((cmd, opts, callback) => {
        callback(null, 'invalid json', '');
      });

      const details = await provider._getIssueDetails('beads_ui-61');

      assert.strictEqual(details, null);
    });

    test('Should handle empty issue list', async () => {
      globalExecStub.callsFake((cmd, opts, callback) => {
        callback(null, '[]', '');
      });

      const details = await provider._getIssueDetails('beads_ui-61');

      assert.strictEqual(details, null);
    });

    test('Should use bd list --json command', async () => {
      globalExecStub.callsFake((cmd, opts, callback) => {
        callback(null, '[]', '');
      });

      await provider._getIssueDetails('beads_ui-61');

      assert.ok(globalExecStub.calledOnce);
      const command = globalExecStub.firstCall.args[0];
      assert.ok(command.includes('bd list --json'));
    });

    test('Should handle issues with minimal fields', async () => {
      const mockIssues = [
        {
          id: 'beads_ui-61',
          title: 'Basic issue',
          status: 'open'
        }
      ];

      globalExecStub.callsFake((cmd, opts, callback) => {
        callback(null, JSON.stringify(mockIssues), '');
      });

      const details = await provider._getIssueDetails('beads_ui-61');

      assert.ok(details);
      assert.strictEqual(details.id, 'beads_ui-61');
      assert.strictEqual(details.title, 'Basic issue');
      assert.strictEqual(details.status, 'open');
    });

    test('Should handle all issue fields', async () => {
      const mockIssues = [
        {
          id: 'beads_ui-61',
          content_hash: 'abc123',
          title: 'Complete issue',
          description: 'Full description',
          status: 'in_progress',
          priority: 1,
          issue_type: 'feature',
          created_at: '2025-12-08T14:28:43.143414-08:00',
          updated_at: '2025-12-08T14:37:49.4638897-08:00',
          labels: ['test', 'frontend']
        }
      ];

      globalExecStub.callsFake((cmd, opts, callback) => {
        callback(null, JSON.stringify(mockIssues), '');
      });

      const details = await provider._getIssueDetails('beads_ui-61');

      assert.ok(details);
      assert.strictEqual(details.id, 'beads_ui-61');
      assert.strictEqual(details.content_hash, 'abc123');
      assert.strictEqual(details.title, 'Complete issue');
      assert.strictEqual(details.description, 'Full description');
      assert.strictEqual(details.status, 'in_progress');
      assert.strictEqual(details.priority, 1);
      assert.strictEqual(details.issue_type, 'feature');
      assert.ok(Array.isArray(details.labels));
      assert.strictEqual(details.labels.length, 2);
    });
  });

  suite('Message Handler - getIssueDetails', () => {
    let mockWebviewView;
    let messageHandler;

    setup(() => {
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

      const fsStub = sinon.stub(require('fs'), 'readFileSync').returns('<html></html>');
      provider.resolveWebviewView(mockWebviewView, {}, null);
      fsStub.restore();

      globalExecStub.reset();
    });

    test('Should handle getIssueDetails message and send response', async () => {
      const mockIssues = [
        {
          id: 'beads_ui-61',
          title: 'Test issue',
          status: 'open',
          priority: 2
        }
      ];

      globalExecStub.callsFake((cmd, opts, callback) => {
        callback(null, JSON.stringify(mockIssues), '');
      });

      await messageHandler({
        type: 'getIssueDetails',
        issueId: 'beads_ui-61'
      });

      assert.ok(mockWebviewView.webview.postMessage.called);
      const message = mockWebviewView.webview.postMessage.firstCall.args[0];
      assert.strictEqual(message.type, 'inlineIssueDetails');
      assert.strictEqual(message.issueId, 'beads_ui-61');
      assert.ok(message.details);
      assert.strictEqual(message.details.id, 'beads_ui-61');
      assert.strictEqual(message.details.title, 'Test issue');
    });

    test('Should send null details when issue not found', async () => {
      globalExecStub.callsFake((cmd, opts, callback) => {
        callback(null, '[]', '');
      });

      await messageHandler({
        type: 'getIssueDetails',
        issueId: 'beads_ui-999'
      });

      assert.ok(mockWebviewView.webview.postMessage.called);
      const message = mockWebviewView.webview.postMessage.firstCall.args[0];
      assert.strictEqual(message.type, 'inlineIssueDetails');
      assert.strictEqual(message.issueId, 'beads_ui-999');
      assert.strictEqual(message.details, null);
    });

    test('Should handle command failure gracefully', async () => {
      globalExecStub.callsFake((cmd, opts, callback) => {
        callback(new Error('Command failed'), '', '');
      });

      await messageHandler({
        type: 'getIssueDetails',
        issueId: 'beads_ui-61'
      });

      assert.ok(mockWebviewView.webview.postMessage.called);
      const message = mockWebviewView.webview.postMessage.firstCall.args[0];
      assert.strictEqual(message.type, 'inlineIssueDetails');
      assert.strictEqual(message.issueId, 'beads_ui-61');
      assert.strictEqual(message.details, null);
    });
  });
});

// Helper function to get BeadsViewProvider class with _getIssueDetails
function getBeadsViewProviderClass() {
  const path = require('path');

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
          case 'getIssueDetails': {
            const details = await this._getIssueDetails(data.issueId);
            webviewView.webview.postMessage({
              type: 'inlineIssueDetails',
              issueId: data.issueId,
              details: details
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

    async _getIssueDetails(issueId) {
      try {
        // Get issue details using list command with JSON output
        // Note: bd show doesn't support --json, so we use list and filter
        const result = await this._executeBdCommand(`list --json`);
        
        if (!result.success) {
          console.error('Failed to execute bd list:', result.error);
          return null;
        }

        try {
          const issues = JSON.parse(result.output);
          
          // Find the specific issue by ID
          const issue = issues.find(item => item.id === issueId);
          
          if (!issue) {
            console.error(`Issue ${issueId} not found in list`);
            return null;
          }
          
          return issue;
        } catch (e) {
          console.error('Failed to parse issue details:', e, 'Output:', result.output);
          return null;
        }
      } catch (error) {
        console.error('Error fetching issue details:', error);
        return null;
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
      const htmlPath = path.join(this._extensionUri.fsPath, 'webview.html');
      return fs.readFileSync(htmlPath, 'utf8');
    }
  }

  return BeadsViewProvider;
}
