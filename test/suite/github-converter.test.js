const assert = require('assert');
const sinon = require('sinon');
const {
  convertBeadsItemToGitHubIssue,
  buildIssueBody,
  collectLabels,
  mapPriorityToLabel,
  mapTypeToLabel
} = require('../../github-converter');

suite('GitHub Converter', () => {
  suite('mapPriorityToLabel', () => {
    test('should map priority 0 to critical', () => {
      assert.strictEqual(mapPriorityToLabel(0), 'priority:critical');
    });

    test('should map priority 1 to high', () => {
      assert.strictEqual(mapPriorityToLabel(1), 'priority:high');
    });

    test('should map priority 2 to medium', () => {
      assert.strictEqual(mapPriorityToLabel(2), 'priority:medium');
    });

    test('should map priority 3 to low', () => {
      assert.strictEqual(mapPriorityToLabel(3), 'priority:low');
    });

    test('should map priority 4 to backlog', () => {
      assert.strictEqual(mapPriorityToLabel(4), 'priority:backlog');
    });

    test('should handle string priority', () => {
      assert.strictEqual(mapPriorityToLabel('2'), 'priority:medium');
    });

    test('should default to medium for unknown priority', () => {
      assert.strictEqual(mapPriorityToLabel(99), 'priority:medium');
    });
  });

  suite('mapTypeToLabel', () => {
    test('should map bug to bug', () => {
      assert.strictEqual(mapTypeToLabel('bug'), 'bug');
    });

    test('should map feature to enhancement', () => {
      assert.strictEqual(mapTypeToLabel('feature'), 'enhancement');
    });

    test('should map task to task', () => {
      assert.strictEqual(mapTypeToLabel('task'), 'task');
    });

    test('should map epic to epic', () => {
      assert.strictEqual(mapTypeToLabel('epic'), 'epic');
    });

    test('should map chore to chore', () => {
      assert.strictEqual(mapTypeToLabel('chore'), 'chore');
    });

    test('should pass through unknown types', () => {
      assert.strictEqual(mapTypeToLabel('custom'), 'custom');
    });
  });

  suite('buildIssueBody', () => {
    test('should include description if present', () => {
      const item = { id: 'test-123', title: 'Test', description: 'This is a test' };
      const body = buildIssueBody(item);
      assert.ok(body.includes('This is a test'));
    });

    test('should include beads item ID reference', () => {
      const item = { id: 'test-123', title: 'Test' };
      const body = buildIssueBody(item);
      assert.ok(body.includes('test-123'));
    });

    test('should include assignee if present', () => {
      const item = { id: 'test-123', title: 'Test', assignee: 'john@example.com' };
      const body = buildIssueBody(item);
      assert.ok(body.includes('john@example.com'));
    });

    test('should work with minimal item', () => {
      const item = { id: 'test-123', title: 'Test' };
      const body = buildIssueBody(item);
      assert.ok(typeof body === 'string');
      assert.ok(body.length > 0);
    });
  });

  suite('collectLabels', () => {
    test('should collect type label', () => {
      const labels = collectLabels({ id: 'test-123', issue_type: 'bug' });
      assert.ok(labels.includes('bug'));
    });

    test('should collect priority label', () => {
      const labels = collectLabels({ id: 'test-123', priority: 1 });
      assert.ok(labels.includes('priority:high'));
    });

    test('should collect custom labels', () => {
      const labels = collectLabels({ id: 'test-123', labels: ['backend', 'urgent'] });
      assert.ok(labels.includes('backend'));
      assert.ok(labels.includes('urgent'));
    });

    test('should remove duplicate labels', () => {
      const labels = collectLabels({ id: 'test-123', issue_type: 'bug', labels: ['bug', 'critical'] });
      const bugCount = labels.filter(l => l === 'bug').length;
      assert.strictEqual(bugCount, 1);
    });

    test('should use type field as fallback', () => {
      const labels = collectLabels({ id: 'test-123', type: 'feature' });
      assert.ok(labels.includes('enhancement'));
    });

    test('should handle priority 0', () => {
      const labels = collectLabels({ id: 'test-123', priority: 0 });
      assert.ok(labels.includes('priority:critical'));
    });
  });

  suite('convertBeadsItemToGitHubIssue', () => {
    let fetchStub;
    const defaultOpts = { token: 'test-token', owner: 'testowner', repo: 'testrepo' };

    setup(() => {
      fetchStub = sinon.stub(global, 'fetch');
    });

    teardown(() => {
      fetchStub.restore();
    });

    test('should throw error if item has no title', async () => {
      await assert.rejects(
        () => convertBeadsItemToGitHubIssue({}, defaultOpts),
        /title is required/
      );
    });

    test('should throw error if item is null', async () => {
      await assert.rejects(
        () => convertBeadsItemToGitHubIssue(null, defaultOpts),
        /title is required/
      );
    });

    test('should throw error when repo info missing', async () => {
      await assert.rejects(
        () => convertBeadsItemToGitHubIssue({ id: 'test-123', title: 'Test' }, {}),
        /GitHub repository info required/
      );
    });

    test('should call GitHub REST API with correct endpoint', async () => {
      fetchStub.resolves({
        ok: true,
        text: async () => JSON.stringify({ number: 123, html_url: 'https://github.com/testowner/testrepo/issues/123' })
      });

      const item = {
        id: 'test-123',
        title: 'Test Issue',
        description: 'Test description',
        priority: 1,
        issue_type: 'bug'
      };

      await convertBeadsItemToGitHubIssue(item, defaultOpts);

      assert.ok(fetchStub.calledOnce);
      const [url, opts] = fetchStub.firstCall.args;
      assert.ok(url.includes('/repos/testowner/testrepo/issues'));
      assert.strictEqual(opts.method, 'POST');
      const body = JSON.parse(opts.body);
      assert.strictEqual(body.title, 'Test Issue');
    });

    test('should return issue number and URL', async () => {
      fetchStub.resolves({
        ok: true,
        text: async () => JSON.stringify({ number: 456, html_url: 'https://github.com/testowner/testrepo/issues/456' })
      });

      const item = { id: 'test-123', title: 'Test' };

      const result = await convertBeadsItemToGitHubIssue(item, defaultOpts);
      assert.strictEqual(result.number, 456);
      assert.strictEqual(result.url, 'https://github.com/testowner/testrepo/issues/456');
    });

    test('should include labels in API request', async () => {
      fetchStub.resolves({
        ok: true,
        text: async () => JSON.stringify({ number: 789, html_url: 'https://github.com/testowner/testrepo/issues/789' })
      });

      const item = {
        id: 'test-123',
        title: 'Test',
        priority: 1,
        issue_type: 'bug',
        labels: ['backend']
      };

      await convertBeadsItemToGitHubIssue(item, defaultOpts);

      const body = JSON.parse(fetchStub.firstCall.args[1].body);
      assert.ok(body.labels.includes('bug'));
      assert.ok(body.labels.includes('priority:high'));
      assert.ok(body.labels.includes('backend'));
    });

    test('should include assignee when provided', async () => {
      fetchStub.resolves({
        ok: true,
        text: async () => JSON.stringify({ number: 101, html_url: 'https://github.com/testowner/testrepo/issues/101' })
      });

      const item = { id: 'test-123', title: 'Test' };

      await convertBeadsItemToGitHubIssue(item, { ...defaultOpts, assignee: 'github-copilot' });

      const body = JSON.parse(fetchStub.firstCall.args[1].body);
      assert.deepStrictEqual(body.assignees, ['github-copilot']);
    });

    test('should throw error for authentication failure', async () => {
      fetchStub.resolves({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ message: 'Bad credentials' })
      });

      const item = { id: 'test-123', title: 'Test' };

      await assert.rejects(
        () => convertBeadsItemToGitHubIssue(item, defaultOpts),
        /authentication failed/
      );
    });

    test('should throw error for API failure', async () => {
      fetchStub.resolves({
        ok: false,
        status: 422,
        text: async () => JSON.stringify({ message: 'Validation Failed' })
      });

      const item = { id: 'test-123', title: 'Test' };

      await assert.rejects(
        () => convertBeadsItemToGitHubIssue(item, defaultOpts),
        /GitHub API error.*422/
      );
    });
  });
});
