const assert = require('assert');
const sinon = require('sinon');

const {
  checkGitHubIssueStatus
} = require('../../github-converter');

suite('Agent Tracking', () => {
  suite('checkGitHubIssueStatus', () => {
    let fetchStub;
    const defaultOpts = { token: 'test-token', owner: 'testowner', repo: 'testrepo' };

    setup(() => {
      fetchStub = sinon.stub(global, 'fetch');
    });

    teardown(() => {
      fetchStub.restore();
    });

    test('should throw error for missing issue number', async () => {
      await assert.rejects(
        () => checkGitHubIssueStatus(null, defaultOpts),
        /Valid issue number is required/
      );
    });

    test('should throw error for non-number issue number', async () => {
      await assert.rejects(
        () => checkGitHubIssueStatus('abc', defaultOpts),
        /Valid issue number is required/
      );
    });

    test('should throw error when repo info missing', async () => {
      await assert.rejects(
        () => checkGitHubIssueStatus(123, {}),
        /GitHub repository info required/
      );
    });

    test('should return issue state OPEN', async () => {
      fetchStub.onFirstCall().resolves({
        ok: true,
        text: async () => JSON.stringify({ state: 'open' })
      });
      fetchStub.onSecondCall().resolves({
        ok: true,
        text: async () => JSON.stringify({ items: [] })
      });

      const result = await checkGitHubIssueStatus(123, defaultOpts);
      assert.strictEqual(result.issueState, 'OPEN');
      assert.strictEqual(result.pr, null);
    });

    test('should return issue state CLOSED', async () => {
      fetchStub.onFirstCall().resolves({
        ok: true,
        text: async () => JSON.stringify({ state: 'closed' })
      });
      fetchStub.onSecondCall().resolves({
        ok: true,
        text: async () => JSON.stringify({ items: [] })
      });

      const result = await checkGitHubIssueStatus(456, defaultOpts);
      assert.strictEqual(result.issueState, 'CLOSED');
    });

    test('should return linked PR info', async () => {
      fetchStub.onFirstCall().resolves({
        ok: true,
        text: async () => JSON.stringify({ state: 'open' })
      });
      fetchStub.onSecondCall().resolves({
        ok: true,
        text: async () => JSON.stringify({
          items: [
            { number: 789, html_url: 'https://github.com/o/r/pull/789', state: 'open', title: 'Fix it' }
          ]
        })
      });

      const result = await checkGitHubIssueStatus(123, defaultOpts);
      assert.strictEqual(result.issueState, 'OPEN');
      assert.ok(result.pr);
      assert.strictEqual(result.pr.number, 789);
      assert.strictEqual(result.pr.url, 'https://github.com/o/r/pull/789');
      assert.strictEqual(result.pr.state, 'OPEN');
      assert.strictEqual(result.pr.title, 'Fix it');
    });

    test('should handle PR search error gracefully', async () => {
      fetchStub.onFirstCall().resolves({
        ok: true,
        text: async () => JSON.stringify({ state: 'open' })
      });
      fetchStub.onSecondCall().resolves({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });

      const result = await checkGitHubIssueStatus(123, defaultOpts);
      assert.strictEqual(result.issueState, 'OPEN');
      assert.strictEqual(result.pr, null);
    });

    test('should throw on issue fetch error', async () => {
      fetchStub.onFirstCall().resolves({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ message: 'Not Found' })
      });

      await assert.rejects(
        () => checkGitHubIssueStatus(999, defaultOpts),
        /Failed to check issue #999/
      );
    });

    test('should pass token in authorization header', async () => {
      fetchStub.onFirstCall().resolves({
        ok: true,
        text: async () => JSON.stringify({ state: 'open' })
      });
      fetchStub.onSecondCall().resolves({
        ok: true,
        text: async () => JSON.stringify({ items: [] })
      });

      await checkGitHubIssueStatus(123, defaultOpts);
      const headers = fetchStub.firstCall.args[1].headers;
      assert.strictEqual(headers['Authorization'], 'Bearer test-token');
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
      },
      authentication: {
        getSession: sinon.stub().resolves({
          accessToken: 'mock-token',
          account: { label: 'test', id: 'test' }
        })
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
