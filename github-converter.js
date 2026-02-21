const https = require('https');

/**
 * Make an HTTPS request to the GitHub REST API.
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} apiPath - API path (e.g. /repos/owner/repo/issues)
 * @param {string} token - GitHub access token
 * @param {object} [body] - Request body for POST/PATCH
 * @returns {Promise<object>} Parsed JSON response
 */
function githubApiRequest(method, apiPath, token, body) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: 'api.github.com',
      path: apiPath,
      method,
      headers: {
        'User-Agent': 'beads-ui-vscode',
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    };

    if (body) {
      reqOptions.headers['Content-Type'] = 'application/json';
    }

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { resolve(data); }
        } else {
          let msg;
          try { msg = JSON.parse(data).message || `HTTP ${res.statusCode}`; } catch { msg = `HTTP ${res.statusCode}`; }
          reject(new Error(msg));
        }
      });
    });

    req.on('error', reject);
    if (body) { req.write(JSON.stringify(body)); }
    req.end();
  });
}

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
 * Convert a beads item to a GitHub issue using the GitHub REST API.
 * @param {object} item - Beads issue object
 * @param {object} [options] - Conversion options
 * @param {string} options.token - GitHub access token
 * @param {string} options.owner - Repository owner
 * @param {string} options.repo - Repository name
 * @param {string} [options.assignee] - GitHub username to assign
 * @returns {Promise<{number: number, url: string}>} GitHub issue number and URL
 */
async function convertBeadsItemToGitHubIssue(item, options = {}) {
  if (!item || !item.title) {
    throw new Error('Invalid beads item: title is required');
  }

  const { token, owner, repo } = options;
  if (!token) {
    throw new Error('GitHub token is required. Sign in via the GitHub authentication provider.');
  }
  if (!owner || !repo) {
    throw new Error('GitHub repository not detected. Ensure your workspace has a GitHub remote.');
  }

  const body = buildIssueBody(item);
  const labels = collectLabels(item);
  const assignee = options && typeof options.assignee === 'string' && options.assignee.trim()
    ? options.assignee.trim()
    : null;

  const requestBody = { title: item.title, body };
  if (labels.length > 0) { requestBody.labels = labels; }
  if (assignee) { requestBody.assignees = [assignee]; }

  const result = await githubApiRequest(
    'POST', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
    token, requestBody
  );

  return { number: result.number, url: result.html_url };
}

/**
 * Check the status of a GitHub issue and find linked PRs via the REST API.
 * @param {number} issueNumber - GitHub issue number
 * @param {object} [options] - Options
 * @param {string} options.token - GitHub access token
 * @param {string} options.owner - Repository owner
 * @param {string} options.repo - Repository name
 * @returns {Promise<{issueState: string, pr: {number: number, url: string, state: string, title: string}|null}>}
 */
async function checkGitHubIssueStatus(issueNumber, options = {}) {
  if (!issueNumber || typeof issueNumber !== 'number') {
    throw new Error('Valid issue number is required');
  }

  const { token, owner, repo } = options;
  if (!token || !owner || !repo) {
    throw new Error('GitHub token and repository info are required');
  }

  let issueState;
  try {
    const issueData = await githubApiRequest(
      'GET',
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`,
      token
    );
    issueState = (issueData.state || 'open').toUpperCase();
  } catch (error) {
    throw new Error(`Failed to check issue #${issueNumber}: ${error.message}`);
  }

  let pr = null;
  try {
    const q = encodeURIComponent(`repo:${owner}/${repo} is:pr ${issueNumber}`);
    const searchResult = await githubApiRequest(
      'GET', `/search/issues?q=${q}&per_page=5`, token
    );
    if (searchResult.items && searchResult.items.length > 0) {
      const linked = searchResult.items[0];
      const merged = linked.pull_request && linked.pull_request.merged_at;
      pr = {
        number: linked.number,
        url: linked.html_url,
        state: merged ? 'MERGED' : (linked.state || 'open').toUpperCase(),
        title: linked.title || ''
      };
    }
  } catch {
    // PR search is best-effort
  }

  return { issueState, pr };
}

module.exports = {
  convertBeadsItemToGitHubIssue,
  checkGitHubIssueStatus,
  buildIssueBody,
  collectLabels,
  mapPriorityToLabel,
  mapTypeToLabel,
  githubApiRequest
};
