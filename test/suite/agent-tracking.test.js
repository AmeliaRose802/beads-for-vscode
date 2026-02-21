const assert = require('assert');
const sinon = require('sinon');
const https = require('https');
const { PassThrough } = require('stream');

const {
  checkGitHubIssueStatus
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

const apiOpts = { token: 'test-token', owner: 'octo', repo: 'myrepo' };

suite('Agent Tracking', () => {
  suite('checkGitHubIssueStatus', () => {
    let requestStub;

    setup(() => {
      requestStub = sinon.stub(https, 'request');
    });

    teardown(() => {
      requestStub.restore();
    });

    test('should throw error for missing issue number', async () => {
      await assert.rejects(
        () => checkGitHubIssueStatus(null, apiOpts),
        /Valid issue number is required/
      );
    });

    test('should throw error for non-number issue number', async () => {
      await assert.rejects(
        () => checkGitHubIssueStatus('abc', apiOpts),
        /Valid issue number is required/
      );
    });

    test('should return issue state OPEN', async () => {
      const fakeReq = new PassThrough();
      fakeReq.end = sinon.stub();
      let callCount = 0;
      requestStub.callsFake((opts, cb) => {
        callCount++;
        if (callCount === 1) {
          cb(fakeResponse(200, JSON.stringify({ state: 'open' })));
        } else {
          cb(fakeResponse(200, JSON.stringify({ items: [] })));
        }
        return fakeReq;
      });

      const result = await checkGitHubIssueStatus(123, apiOpts);
      assert.strictEqual(result.issueState, 'OPEN');
      assert.strictEqual(result.pr, null);
    });

    test('should return issue state CLOSED', async () => {
      const fakeReq = new PassThrough();
      fakeReq.end = sinon.stub();
      let callCount = 0;
      requestStub.callsFake((opts, cb) => {
        callCount++;
        if (callCount === 1) {
          cb(fakeResponse(200, JSON.stringify({ state: 'closed' })));
        } else {
          cb(fakeResponse(200, JSON.stringify({ items: [] })));
        }
        return fakeReq;
      });

      const result = await checkGitHubIssueStatus(456, apiOpts);
      assert.strictEqual(result.issueState, 'CLOSED');
    });

    test('should return linked PR info', async () => {
      const fakeReq = new PassThrough();
      fakeReq.end = sinon.stub();
      let callCount = 0;
      requestStub.callsFake((opts, cb) => {
        callCount++;
        if (callCount === 1) {
          cb(fakeResponse(200, JSON.stringify({ state: 'open' })));
        } else {
          cb(fakeResponse(200, JSON.stringify({
            items: [{
              number: 789,
              html_url: 'https://github.com/o/r/pull/789',
              state: 'open',
              title: 'Fix it',
              pull_request: {}
            }]
          })));
        }
        return fakeReq;
      });

      const result = await checkGitHubIssueStatus(123, apiOpts);
      assert.strictEqual(result.issueState, 'OPEN');
      assert.ok(result.pr);
      assert.strictEqual(result.pr.number, 789);
      assert.strictEqual(result.pr.url, 'https://github.com/o/r/pull/789');
      assert.strictEqual(result.pr.state, 'OPEN');
      assert.strictEqual(result.pr.title, 'Fix it');
    });

    test('should handle PR search error gracefully', async () => {
      const fakeReq = new PassThrough();
      fakeReq.end = sinon.stub();
      let callCount = 0;
      requestStub.callsFake((opts, cb) => {
        callCount++;
        if (callCount === 1) {
          cb(fakeResponse(200, JSON.stringify({ state: 'open' })));
        } else {
          cb(fakeResponse(500, '{"message":"Internal Server Error"}'));
        }
        return fakeReq;
      });

      const result = await checkGitHubIssueStatus(123, apiOpts);
      assert.strictEqual(result.issueState, 'OPEN');
      assert.strictEqual(result.pr, null);
    });

    test('should throw on issue fetch error', async () => {
      const fakeReq = new PassThrough();
      fakeReq.end = sinon.stub();
      requestStub.callsFake((opts, cb) => {
        cb(fakeResponse(404, '{"message":"Not Found"}'));
        return fakeReq;
      });

      await assert.rejects(
        () => checkGitHubIssueStatus(999, apiOpts),
        /Failed to check issue #999/
      );
    });

    test('should throw if token or repo info is missing', async () => {
      await assert.rejects(
        () => checkGitHubIssueStatus(123, {}),
        /GitHub token and repository info are required/
      );
    });

    test('should call correct API endpoint', async () => {
      const fakeReq = new PassThrough();
      fakeReq.end = sinon.stub();
      let callCount = 0;
      requestStub.callsFake((opts, cb) => {
        callCount++;
        if (callCount === 1) {
          cb(fakeResponse(200, JSON.stringify({ state: 'open' })));
        } else {
          cb(fakeResponse(200, JSON.stringify({ items: [] })));
        }
        return fakeReq;
      });

      await checkGitHubIssueStatus(123, apiOpts);
      const opts = requestStub.firstCall.args[0];
      assert.strictEqual(opts.hostname, 'api.github.com');
      assert.ok(opts.path.includes('/repos/octo/myrepo/issues/123'));
    });
  });

  suite('deriveAgentStatus', () => {
    // This function is an ES module export - test via message-handler integration
    // The logic is straightforward: pr.MERGED > pr.OPEN > CLOSED > OPEN > dispatched
  });

  suite('message-handler agent tracking integration', () => {
    const { processMessage } = require('../../webview/message-handler');

    /**
     * Build minimal ctx for agent tracking tests.
     * @returns {object}
     */
    function buildCtx() {
      return {
        setIsSuccess: sinon.stub(),
        setIsError: sinon.stub(),
        setOutput: sinon.stub(),
        completeCommandProgress: sinon.stub(),
        handleParallelPhaseDispatch: sinon.stub(),
        trackDispatch: sinon.stub(),
        trackBatchDispatch: sinon.stub(),
        updateAgentStatus: sinon.stub()
      };
    }

    test('githubConversionResult tracks dispatch on success', () => {
      const ctx = buildCtx();
      processMessage({
        type: 'githubConversionResult',
        success: true,
        issueId: 'bd-42',
        url: 'https://github.com/o/r/issues/10',
        number: 10,
        commandKey: 'key1'
      }, ctx);

      assert.ok(ctx.trackDispatch.calledOnce);
      assert.deepStrictEqual(
        ctx.trackDispatch.firstCall.args,
        ['bd-42', 'https://github.com/o/r/issues/10', 10, null]
      );
    });

    test('githubConversionResult does not track on failure', () => {
      const ctx = buildCtx();
      processMessage({
        type: 'githubConversionResult',
        success: false,
        error: 'fail'
      }, ctx);

      assert.ok(ctx.trackDispatch.notCalled);
    });

    test('parallelPhaseDispatchComplete tracks batch results', () => {
      const ctx = buildCtx();
      const results = [
        { success: true, issueId: 'bd-1', url: 'https://github.com/o/r/issues/1', number: 1, assignee: 'copilot' },
        { success: false, issueId: 'bd-2', error: 'fail' }
      ];
      processMessage({
        type: 'parallelPhaseDispatchComplete',
        results,
        successCount: 1,
        failureCount: 1
      }, ctx);

      assert.ok(ctx.handleParallelPhaseDispatch.calledOnce);
      assert.ok(ctx.trackBatchDispatch.calledOnce);
      assert.deepStrictEqual(ctx.trackBatchDispatch.firstCall.args[0], results);
    });

    test('agentStatusResult updates status on success', () => {
      const ctx = buildCtx();
      processMessage({
        type: 'agentStatusResult',
        success: true,
        beadsItemId: 'bd-42',
        issueState: 'CLOSED',
        pr: { number: 5, url: 'https://github.com/o/r/pull/5', state: 'MERGED', title: 'Fix' }
      }, ctx);

      assert.ok(ctx.updateAgentStatus.calledOnce);
      const [id, data] = ctx.updateAgentStatus.firstCall.args;
      assert.strictEqual(id, 'bd-42');
      assert.strictEqual(data.issueState, 'CLOSED');
      assert.strictEqual(data.pr.state, 'MERGED');
    });

    test('agentStatusResult does not update on failure', () => {
      const ctx = buildCtx();
      processMessage({
        type: 'agentStatusResult',
        success: false,
        beadsItemId: 'bd-42',
        error: 'fail'
      }, ctx);

      assert.ok(ctx.updateAgentStatus.notCalled);
    });
  });
});

suite('extension-message-handler checkAgentStatus', () => {
  const githubConverter = require('../../github-converter');
  const checkStatusStub = sinon.stub(githubConverter, 'checkGitHubIssueStatus');
  const { handleWebviewMessage } = require('../../extension-message-handler');

  /**
   * Build mocks for extension handler tests.
   * @returns {{ ctx: object, vscode: object, postMessage: sinon.SinonStub }}
   */
  function buildMocks() {
    const postMessage = sinon.stub();
    const ctx = {
      provider: {
        _executeBdCommand: sinon.stub(),
        _invalidateCache: sinon.stub(),
        _getIssueDetails: sinon.stub(),
        _launchPokePoke: sinon.stub(),
        _getPokePokeManager: sinon.stub().returns({
          stop: sinon.stub().returns({ success: true }),
          getInstances: sinon.stub().returns([]),
          remove: sinon.stub()
        })
      },
      webviewView: { webview: { postMessage } }
    };
    const vscode = {
      workspace: {
        workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
        getConfiguration: sinon.stub().returns({
          get: sinon.stub().returns(['github-copilot'])
        })
      },
      window: {
        createOutputChannel: sinon.stub().returns({ appendLine: sinon.stub() })
      }
    };
    return { ctx, vscode, postMessage };
  }

  setup(() => {
    checkStatusStub.reset();
  });

  test('should post agentStatusResult on success', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    checkStatusStub.resolves({ issueState: 'OPEN', pr: null });

    await handleWebviewMessage(
      { type: 'checkAgentStatus', beadsItemId: 'bd-42', issueNumber: 10 },
      ctx, vscode
    );

    const msg = postMessage.firstCall.args[0];
    assert.strictEqual(msg.type, 'agentStatusResult');
    assert.strictEqual(msg.success, true);
    assert.strictEqual(msg.beadsItemId, 'bd-42');
    assert.strictEqual(msg.issueState, 'OPEN');
  });

  test('should post agentStatusResult on failure', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    checkStatusStub.rejects(new Error('gh not found'));

    await handleWebviewMessage(
      { type: 'checkAgentStatus', beadsItemId: 'bd-42', issueNumber: 10 },
      ctx, vscode
    );

    const msg = postMessage.firstCall.args[0];
    assert.strictEqual(msg.type, 'agentStatusResult');
    assert.strictEqual(msg.success, false);
    assert.ok(msg.error.includes('gh not found'));
  });

  test('should include PR info in result', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    checkStatusStub.resolves({
      issueState: 'OPEN',
      pr: { number: 5, url: 'https://github.com/o/r/pull/5', state: 'OPEN', title: 'Fix' }
    });

    await handleWebviewMessage(
      { type: 'checkAgentStatus', beadsItemId: 'bd-42', issueNumber: 10 },
      ctx, vscode
    );

    const msg = postMessage.firstCall.args[0];
    assert.ok(msg.pr);
    assert.strictEqual(msg.pr.number, 5);
    assert.strictEqual(msg.pr.state, 'OPEN');
  });
});
