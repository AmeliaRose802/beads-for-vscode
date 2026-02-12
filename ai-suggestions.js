/**
 * AI suggestion utilities for the Beads VS Code extension.
 * @module ai-suggestions
 */

/**
 * Get AI-powered suggestions for a new issue.
 * @param {Function} executeBdCommand - Function to run bd commands
 * @param {string} title - Issue title
 * @param {string} currentDescription - Current description text
 * @returns {Promise<{suggestions?: Object, error?: string}>}
 */
async function getAISuggestions(executeBdCommand, title, currentDescription) {
  const vscode = require('vscode');
  try {
    const listResult = await executeBdCommand('list --json');
    let existingIssues = [];

    try {
      existingIssues = JSON.parse(listResult.output);
    } catch (_e) {
      console.log('Could not parse existing issues');
    }

    const workspaceFiles = await getWorkspaceContext();
    const prompt = buildAIPrompt(title, currentDescription, existingIssues, workspaceFiles);

    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o'
    });

    if (models.length === 0) {
      return { error: 'No language model available. Please ensure GitHub Copilot is enabled.' };
    }

    const messages = [vscode.LanguageModelChatMessage.User(prompt)];
    const response = await models[0].sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

    let responseText = '';
    for await (const chunk of response.text) {
      responseText += chunk;
    }

    return { suggestions: parseAIResponse(responseText) };
  } catch (error) {
    console.error('AI Suggestion Error:', error);
    return { error: error.message || 'Failed to get AI suggestions' };
  }
}

/**
 * Get recently opened workspace files for context.
 * @returns {Promise<string>}
 */
async function getWorkspaceContext() {
  const vscode = require('vscode');
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return '';

    const tabs = vscode.window.tabGroups.all
      .flatMap(group => group.tabs)
      .filter(tab => tab.input instanceof vscode.TabInputText)
      .slice(0, 5);

    return tabs.map(tab => vscode.workspace.asRelativePath(tab.input.uri)).join(', ');
  } catch (_error) {
    return '';
  }
}

/**
 * Build the AI prompt for issue analysis.
 * @param {string} title - Issue title
 * @param {string} currentDescription - Current description
 * @param {Array} existingIssues - List of existing issues
 * @param {string} workspaceFiles - Recently opened files
 * @returns {string}
 */
function buildAIPrompt(title, currentDescription, existingIssues, workspaceFiles) {
  const openIssues = existingIssues.filter(i => i.status === 'open' || i.status === 'in_progress');
  const epics = openIssues.filter(i => i.issue_type === 'epic');
  const features = openIssues.filter(i => i.issue_type === 'feature');
  const recentIssues = openIssues.slice(0, 15);

  const summarize = (items, format) => items.length > 0
    ? items.map(format).join('\n')
    : '  (none)';

  const epicsSummary = summarize(epics, i => `  • ${i.id}: ${i.title}`);
  const featuresSummary = summarize(features, i => `  • ${i.id}: ${i.title}`);
  const recentSummary = summarize(recentIssues, i => `  • ${i.id}: [${i.issue_type}] [P${i.priority}] ${i.title}`);

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

/**
 * Parse the AI response text into structured suggestions.
 * @param {string} responseText - Raw AI response
 * @returns {{ type: string, priority: number, description: string, links: string }}
 */
function parseAIResponse(responseText) {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');

    const parsed = JSON.parse(jsonMatch[0]);

    const validTypes = ['bug', 'feature', 'task', 'epic', 'chore'];
    if (!validTypes.includes(parsed.type)) parsed.type = 'task';
    if (typeof parsed.priority !== 'number' || parsed.priority < 0 || parsed.priority > 4) {
      parsed.priority = 2;
    }
    if (parsed.links && parsed.links.trim()) {
      const linkPattern = /--(parent|blocks|related|discovered-from)\s+[\w-]+/;
      if (!linkPattern.test(parsed.links)) parsed.links = '';
    }

    return parsed;
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    return { type: 'task', priority: 2, description: 'Could not parse AI suggestions. Using defaults.', links: '' };
  }
}

module.exports = { getAISuggestions, parseAIResponse, buildAIPrompt };
