const assert = require('assert');
const sinon = require('sinon');
const childProcess = require('child_process');
const {
  parseGitRemoteUrl,
  detectGitHubRepo,
  getGitHubSession,
  getGitHubToken,
  GITHUB_SCOPES
} = require('../../github-auth');

suite('GitHub Auth', () => {
  suite('parseGitRemoteUrl', () => {
    test('should parse HTTPS URL', () => {
      const result = parseGitRemoteUrl('https://github.com/owner/repo.git');
      assert.deepStrictEqual(result, { owner: 'owner', repo: 'repo' });
    });

    test('should parse HTTPS URL without .git suffix', () => {
      const result = parseGitRemoteUrl('https://github.com/owner/repo');
      assert.deepStrictEqual(result, { owner: 'owner', repo: 'repo' });
    });

    test('should parse SSH URL', () => {
      const result = parseGitRemoteUrl('git@github.com:owner/repo.git');
      assert.deepStrictEqual(result, { owner: 'owner', repo: 'repo' });
    });

    test('should parse SSH URL without .git suffix', () => {
      const result = parseGitRemoteUrl('git@github.com:owner/repo');
      assert.deepStrictEqual(result, { owner: 'owner', repo: 'repo' });
    });

    test('should return null for non-GitHub URLs', () => {
      assert.strictEqual(parseGitRemoteUrl('https://gitlab.com/owner/repo.git'), null);
    });

    test('should return null for empty string', () => {
      assert.strictEqual(parseGitRemoteUrl(''), null);
    });

    test('should return null for null input', () => {
      assert.strictEqual(parseGitRemoteUrl(null), null);
    });

    test('should return null for undefined input', () => {
      assert.strictEqual(parseGitRemoteUrl(undefined), null);
    });

    test('should return null for non-string input', () => {
      assert.strictEqual(parseGitRemoteUrl(123), null);
    });
  });

  suite('detectGitHubRepo', () => {
    let execFileStub;

    setup(() => {
      execFileStub = sinon.stub(childProcess, 'execFile');
    });

    teardown(() => {
      execFileStub.restore();
    });

    test('should detect origin remote', async () => {
      execFileStub.callsArgWith(3, null,
        'origin\thttps://github.com/owner/repo.git (fetch)\n' +
        'origin\thttps://github.com/owner/repo.git (push)\n'
      );

      const result = await detectGitHubRepo('/workspace');
      assert.deepStrictEqual(result, { owner: 'owner', repo: 'repo', remote: 'origin' });
    });

    test('should prefer origin over other remotes', async () => {
      execFileStub.callsArgWith(3, null,
        'upstream\thttps://github.com/other/repo.git (fetch)\n' +
        'origin\thttps://github.com/owner/repo.git (fetch)\n'
      );

      const result = await detectGitHubRepo('/workspace');
      assert.strictEqual(result.owner, 'owner');
      assert.strictEqual(result.remote, 'origin');
    });

    test('should fall back to first GitHub remote', async () => {
      execFileStub.callsArgWith(3, null,
        'upstream\thttps://github.com/upstream-owner/repo.git (fetch)\n'
      );

      const result = await detectGitHubRepo('/workspace');
      assert.strictEqual(result.owner, 'upstream-owner');
      assert.strictEqual(result.remote, 'upstream');
    });

    test('should return null on git error', async () => {
      execFileStub.callsArgWith(3, new Error('not a git repo'));

      const result = await detectGitHubRepo('/workspace');
      assert.strictEqual(result, null);
    });

    test('should return null when no GitHub remotes found', async () => {
      execFileStub.callsArgWith(3, null,
        'origin\thttps://gitlab.com/owner/repo.git (fetch)\n'
      );

      const result = await detectGitHubRepo('/workspace');
      assert.strictEqual(result, null);
    });

    test('should return null for empty output', async () => {
      execFileStub.callsArgWith(3, null, '');

      const result = await detectGitHubRepo('/workspace');
      assert.strictEqual(result, null);
    });

    test('should handle SSH remotes', async () => {
      execFileStub.callsArgWith(3, null,
        'origin\tgit@github.com:owner/repo.git (fetch)\n'
      );

      const result = await detectGitHubRepo('/workspace');
      assert.deepStrictEqual(result, { owner: 'owner', repo: 'repo', remote: 'origin' });
    });
  });

  suite('getGitHubSession', () => {
    test('should return session when authenticated', async () => {
      const mockVscode = {
        authentication: {
          getSession: sinon.stub().resolves({
            accessToken: 'test-token-123',
            account: { label: 'testuser', id: '12345' }
          })
        }
      };

      const result = await getGitHubSession(mockVscode);
      assert.deepStrictEqual(result, {
        token: 'test-token-123',
        account: { label: 'testuser', id: '12345' }
      });
    });

    test('should return null when no session exists', async () => {
      const mockVscode = {
        authentication: {
          getSession: sinon.stub().resolves(null)
        }
      };

      const result = await getGitHubSession(mockVscode);
      assert.strictEqual(result, null);
    });

    test('should return null on auth error', async () => {
      const mockVscode = {
        authentication: {
          getSession: sinon.stub().rejects(new Error('Auth failed'))
        }
      };

      const result = await getGitHubSession(mockVscode);
      assert.strictEqual(result, null);
    });

    test('should pass createIfNone option', async () => {
      const mockVscode = {
        authentication: {
          getSession: sinon.stub().resolves(null)
        }
      };

      await getGitHubSession(mockVscode, { createIfNone: true });
      const callArgs = mockVscode.authentication.getSession.firstCall.args;
      assert.strictEqual(callArgs[0], 'github');
      assert.deepStrictEqual(callArgs[1], GITHUB_SCOPES);
      assert.strictEqual(callArgs[2].createIfNone, true);
    });

    test('should pass silent option', async () => {
      const mockVscode = {
        authentication: {
          getSession: sinon.stub().resolves(null)
        }
      };

      await getGitHubSession(mockVscode, { silent: true });
      const callArgs = mockVscode.authentication.getSession.firstCall.args;
      assert.strictEqual(callArgs[2].silent, true);
    });
  });

  suite('getGitHubToken', () => {
    test('should return token when authenticated', async () => {
      const mockVscode = {
        authentication: {
          getSession: sinon.stub().resolves({
            accessToken: 'my-token',
            account: { label: 'user', id: '1' }
          })
        }
      };

      const token = await getGitHubToken(mockVscode);
      assert.strictEqual(token, 'my-token');
    });

    test('should return null when not authenticated', async () => {
      const mockVscode = {
        authentication: {
          getSession: sinon.stub().resolves(null)
        }
      };

      const token = await getGitHubToken(mockVscode);
      assert.strictEqual(token, null);
    });

    test('should pass createIfNone to getSession', async () => {
      const mockVscode = {
        authentication: {
          getSession: sinon.stub().resolves(null)
        }
      };

      await getGitHubToken(mockVscode, true);
      const callArgs = mockVscode.authentication.getSession.firstCall.args;
      assert.strictEqual(callArgs[2].createIfNone, true);
    });
  });

  suite('GITHUB_SCOPES', () => {
    test('should include repo scope', () => {
      assert.ok(GITHUB_SCOPES.includes('repo'));
    });
  });
});
