const assert = require('assert');
const sinon = require('sinon');
const { createAppActions } = require('../../webview/app-actions');

suite('app-actions', () => {
  /**
   * Build a test context with sinon stubs for all state setters.
   * @returns {{ ctx: object, stubs: Record<string, sinon.SinonStub> }}
   */
  function buildCtx() {
    const stubs = {
      setOutput: sinon.stub(),
      setIsError: sinon.stub(),
      setIsSuccess: sinon.stub(),
      setShowRelationshipPanel: sinon.stub(),
      setShowCreatePanel: sinon.stub(),
      setShowEditPanel: sinon.stub(),
      setShowHierarchyView: sinon.stub(),
      setShowBlockingView: sinon.stub(),
      setHierarchyModel: sinon.stub(),
      setBlockingModel: sinon.stub(),
      setCreateTitle: sinon.stub(),
      setCreateDescription: sinon.stub(),
      setCreateParentId: sinon.stub(),
      setCreateBlocksId: sinon.stub(),
      setCreateRelatedId: sinon.stub(),
      setCreateType: sinon.stub(),
      setCreatePriority: sinon.stub(),
      updateGraphPurpose: sinon.stub(),
      parseListJSON: sinon.stub().returns({ items: [] }),
      parseStatsOutput: sinon.stub().returns({}),
      vscode: { postMessage: sinon.stub() },
      outputRef: { current: '' }
    };
    return { ctx: stubs, stubs };
  }

  suite('runCommand', () => {
    test('closes blocking view when switching to list', () => {
      const { ctx, stubs } = buildCtx();
      const actions = createAppActions(ctx);

      actions.runCommand('list');

      assert.strictEqual(
        stubs.setShowBlockingView.calledWith(false),
        true,
        'runCommand should set showBlockingView to false'
      );
    });

    test('closes blocking view when switching to ready', () => {
      const { ctx, stubs } = buildCtx();
      const actions = createAppActions(ctx);

      actions.runCommand('ready');

      assert.strictEqual(
        stubs.setShowBlockingView.calledWith(false),
        true,
        'runCommand should set showBlockingView to false for ready'
      );
    });

    test('closes blocking view when switching to blocked', () => {
      const { ctx, stubs } = buildCtx();
      const actions = createAppActions(ctx);

      actions.runCommand('blocked');

      assert.strictEqual(
        stubs.setShowBlockingView.calledWith(false),
        true,
        'runCommand should set showBlockingView to false for blocked'
      );
    });

    test('closes all panels when running any command', () => {
      const { ctx, stubs } = buildCtx();
      const actions = createAppActions(ctx);

      actions.runCommand('stats');

      assert.strictEqual(stubs.setShowRelationshipPanel.calledWith(false), true);
      assert.strictEqual(stubs.setShowCreatePanel.calledWith(false), true);
      assert.strictEqual(stubs.setShowEditPanel.calledWith(false), true);
      assert.strictEqual(stubs.setShowHierarchyView.calledWith(false), true);
      assert.strictEqual(stubs.setShowBlockingView.calledWith(false), true);
    });

    test('sends executeCommand message with useJSON for list commands', () => {
      const { ctx, stubs } = buildCtx();
      const actions = createAppActions(ctx);

      actions.runCommand('list');

      assert.strictEqual(stubs.vscode.postMessage.calledOnce, true);
      const msg = stubs.vscode.postMessage.firstCall.args[0];
      assert.strictEqual(msg.type, 'executeCommand');
      assert.strictEqual(msg.useJSON, true);
    });
  });

  suite('requestBlockingData', () => {
    test('sets graph purpose to blocking', () => {
      const { ctx, stubs } = buildCtx();
      const actions = createAppActions(ctx);

      actions.requestBlockingData();

      assert.strictEqual(stubs.updateGraphPurpose.calledWith('blocking'), true);
    });

    test('resets blocking model before fetching', () => {
      const { ctx, stubs } = buildCtx();
      const actions = createAppActions(ctx);

      actions.requestBlockingData();

      assert.strictEqual(stubs.setBlockingModel.calledWith(null), true);
    });
  });

  suite('page caching', () => {
    test('serves cached result on second call to same command', () => {
      const { ctx, stubs } = buildCtx();
      const cachedOutput = { type: 'list', command: 'list', openIssues: [], closedIssues: [] };
      stubs.parseListJSON.returns(cachedOutput);
      const actions = createAppActions(ctx);

      // First call: displayResult caches the result
      actions.displayResult('list', '[]', true);
      stubs.setOutput.resetHistory();
      stubs.vscode.postMessage.resetHistory();

      // Second call: runCommand should serve from cache
      actions.runCommand('list');

      assert.strictEqual(stubs.setOutput.calledWith(cachedOutput), true, 'should display cached output');
      assert.strictEqual(stubs.vscode.postMessage.called, false, 'should not send message to extension');
    });

    test('does not serve cache when forceRefresh is true', () => {
      const { ctx, stubs } = buildCtx();
      const cachedOutput = { type: 'list', command: 'list', openIssues: [], closedIssues: [] };
      stubs.parseListJSON.returns(cachedOutput);
      const actions = createAppActions(ctx);

      // Populate cache
      actions.displayResult('list', '[]', true);
      stubs.setOutput.resetHistory();
      stubs.vscode.postMessage.resetHistory();

      // Force refresh should bypass cache
      actions.runCommand('list', true);

      assert.strictEqual(stubs.vscode.postMessage.called, true, 'should send message when forcing refresh');
    });

    test('refreshCommand bypasses cache', () => {
      const { ctx, stubs } = buildCtx();
      const cachedOutput = { type: 'list', command: 'list', openIssues: [], closedIssues: [] };
      stubs.parseListJSON.returns(cachedOutput);
      const actions = createAppActions(ctx);

      // Populate cache
      actions.displayResult('list', '[]', true);
      stubs.vscode.postMessage.resetHistory();

      actions.refreshCommand('list');

      assert.strictEqual(stubs.vscode.postMessage.called, true, 'refreshCommand should bypass cache');
    });

    test('cache is invalidated after a modifying inline action', () => {
      const { ctx, stubs } = buildCtx();
      const cachedOutput = { type: 'list', command: 'list', openIssues: [], closedIssues: [] };
      stubs.parseListJSON.returns(cachedOutput);
      const actions = createAppActions(ctx);

      // Populate cache
      actions.displayResult('list', '[]', true);

      // Simulate a modifying inline action
      actions.handleInlineActionResult({
        command: 'update bd-1 --title "new"',
        output: 'Updated',
        success: true,
        successMessage: 'Updated bd-1'
      });

      stubs.setOutput.resetHistory();
      stubs.vscode.postMessage.resetHistory();

      // Next runCommand should NOT serve from cache
      actions.runCommand('list');

      assert.strictEqual(stubs.vscode.postMessage.called, true, 'should fetch fresh data after cache invalidation');
    });

    test('cachePageResult stores result for later retrieval', () => {
      const { ctx, stubs } = buildCtx();
      const actions = createAppActions(ctx);
      const parsed = { type: 'list', command: 'ready', openIssues: [{ id: 'bd-1' }], closedIssues: [] };

      actions.cachePageResult('ready', parsed);
      stubs.setOutput.resetHistory();
      stubs.vscode.postMessage.resetHistory();

      actions.runCommand('ready');

      assert.strictEqual(stubs.setOutput.calledWith(parsed), true, 'should serve cachePageResult data');
      assert.strictEqual(stubs.vscode.postMessage.called, false, 'should not fetch when cache exists');
    });

    test('does not cache failed results in displayResult', () => {
      const { ctx, stubs } = buildCtx();
      stubs.parseListJSON.returns({ type: 'list', command: 'list', openIssues: [], closedIssues: [] });
      const actions = createAppActions(ctx);

      // Call with success=false
      actions.displayResult('list', '[]', false);
      stubs.setOutput.resetHistory();
      stubs.vscode.postMessage.resetHistory();

      // Should not serve from cache
      actions.runCommand('list');

      assert.strictEqual(stubs.vscode.postMessage.called, true, 'should fetch since failed results are not cached');
    });

    test('caches stats command results', () => {
      const { ctx, stubs } = buildCtx();
      const statsOutput = { type: 'stats', header: 'Stats', stats: { total: '5' } };
      stubs.parseStatsOutput.returns(statsOutput);
      const actions = createAppActions(ctx);

      actions.displayResult('stats', 'Total: 5', true);
      stubs.setOutput.resetHistory();
      stubs.vscode.postMessage.resetHistory();

      actions.runCommand('stats');

      const setOutputCall = stubs.setOutput.firstCall.args[0];
      assert.strictEqual(setOutputCall.type, 'stats', 'should serve cached stats');
      assert.strictEqual(stubs.vscode.postMessage.called, false, 'should not fetch when stats cached');
    });
  });
});
