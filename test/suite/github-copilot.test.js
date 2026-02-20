const assert = require('assert');
const sinon = require('sinon');
const childProcess = require('child_process');
const { assignCopilotToIssue } = require('../../github-copilot');

suite('github-copilot', () => {
  let execFileStub;

  setup(() => {
    execFileStub = sinon.stub(childProcess, 'execFile');
  });

  teardown(() => {
    execFileStub.restore();
  });

  test('validates required inputs', async () => {
    await assert.rejects(
      () => assignCopilotToIssue({ owner: '', repo: 'repo', issueNumber: 1 }),
      /Repository owner/
    );
    await assert.rejects(
      () => assignCopilotToIssue({ owner: 'octo', repo: 'repo', issueNumber: 0 }),
      /valid GitHub issue number/
    );
  });

  test('calls gh api with agent and token', async () => {
    execFileStub.callsArgWith(3, null, '{"ok":true}', '');

    await assignCopilotToIssue({
      owner: 'octo',
      repo: 'repo',
      issueNumber: 7,
      agent: 'github-copilot',
      token: 'tok',
      cwd: '/workspace'
    });

    const [, args, options] = execFileStub.firstCall.args;
    assert.strictEqual(args[0], 'api');
    assert.ok(args.includes('repos/octo/repo/issues/7/copilot'));
    assert.ok(args.includes('--method'));
    assert.ok(args.includes('POST'));
    assert.ok(args.includes('-f'));
    assert.ok(args.includes('agent=github-copilot'));
    assert.strictEqual(options.cwd, '/workspace');
    assert.strictEqual(options.env.GITHUB_TOKEN, 'tok');
  });

  test('surfaces gh CLI missing error', async () => {
    execFileStub.callsArgWith(3, { code: 'ENOENT', message: 'not found' }, '', 'not found');

    await assert.rejects(
      () => assignCopilotToIssue({ owner: 'octo', repo: 'repo', issueNumber: 7 }),
      /GitHub CLI/
    );
  });

  test('surfaces authentication errors', async () => {
    execFileStub.callsArgWith(3, { message: 'not logged in' }, '', 'not logged in');

    await assert.rejects(
      () => assignCopilotToIssue({ owner: 'octo', repo: 'repo', issueNumber: 7 }),
      /auth login/
    );
  });
});
