const childProcess = require('child_process');

/**
 * GitHub OAuth scopes needed for issue creation and agent assignment.
 * @type {string[]}
 */
const GITHUB_SCOPES = ['repo'];

/**
 * Parse a git remote URL to extract owner and repo.
 * Supports HTTPS, SSH, and git:// URLs.
 * @param {string} url - The git remote URL
 * @returns {{ owner: string, repo: string } | null} Parsed owner/repo or null
 */
function parseGitRemoteUrl(url) {
  if (!url || typeof url !== 'string') return null;

  // SSH: git@github.com:owner/repo.git
  const sshMatch = url.match(/github\.com[:/]([^/]+)\/([^/\s]+?)(?:\.git)?\s*$/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  // HTTPS: https://github.com/owner/repo.git
  const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/\s]+?)(?:\.git)?\s*$/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  return null;
}

/**
 * Detect the GitHub repository from git remotes in the given directory.
 * Prefers the "origin" remote; falls back to the first GitHub remote found.
 * @param {string} cwd - Working directory to run git commands in
 * @returns {Promise<{ owner: string, repo: string, remote: string } | null>}
 */
function detectGitHubRepo(cwd) {
  return new Promise((resolve) => {
    childProcess.execFile('git', ['remote', '-v'], { cwd, timeout: 5000 }, (error, stdout) => {
      if (error || !stdout) {
        resolve(null);
        return;
      }

      const lines = stdout.trim().split('\n');
      let originResult = null;
      let firstResult = null;

      for (const line of lines) {
        // Each line: "remoteName\turl (fetch|push)"
        const parts = line.split(/\s+/);
        if (parts.length < 2) continue;

        const remoteName = parts[0];
        const remoteUrl = parts[1];
        const parsed = parseGitRemoteUrl(remoteUrl);

        if (!parsed) continue;

        if (!firstResult) {
          firstResult = { ...parsed, remote: remoteName };
        }
        if (remoteName === 'origin') {
          originResult = { ...parsed, remote: remoteName };
        }
      }

      resolve(originResult || firstResult);
    });
  });
}

/**
 * Get a GitHub authentication session from VS Code's built-in auth provider.
 * Prompts the user to sign in if no session exists and createIfNone is true.
 * @param {import('vscode')} vscode - The VS Code API
 * @param {{ createIfNone?: boolean, silent?: boolean }} [options] - Auth options
 * @returns {Promise<{ token: string, account: { label: string, id: string } } | null>}
 */
async function getGitHubSession(vscode, options = {}) {
  const { createIfNone = false, silent = false } = options;

  try {
    const session = await vscode.authentication.getSession('github', GITHUB_SCOPES, {
      createIfNone,
      silent
    });

    if (!session) return null;

    return {
      token: session.accessToken,
      account: {
        label: session.account.label,
        id: session.account.id
      }
    };
  } catch {
    return null;
  }
}

/**
 * Get just the GitHub access token, prompting sign-in if needed.
 * @param {import('vscode')} vscode - The VS Code API
 * @param {boolean} [createIfNone=false] - Whether to prompt for sign-in
 * @returns {Promise<string | null>} The access token or null
 */
async function getGitHubToken(vscode, createIfNone = false) {
  const session = await getGitHubSession(vscode, { createIfNone });
  return session ? session.token : null;
}

module.exports = {
  getGitHubSession,
  getGitHubToken,
  detectGitHubRepo,
  parseGitRemoteUrl,
  GITHUB_SCOPES
};
