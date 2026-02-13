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
});
