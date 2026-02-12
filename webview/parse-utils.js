/**
 * Parsing utilities for bd command output.
 * @module webview/parse-utils
 */

/**
 * Parse JSON output from bd list/ready/blocked commands into structured data.
 * @param {string} jsonOutput - Raw JSON string from bd command
 * @param {string} command - The command that produced this output
 * @returns {{ type: string, command: string, header?: string, openIssues?: Array, closedIssues?: Array, message?: string }}
 */
function parseListJSON(jsonOutput, command) {
  try {
    const issues = JSON.parse(jsonOutput);
    const openIssues = [];
    const closedIssues = [];

    issues.forEach(issue => {
      const normalizedIssue = {
        id: issue.id,
        title: issue.title,
        type: issue.issue_type || 'task',
        priority: `p${issue.priority}`,
        status: issue.status,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        closed_at: issue.closed_at,
        description: issue.description,
        assignee: issue.assignee,
        dependency_count: issue.dependency_count || 0,
        dependent_count: issue.dependent_count || 0
      };

      if (issue.status === 'closed') {
        closedIssues.push(normalizedIssue);
      } else {
        openIssues.push(normalizedIssue);
      }
    });

    closedIssues.sort((a, b) => {
      if (a.closed_at && b.closed_at) {
        return new Date(b.closed_at) - new Date(a.closed_at);
      }
      return 0;
    });

    return {
      type: 'list',
      command,
      header: `Found ${openIssues.length} issue${openIssues.length !== 1 ? 's' : ''}`,
      openIssues,
      closedIssues
    };
  } catch (error) {
    console.error('Failed to parse JSON list output:', error);
    return { type: 'error', message: 'Failed to parse issue list', command };
  }
}

/**
 * Parse text output from bd stats command into structured data.
 * @param {string} text - Raw text from bd stats
 * @returns {{ type: string, header: string, stats: Object }}
 */
function parseStatsOutput(text) {
  const lines = text.split('\n');
  const stats = {};
  let header = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.includes('Statistics')) {
      header = trimmed;
      continue;
    }

    const match = trimmed.match(/^([^:]+):\s+(.+)$/);
    if (match) {
      const [, key, value] = match;
      stats[key.trim()] = value.trim();
    }
  }

  return { type: 'stats', header, stats };
}

module.exports = { parseListJSON, parseStatsOutput };
