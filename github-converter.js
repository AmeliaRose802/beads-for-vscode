const childProcess = require('child_process');

/**
 * Map beads priority (0-4) to a GitHub label string.
 * @param {number|string} priority - Beads priority value
 * @returns {string} GitHub-friendly priority label
 */
function mapPriorityToLabel(priority) {
  const raw = typeof priority === 'string' ? priority.replace(/^[pP]/, '') : priority;
  const p = typeof raw === 'string' ? parseInt(raw, 10) : raw;
  const map = {
    0: 'priority:critical',
    1: 'priority:high',
    2: 'priority:medium',
    3: 'priority:low',
    4: 'priority:backlog'
  };
  return map[p] || 'priority:medium';
}

/**
 * Map beads issue type to GitHub label.
 * @param {string} type - Beads issue type
 * @returns {string} GitHub label
 */
function mapTypeToLabel(type) {
  const map = {
    bug: 'bug',
    feature: 'enhancement',
    task: 'task',
    epic: 'epic',
    chore: 'chore'
  };
  return map[type] || type;
}

/**
 * Build the GitHub issue body from beads item fields.
 * @param {object} item - Beads issue object
 * @returns {string} Markdown body for GitHub issue
 */
function buildIssueBody(item) {
  const parts = [];

  if (item.description) {
    parts.push(item.description);
    parts.push('');
  }

  parts.push('---');
  parts.push(`*Converted from beads item \`${item.id}\`*`);

  if (item.assignee) {
    parts.push(`*Original assignee: ${item.assignee}*`);
  }

  return parts.join('\n');
}

/**
 * Collect labels for the GitHub issue from beads fields.
 * @param {object} item - Beads issue object
 * @returns {string[]} Array of label strings
 */
function collectLabels(item) {
  const labels = [];

  if (item.issue_type || item.type) {
    labels.push(mapTypeToLabel(item.issue_type || item.type));
  }

  if (item.priority !== undefined && item.priority !== null) {
    labels.push(mapPriorityToLabel(item.priority));
  }

  if (Array.isArray(item.labels)) {
    labels.push(...item.labels);
  }

  return [...new Set(labels)];
}

/**
 * Convert a beads item to a GitHub issue using the gh CLI.
 * @param {object} item - Beads issue object
 * @param {string} [cwd] - Working directory for repo context
 * @returns {Promise<{number: number, url: string}>} GitHub issue number and URL
 */
async function convertBeadsItemToGitHubIssue(item, cwd, options = {}) {
  if (!item || !item.title) {
    throw new Error('Invalid beads item: title is required');
  }

  const body = buildIssueBody(item);
  const labels = collectLabels(item);
  const assignee = options && typeof options.assignee === 'string' && options.assignee.trim()
    ? options.assignee.trim()
    : null;

  const args = [
    'issue', 'create',
    '--title', item.title,
    '--body', body
  ];

  if (labels.length > 0) {
    args.push('--label', labels.join(','));
  }

  if (assignee) {
    args.push('--assignee', assignee);
  }

  return new Promise((resolve, reject) => {
    const callback = (error, stdout) => {
      if (error) {
        if (error.code === 'ENOENT' || (error.message && error.message.includes('not found'))) {
          return reject(new Error('GitHub CLI (gh) not found. Please install it: https://cli.github.com/'));
        }
        if (error.message && error.message.includes('not logged in')) {
          return reject(new Error('Not authenticated with GitHub. Run: gh auth login'));
        }
        if (error.message && error.message.includes('not a git repository')) {
          return reject(new Error('Not in a git repository or repository not linked to GitHub'));
        }
        return reject(new Error(`Failed to create GitHub issue: ${error.message}`));
      }

      const url = (typeof stdout === 'string' ? stdout : '').trim();
      const match = url.match(/\/issues\/(\d+)$/);
      const number = match ? parseInt(match[1], 10) : null;

      resolve({ number, url });
    };

    if (cwd) {
      childProcess.execFile('gh', args, { cwd }, callback);
    } else {
      childProcess.execFile('gh', args, callback);
    }
  });
}

/**
 * Check the status of a GitHub issue and find linked PRs.
 * @param {number} issueNumber - GitHub issue number
 * @param {string} [cwd] - Working directory for repo context
 * @returns {Promise<{issueState: string, pr: {number: number, url: string, state: string, title: string}|null}>}
 */
async function checkGitHubIssueStatus(issueNumber, cwd) {
  if (!issueNumber || typeof issueNumber !== 'number') {
    throw new Error('Valid issue number is required');
  }

  const execOpts = cwd ? { cwd, timeout: 15000 } : { timeout: 15000 };

  const issueState = await new Promise((resolve, reject) => {
    childProcess.execFile(
      'gh', ['issue', 'view', String(issueNumber), '--json', 'state'],
      execOpts,
      (error, stdout) => {
        if (error) {
          return reject(new Error(`Failed to check issue #${issueNumber}: ${error.message}`));
        }
        try {
          const data = JSON.parse(stdout);
          resolve((data.state || 'OPEN').toUpperCase());
        } catch {
          resolve('UNKNOWN');
        }
      }
    );
  });

  const pr = await new Promise((resolve) => {
    childProcess.execFile(
      'gh', ['pr', 'list', '--search', String(issueNumber), '--json', 'number,url,state,title', '--limit', '5'],
      execOpts,
      (error, stdout) => {
        if (error || !stdout) {
          resolve(null);
          return;
        }
        try {
          const prs = JSON.parse(stdout);
          if (Array.isArray(prs) && prs.length > 0) {
            const linked = prs[0];
            resolve({
              number: linked.number,
              url: linked.url,
              state: (linked.state || 'OPEN').toUpperCase(),
              title: linked.title || ''
            });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      }
    );
  });

  return { issueState, pr };
}

module.exports = {
  convertBeadsItemToGitHubIssue,
  checkGitHubIssueStatus,
  buildIssueBody,
  collectLabels,
  mapPriorityToLabel,
  mapTypeToLabel
};
