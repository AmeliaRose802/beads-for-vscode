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

  if (item.priority != null) {
    labels.push(mapPriorityToLabel(item.priority));
  }

  if (Array.isArray(item.labels)) {
    labels.push(...item.labels);
  }

  return [...new Set(labels)];
}

/**
 * Make a request to the GitHub REST API.
 * @param {string} endpoint - API path (e.g. /repos/owner/repo/issues)
 * @param {object} [opts] - Request options
 * @param {string} [opts.token] - GitHub access token
 * @param {string} [opts.method] - HTTP method (default GET)
 * @param {object} [opts.body] - JSON request body
 * @returns {Promise<object>} Parsed JSON response
 */
async function githubApiRequest(endpoint, opts = {}) {
  const { token, method = 'GET', body } = opts;
  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'beads-ui-vscode',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const url = `https://api.github.com${endpoint}`;
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const errorText = await response.text();
    let message;
    try {
      message = JSON.parse(errorText).message || errorText;
    } catch {
      message = errorText;
    }
    if (response.status === 401) {
      throw new Error('GitHub authentication failed. Sign in again via VS Code.');
    }
    if (response.status === 404) {
      throw new Error(`GitHub resource not found: ${endpoint}`);
    }
    throw new Error(`GitHub API error (${response.status}): ${message}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

/**
 * Convert a beads item to a GitHub issue using the GitHub REST API.
 * @param {object} item - Beads issue object
 * @param {object} [options] - Conversion options
 * @param {string} [options.token] - GitHub access token
 * @param {string} options.owner - Repository owner
 * @param {string} options.repo - Repository name
 * @param {string} [options.assignee] - GitHub username to assign
 * @returns {Promise<{number: number, url: string}>} GitHub issue number and URL
 */
async function convertBeadsItemToGitHubIssue(item, options = {}) {
  if (!item || !item.title) {
    throw new Error('Invalid beads item: title is required');
  }

  const { token, owner, repo, assignee } = options;
  if (!owner || !repo) {
    throw new Error(
      'GitHub repository info required. Ensure your workspace has a GitHub remote.'
    );
  }

  const body = buildIssueBody(item);
  const labels = collectLabels(item);
  const requestBody = { title: item.title, body };

  if (labels.length > 0) {
    requestBody.labels = labels;
  }
  if (assignee) {
    requestBody.assignees = [assignee];
  }

  const result = await githubApiRequest(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
    { token, method: 'POST', body: requestBody }
  );

  return { number: result.number, url: result.html_url };
}

/**
 * Check the status of a GitHub issue and find linked PRs.
 * @param {number} issueNumber - GitHub issue number
 * @param {object} [options] - Options
 * @param {string} [options.token] - GitHub access token
 * @param {string} options.owner - Repository owner
 * @param {string} options.repo - Repository name
 * @returns {Promise<{issueState: string, pr: {number: number, url: string, state: string, title: string}|null}>}
 */
async function checkGitHubIssueStatus(issueNumber, options = {}) {
  if (!issueNumber || typeof issueNumber !== 'number') {
    throw new Error('Valid issue number is required');
  }

  const { token, owner, repo } = options;
  if (!owner || !repo) {
    throw new Error('GitHub repository info required.');
  }

  let issueState;
  try {
    const issue = await githubApiRequest(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`,
      { token }
    );
    issueState = (issue.state || 'open').toUpperCase();
  } catch (error) {
    throw new Error(`Failed to check issue #${issueNumber}: ${error.message}`);
  }

  let pr = null;
  try {
    const q = `repo:${owner}/${repo}+is:pr+${issueNumber}`;
    const searchResult = await githubApiRequest(
      `/search/issues?q=${encodeURIComponent(q)}`,
      { token }
    );
    if (searchResult.items && searchResult.items.length > 0) {
      const linked = searchResult.items[0];
      pr = {
        number: linked.number,
        url: linked.html_url,
        state: (linked.state || 'open').toUpperCase(),
        title: linked.title || ''
      };
    }
  } catch {
    // PR search is best-effort; continue with null
  }

  return { issueState, pr };
}

module.exports = {
  convertBeadsItemToGitHubIssue,
  checkGitHubIssueStatus,
  githubApiRequest,
  buildIssueBody,
  collectLabels,
  mapPriorityToLabel,
  mapTypeToLabel
};
