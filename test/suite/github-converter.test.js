const assert = require('assert');
const sinon = require('sinon');
const https = require('https');
const { PassThrough } = require('stream');
const {
  convertBeadsItemToGitHubIssue,
  buildIssueBody,
  collectLabels,
  mapPriorityToLabel,
  mapTypeToLabel
} = require('../../github-converter');

/**
 * Create a fake HTTPS response with the given status and body.
 * @param {number} statusCode - HTTP status code
 * @param {string} body - Response body string
 * @returns {PassThrough} Fake response stream
 */
function fakeResponse(statusCode, body) {
  const res = new PassThrough();
  res.statusCode = statusCode;
  process.nextTick(() => { res.emit('data', body); res.emit('end'); });
  return res;
}

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
    let requestStub;
    const apiOpts = { token: 'test-token', owner: 'octo', repo: 'myrepo' };

    setup(() => {
      requestStub = sinon.stub(https, 'request');
    });

    teardown(() => {
      requestStub.restore();
    });

    test('should throw error if item has no title', async () => {
      await assert.rejects(
        () => convertBeadsItemToGitHubIssue({}, apiOpts),
        /title is required/
      );
    });

    test('should throw error if item is null', async () => {
      await assert.rejects(
        () => convertBeadsItemToGitHubIssue(null, apiOpts),
        /title is required/
      );
    });

    test('should throw error if token is missing', async () => {
      await assert.rejects(
        () => convertBeadsItemToGitHubIssue({ title: 'Test' }, { owner: 'o', repo: 'r' }),
        /GitHub token is required/
      );
    });

    test('should throw error if repo info is missing', async () => {
      await assert.rejects(
        () => convertBeadsItemToGitHubIssue({ title: 'Test' }, { token: 'tok' }),
        /GitHub repository not detected/
      );
    });

    test('should call GitHub REST API to create issue', async () => {
      const fakeReq = new PassThrough();
      fakeReq.end = sinon.stub();
      requestStub.callsFake((opts, cb) => {
        cb(fakeResponse(201, JSON.stringify({ number: 123, html_url: 'https://github.com/octo/myrepo/issues/123' })));
        return fakeReq;
      });

      const item = {
        id: 'test-123',
        title: 'Test Issue',
        description: 'Test description',
        priority: 1,
        issue_type: 'bug'
      };

      await convertBeadsItemToGitHubIssue(item, apiOpts);

      assert.ok(requestStub.calledOnce);
      const opts = requestStub.firstCall.args[0];
      assert.strictEqual(opts.hostname, 'api.github.com');
      assert.strictEqual(opts.method, 'POST');
      assert.ok(opts.path.includes('/repos/octo/myrepo/issues'));
    });

    test('should return issue number and URL', async () => {
      const fakeReq = new PassThrough();
      fakeReq.end = sinon.stub();
      requestStub.callsFake((opts, cb) => {
        cb(fakeResponse(201, JSON.stringify({ number: 456, html_url: 'https://github.com/owner/repo/issues/456' })));
        return fakeReq;
      });

      const item = { id: 'test-123', title: 'Test' };
      const result = await convertBeadsItemToGitHubIssue(item, apiOpts);
      assert.strictEqual(result.number, 456);
      assert.strictEqual(result.url, 'https://github.com/owner/repo/issues/456');
    });

    test('should include labels in request body', async () => {
      const fakeReq = new PassThrough();
      fakeReq.end = sinon.stub();
      let writtenBody;
      fakeReq.write = (data) => { writtenBody = JSON.parse(data); };
      requestStub.callsFake((opts, cb) => {
        cb(fakeResponse(201, JSON.stringify({ number: 789, html_url: 'https://github.com/o/r/issues/789' })));
        return fakeReq;
      });

      const item = {
        id: 'test-123',
        title: 'Test',
        priority: 1,
        issue_type: 'bug',
        labels: ['backend']
      };

      await convertBeadsItemToGitHubIssue(item, apiOpts);
      assert.ok(writtenBody.labels.includes('bug'));
      assert.ok(writtenBody.labels.includes('priority:high'));
      assert.ok(writtenBody.labels.includes('backend'));
    });

    test('should include assignee when provided', async () => {
      const fakeReq = new PassThrough();
      fakeReq.end = sinon.stub();
      let writtenBody;
      fakeReq.write = (data) => { writtenBody = JSON.parse(data); };
      requestStub.callsFake((opts, cb) => {
        cb(fakeResponse(201, JSON.stringify({ number: 101, html_url: 'https://github.com/o/r/issues/101' })));
        return fakeReq;
      });

      const item = { id: 'test-123', title: 'Test' };
      await convertBeadsItemToGitHubIssue(item, { ...apiOpts, assignee: 'github-copilot' });
      assert.deepStrictEqual(writtenBody.assignees, ['github-copilot']);
    });

    test('should handle API error responses', async () => {
      const fakeReq = new PassThrough();
      fakeReq.end = sinon.stub();
      requestStub.callsFake((opts, cb) => {
        cb(fakeResponse(422, JSON.stringify({ message: 'Validation Failed' })));
        return fakeReq;
      });

      const item = { id: 'test-123', title: 'Test' };
      await assert.rejects(
        () => convertBeadsItemToGitHubIssue(item, apiOpts),
        /Validation Failed/
      );
    });

    test('should handle authentication errors', async () => {
      const fakeReq = new PassThrough();
      fakeReq.end = sinon.stub();
      requestStub.callsFake((opts, cb) => {
        cb(fakeResponse(401, JSON.stringify({ message: 'Bad credentials' })));
        return fakeReq;
      });

      const item = { id: 'test-123', title: 'Test' };
      await assert.rejects(
        () => convertBeadsItemToGitHubIssue(item, apiOpts),
        /Bad credentials/
      );
    });
  });
});
