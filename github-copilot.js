const childProcess = require('child_process');

/**
 * Assign a GitHub Copilot coding agent to an issue.
 *
 * @param {object} params - Assignment parameters
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @param {number|string} params.issueNumber - GitHub issue number
 * @param {string} [params.agent] - Copilot agent identifier
 * @param {string} [params.token] - GitHub token (used as GITHUB_TOKEN)
 * @param {string} [params.cwd] - Working directory for gh CLI
 * @returns {Promise<{ assigned: true, response?: any, agent?: string }>}
 */
async function assignCopilotToIssue(params) {
  const { owner, repo, issueNumber, agent, token, cwd } = params || {};

  if (!owner || !repo) {
    throw new Error('Repository owner and name are required to assign Copilot.');
  }

  const number = Number(issueNumber);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error('A valid GitHub issue number is required to assign Copilot.');
  }

  const args = [
    'api',
    `repos/${owner}/${repo}/issues/${number}/copilot`,
    '--method',
    'POST',
    '-H',
    'Accept: application/vnd.github+json'
  ];

  if (agent) {
    args.push('-f', `agent=${agent}`);
  }

  const execOptions = {};
  if (cwd) {
    execOptions.cwd = cwd;
  }
  execOptions.env = token ? { ...process.env, GITHUB_TOKEN: token } : process.env;

  return new Promise((resolve, reject) => {
    const callback = (error, stdout, stderr) => {
      if (error) {
        const message = stderr || error.message || 'Failed to assign Copilot.';
        if (error.code === 'ENOENT' || message.includes('not found')) {
          return reject(new Error('GitHub CLI (gh) not found. Please install it: https://cli.github.com/'));
        }
        if (/not\s+logged\s+in/i.test(message)) {
          return reject(new Error('Not authenticated with GitHub. Run: gh auth login'));
        }
        if (/404/.test(message)) {
          return reject(new Error('GitHub issue not found or Copilot assignment API unavailable.'));
        }
        return reject(new Error(`Failed to assign Copilot: ${message}`));
      }

      let response = null;
      if (stdout) {
        try {
          response = JSON.parse(stdout);
        } catch {
          response = stdout.trim();
        }
      }

      resolve({ assigned: true, response, agent });
    };

    childProcess.execFile('gh', args, execOptions, callback);
  });
}

module.exports = {
  assignCopilotToIssue
};
