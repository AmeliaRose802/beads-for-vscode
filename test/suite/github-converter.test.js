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
    let execFileStub;
    const childProcess = require('child_process');

    setup(() => {
      execFileStub = sinon.stub(childProcess, 'execFile');
    });

    teardown(() => {
      execFileStub.restore();
    });

    test('should throw error if item has no title', async () => {
      await assert.rejects(
        () => convertBeadsItemToGitHubIssue({}),
        /title is required/
      );
    });

    test('should throw error if item is null', async () => {
      await assert.rejects(
        () => convertBeadsItemToGitHubIssue(null),
        /title is required/
      );
    });

    test('should call gh CLI with correct arguments', async () => {
      execFileStub.callsArgWith(2, null, 'https://github.com/owner/repo/issues/123\n', '');

      const item = {
        id: 'test-123',
        title: 'Test Issue',
        description: 'Test description',
        priority: 1,
        issue_type: 'bug'
      };

      await convertBeadsItemToGitHubIssue(item);

      assert.ok(execFileStub.calledOnce);
      const [command, args] = execFileStub.firstCall.args;
      assert.strictEqual(command, 'gh');
      assert.ok(args.includes('issue'));
      assert.ok(args.includes('create'));
      assert.ok(args.includes('--title'));
      assert.ok(args.includes('Test Issue'));
    });

    test('should return issue number and URL', async () => {
      execFileStub.callsArgWith(2, null, 'https://github.com/owner/repo/issues/456\n', '');

      const item = { id: 'test-123', title: 'Test' };

      const result = await convertBeadsItemToGitHubIssue(item);
      assert.strictEqual(result.number, 456);
      assert.strictEqual(result.url, 'https://github.com/owner/repo/issues/456');
    });

    test('should include labels in gh CLI command', async () => {
      execFileStub.callsArgWith(2, null, 'https://github.com/owner/repo/issues/789\n', '');

      const item = {
        id: 'test-123',
        title: 'Test',
        priority: 1,
        issue_type: 'bug',
        labels: ['backend']
      };

      await convertBeadsItemToGitHubIssue(item);

      const [, args] = execFileStub.firstCall.args;
      const labelIndex = args.indexOf('--label');
      assert.ok(labelIndex >= 0);
      const labelValue = args[labelIndex + 1];
      assert.ok(labelValue.includes('bug'));
      assert.ok(labelValue.includes('priority:high'));
      assert.ok(labelValue.includes('backend'));
    });

    test('should include assignee when provided', async () => {
      execFileStub.callsArgWith(2, null, 'https://github.com/owner/repo/issues/101\n', '');

      const item = { id: 'test-123', title: 'Test' };

      await convertBeadsItemToGitHubIssue(item, undefined, { assignee: 'github-copilot' });

      const [, args] = execFileStub.firstCall.args;
      const assigneeIndex = args.indexOf('--assignee');
      assert.ok(assigneeIndex >= 0);
      assert.strictEqual(args[assigneeIndex + 1], 'github-copilot');
    });

    test('should provide helpful error for missing gh CLI', async () => {
      execFileStub.callsArgWith(2, { code: 'ENOENT', message: 'not found' });

      const item = { id: 'test-123', title: 'Test' };

      await assert.rejects(
        () => convertBeadsItemToGitHubIssue(item),
        /GitHub CLI.*not found/
      );
    });

    test('should provide helpful error for authentication issues', async () => {
      execFileStub.callsArgWith(2, { message: 'not logged in' });

      const item = { id: 'test-123', title: 'Test' };

      await assert.rejects(
        () => convertBeadsItemToGitHubIssue(item),
        /gh auth login/
      );
    });

    test('should provide helpful error for non-git repository', async () => {
      execFileStub.callsArgWith(2, { message: 'not a git repository' });

      const item = { id: 'test-123', title: 'Test' };

      await assert.rejects(
        () => convertBeadsItemToGitHubIssue(item),
        /not linked to GitHub/
      );
    });
  });
});
