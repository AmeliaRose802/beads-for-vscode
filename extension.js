const vscode = require('vscode');
const { exec } = require('child_process');
const path = require('path');

function activate(context) {
  // Auto-initialize bd if not already initialized
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    const workspacePath = workspaceFolders[0].uri.fsPath;
    const beadsDbPath = path.join(workspacePath, '.beads', 'beads.db');
    const fs = require('fs');
    
    if (!fs.existsSync(beadsDbPath)) {
      // Initialize bd quietly
      exec('bd init --quiet', { cwd: workspacePath }, (error, stdout, stderr) => {
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
      switch (data.type) {
        case 'executeCommand': {
          const result = await this._executeBdCommand(data.command);
          
          // Invalidate cache on modifying commands
          const modifyingCommands = ['create', 'update', 'close', 'reopen', 'link', 'dep'];
          const isModifying = modifyingCommands.some(cmd => data.command.includes(cmd));
          if (isModifying) {
            this._invalidateCache();
          }
          
          // Check if this is a list --json command for editing
          if (data.command.includes('list') && data.command.includes('--json') && data.command.includes('--id')) {
            try {
              const issues = JSON.parse(result.output);
              // Send the first issue (should be the only one since we filtered by ID)
              if (issues && issues.length > 0) {
                webviewView.webview.postMessage({
                  type: 'issueDetails',
                  issue: issues[0]
                });
              }
            } catch (e) {
              // If JSON parsing fails, treat as regular command
              webviewView.webview.postMessage({
                type: 'commandResult',
                command: data.command,
                ...result
              });
            }
          } else if (data.useJSON && (data.command === 'list' || data.command === 'ready' || data.command === 'blocked')) {
            // Handle list/ready/blocked commands with JSON output
            const jsonCommand = `${data.command} --json`;
            const jsonResult = await this._executeBdCommand(jsonCommand);
            if (jsonResult.success) {
              webviewView.webview.postMessage({
                type: 'commandResultJSON',
                command: data.command,
                output: jsonResult.output,
                success: true
              });
            } else {
              webviewView.webview.postMessage({
                type: 'commandResult',
                command: data.command,
                ...result
              });
            }
          } else if (data.isInlineAction) {
            // Handle inline action with proper success/failure feedback
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
          const suggestions = await this._getAISuggestions(data.title, data.currentDescription);
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
        env: env
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

  async _getAISuggestions(title, currentDescription) {
    try {
      // Get all issues for context
      const listResult = await this._executeBdCommand('list --json');
      let existingIssues = [];
      
      try {
        existingIssues = JSON.parse(listResult.output);
      } catch (e) {
        // If parsing fails, continue without existing issues context
        console.log('Could not parse existing issues:', e);
      }

      // Get workspace context
      const workspaceFiles = await this._getWorkspaceContext();

      // Build prompt for AI
      const prompt = this._buildAIPrompt(title, currentDescription, existingIssues, workspaceFiles);

      // Call VS Code Language Model API
      const models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'gpt-4o'
      });

      if (models.length === 0) {
        return {
          error: 'No language model available. Please ensure GitHub Copilot is enabled.'
        };
      }

      const model = models[0];
      const messages = [
        vscode.LanguageModelChatMessage.User(prompt)
      ];

      const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
      
      let responseText = '';
      for await (const chunk of response.text) {
        responseText += chunk;
      }

      // Parse AI response
      const suggestions = this._parseAIResponse(responseText, existingIssues);
      
      return { suggestions };
    } catch (error) {
      console.error('AI Suggestion Error:', error);
      return {
        error: error.message || 'Failed to get AI suggestions'
      };
    }
  }

  async _getWorkspaceContext() {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) return '';

      // Get recently opened files
      const recentFiles = [];
      const tabs = vscode.window.tabGroups.all
        .flatMap(group => group.tabs)
        .filter(tab => tab.input instanceof vscode.TabInputText)
        .slice(0, 5); // Limit to 5 most recent

      for (const tab of tabs) {
        const uri = tab.input.uri;
        const relativePath = vscode.workspace.asRelativePath(uri);
        recentFiles.push(relativePath);
      }

      return recentFiles.join(', ');
    } catch (error) {
      return '';
    }
  }

  _buildAIPrompt(title, currentDescription, existingIssues, workspaceFiles) {
    // Filter and organize issues for better suggestions
    const openIssues = existingIssues.filter(i => i.status === 'open' || i.status === 'in_progress');
    const epics = openIssues.filter(i => i.issue_type === 'epic');
    const features = openIssues.filter(i => i.issue_type === 'feature');
    const recentIssues = openIssues.slice(0, 15);
    
    const epicsSummary = epics.length > 0 
      ? epics.map(issue => `  • ${issue.id}: ${issue.title}`).join('\n')
      : '  (none)';
    
    const featuresSummary = features.length > 0
      ? features.map(issue => `  • ${issue.id}: ${issue.title}`).join('\n')
      : '  (none)';
    
    const recentSummary = recentIssues.map(issue => 
      `  • ${issue.id}: [${issue.issue_type}] [P${issue.priority}] ${issue.title}`
    ).join('\n');

    return `You are analyzing a new issue for a project management system called "beads". Based on the title and context, suggest the most appropriate issue type, priority, and any related/parent issues.

ISSUE TITLE: "${title}"
CURRENT DESCRIPTION: "${currentDescription || '(none)'}"

AVAILABLE EPICS (for parent relationships):
${epicsSummary}

AVAILABLE FEATURES (for parent relationships):
${featuresSummary}

RECENT OPEN ISSUES (for related relationships):
${recentSummary}

RECENTLY OPENED FILES: ${workspaceFiles || '(none)'}

ISSUE TYPES:
- bug: Something broken or not working
- feature: New functionality or enhancement
- task: General work item (tests, docs, refactoring)
- epic: Large feature with subtasks
- chore: Maintenance, dependencies, tooling

PRIORITIES:
- 0: Critical (security, data loss, broken builds)
- 1: High (major features, important bugs)
- 2: Medium (default, nice-to-have)
- 3: Low (polish, optimization)
- 4: Backlog (future ideas)

LINKING GUIDANCE:
- **IMPORTANT**: Always try to suggest at least one relationship (parent, related, or blocks)
- Use --parent for hierarchical relationships (task → feature → epic)
- Use --related for issues that are connected but not hierarchical
- Use --blocks if this issue must be done before another
- Look for keyword matches in titles to find related issues
- Consider the issue type when suggesting parents (tasks usually have feature/epic parents)
- If you find similar topics or themes, suggest --related links
- Even partial keyword matches should suggest a --related link

Analyze the issue title and provide suggestions in this EXACT JSON format (no markdown, just raw JSON):
{
  "type": "bug|feature|task|epic|chore",
  "priority": 0-4,
  "description": "Brief explanation of why this type/priority was chosen and what relationships you found (1-2 sentences)",
  "links": "suggested dependency links like '--parent beads_ui-5 --related beads_ui-10' (or empty string if none)"
}

Consider:
1. Keywords in title (e.g., "fix" = bug, "add" = feature, "update" = task)
2. Urgency indicators (e.g., "urgent", "asap", "broken" = higher priority)
3. Scope (e.g., "small", "refactor" = task, "implement feature" = feature)
4. Related issues based on similar topics, keywords, or file context
5. Appropriate parent based on issue type and available epics/features

Return ONLY the JSON object, no other text.`;
  }

  _parseAIResponse(responseText, _existingIssues) {
    try {
      // Try to extract JSON from response (in case AI adds explanation)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate the response
      const validTypes = ['bug', 'feature', 'task', 'epic', 'chore'];
      if (!validTypes.includes(parsed.type)) {
        parsed.type = 'task'; // fallback
      }

      if (typeof parsed.priority !== 'number' || parsed.priority < 0 || parsed.priority > 4) {
        parsed.priority = 2; // fallback to medium
      }

      // Validate link format if provided
      if (parsed.links && parsed.links.trim()) {
        const linkPattern = /--(parent|blocks|related|discovered-from)\s+[\w-]+/;
        if (!linkPattern.test(parsed.links)) {
          parsed.links = ''; // Clear invalid links
        }
      }

      return parsed;
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      // Return sensible defaults
      return {
        type: 'task',
        priority: 2,
        description: 'Could not parse AI suggestions. Using defaults.',
        links: ''
      };
    }
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

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
