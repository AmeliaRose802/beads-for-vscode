const assert = require('assert');
const sinon = require('sinon');
const { processMessage } = require('../../webview/message-handler');

suite('message-handler', () => {
  /**
   * Build a test context with sinon stubs for processMessage.
   * @returns {object} Context with stubs for all expected callbacks.
   */
  function buildCtx() {
    return {
      setIsSuccess: sinon.stub(),
      setIsError: sinon.stub(),
      setOutput: sinon.stub(),
      parseListJSON: sinon.stub().returns({ type: 'success', items: [] }),
      displayResult: sinon.stub(),
      handleInlineActionResult: sinon.stub(),
      setCwd: sinon.stub(),
      setBeadsStatus: sinon.stub(),
      setCurrentFile: sinon.stub(),
      setEditTitle: sinon.stub(),
      setEditType: sinon.stub(),
      setEditPriority: sinon.stub(),
      setEditDescription: sinon.stub(),
      setEditStatus: sinon.stub(),
      setIsAILoading: sinon.stub(),
      setCreateType: sinon.stub(),
      setCreatePriority: sinon.stub(),
      setCreateParentId: sinon.stub(),
      setCreateBlocksId: sinon.stub(),
      setCreateRelatedId: sinon.stub(),
      setIssueDetails: sinon.stub(),
      setLoadingDetails: sinon.stub(),
      setGraphData: sinon.stub(),
      setHierarchyModel: sinon.stub(),
      setShowHierarchyView: sinon.stub(),
      setBlockingModel: sinon.stub(),
      setShowBlockingView: sinon.stub(),
      buildHierarchyModel: sinon.stub().returns({}),
      buildBlockingModel: sinon.stub().returns({}),
      graphPurposeRef: { current: null },
      hierarchyIssueRef: { current: null },
      updateGraphPurpose: sinon.stub(),
      cachePageResult: sinon.stub(),
      completeCommandProgress: sinon.stub(),
      vscode: { postMessage: sinon.stub() },
      setPokepokeInstances: sinon.stub(),
      setGitHubInfo: sinon.stub(),
      handleParallelPhaseDispatch: sinon.stub()
    };
  }

  suite('commandResultJSON', () => {
    test('routes parsed JSON to setOutput on success', () => {
      const ctx = buildCtx();
      const parsed = { type: 'success', items: [{ id: '1' }] };
      ctx.parseListJSON.returns(parsed);

      processMessage({
        type: 'commandResultJSON',
        output: '[]',
        command: 'list'
      }, ctx);

      assert.ok(ctx.parseListJSON.calledOnce);
      assert.ok(ctx.setOutput.calledWith(parsed));
      assert.ok(ctx.setIsError.calledWith(false));
    });

    test('sets error state on parse error', () => {
      const ctx = buildCtx();
      ctx.parseListJSON.returns({ type: 'error', message: 'bad json' });

      processMessage({
        type: 'commandResultJSON',
        output: 'garbage',
        command: 'list'
      }, ctx);

      assert.ok(ctx.setOutput.calledWith('bad json'));
      assert.ok(ctx.setIsError.calledWith(true));
    });

    test('calls cachePageResult when available', () => {
      const ctx = buildCtx();
      const parsed = { type: 'success' };
      ctx.parseListJSON.returns(parsed);

      processMessage({
        type: 'commandResultJSON',
        output: '[]',
        command: 'list'
      }, ctx);

      assert.ok(ctx.cachePageResult.calledWith('list', parsed));
    });

    test('calls completeCommandProgress when available', () => {
      const ctx = buildCtx();
      ctx.parseListJSON.returns({ type: 'success' });

      processMessage({
        type: 'commandResultJSON',
        output: '[]',
        command: 'ready'
      }, ctx);

      assert.ok(ctx.completeCommandProgress.calledWith('ready'));
    });

    test('logs graphError when present', () => {
      const ctx = buildCtx();
      ctx.parseListJSON.returns({ type: 'success' });
      const spy = sinon.spy(console, 'error');

      processMessage({
        type: 'commandResultJSON',
        output: '[]',
        command: 'list',
        graphError: 'no graph'
      }, ctx);

      assert.ok(spy.calledOnce);
      spy.restore();
    });
  });

  suite('commandResult', () => {
    test('calls displayResult with correct args', () => {
      const ctx = buildCtx();
      processMessage({
        type: 'commandResult',
        command: 'show bd-1',
        output: 'details',
        success: true,
        requestId: 'r1',
        isBackgroundSync: false
      }, ctx);

      assert.ok(ctx.displayResult.calledWith('show bd-1', 'details', true, {
        requestId: 'r1',
        isBackgroundSync: false
      }));
    });
  });

  suite('inlineActionResult', () => {
    test('calls handleInlineActionResult', () => {
      const ctx = buildCtx();
      const msg = { type: 'inlineActionResult', success: true, command: 'update' };

      processMessage(msg, ctx);

      assert.ok(ctx.handleInlineActionResult.calledWith(msg));
    });

    test('sends getBeadsStatus after successful init', () => {
      const ctx = buildCtx();
      processMessage({
        type: 'inlineActionResult',
        success: true,
        command: 'init --quiet'
      }, ctx);

      assert.ok(ctx.vscode.postMessage.calledWith({ type: 'getBeadsStatus' }));
    });

    test('does not send getBeadsStatus for non-init commands', () => {
      const ctx = buildCtx();
      processMessage({
        type: 'inlineActionResult',
        success: true,
        command: 'update bd-1'
      }, ctx);

      assert.ok(ctx.vscode.postMessage.notCalled);
    });
  });

  suite('cwdResult', () => {
    test('sets cwd', () => {
      const ctx = buildCtx();
      processMessage({ type: 'cwdResult', cwd: '/home/user' }, ctx);
      assert.ok(ctx.setCwd.calledWith('/home/user'));
    });
  });

  suite('beadsStatus', () => {
    test('sets beads status', () => {
      const ctx = buildCtx();
      const msg = { type: 'beadsStatus', initialized: true };
      processMessage(msg, ctx);
      assert.ok(ctx.setBeadsStatus.calledWith(msg));
    });
  });

  suite('currentFileResult', () => {
    test('sets current file', () => {
      const ctx = buildCtx();
      processMessage({ type: 'currentFileResult', file: 'src/app.js' }, ctx);
      assert.ok(ctx.setCurrentFile.calledWith('src/app.js'));
    });

    test('defaults to empty string when file is falsy', () => {
      const ctx = buildCtx();
      processMessage({ type: 'currentFileResult' }, ctx);
      assert.ok(ctx.setCurrentFile.calledWith(''));
    });
  });

  suite('issueDetails', () => {
    test('populates edit fields from issue', () => {
      const ctx = buildCtx();
      processMessage({
        type: 'issueDetails',
        issue: {
          title: 'Bug',
          issue_type: 'bug',
          priority: 1,
          description: 'Broken',
          status: 'open'
        }
      }, ctx);

      assert.ok(ctx.setEditTitle.calledWith('Bug'));
      assert.ok(ctx.setEditType.calledWith('bug'));
      assert.ok(ctx.setEditPriority.calledWith('1'));
      assert.ok(ctx.setEditDescription.calledWith('Broken'));
      assert.ok(ctx.setEditStatus.calledWith('open'));
    });

    test('uses defaults for missing issue fields', () => {
      const ctx = buildCtx();
      processMessage({ type: 'issueDetails', issue: {} }, ctx);

      assert.ok(ctx.setEditTitle.calledWith(''));
      assert.ok(ctx.setEditType.calledWith('task'));
      assert.ok(ctx.setEditPriority.calledWith('2'));
      assert.ok(ctx.setEditDescription.calledWith(''));
      assert.ok(ctx.setEditStatus.calledWith('open'));
    });
  });

  suite('aiSuggestions', () => {
    test('applies AI suggestions to create fields', () => {
      const ctx = buildCtx();
      const clock = sinon.useFakeTimers();

      processMessage({
        type: 'aiSuggestions',
        suggestions: {
          type: 'feature',
          priority: 1,
          description: 'Add auth',
          links: '--parent bd-1 --blocks bd-2 --related bd-3'
        }
      }, ctx);

      assert.ok(ctx.setIsAILoading.calledWith(false));
      assert.ok(ctx.setCreateType.calledWith('feature'));
      assert.ok(ctx.setCreatePriority.calledWith('1'));
      assert.ok(ctx.setCreateParentId.calledWith('bd-1'));
      assert.ok(ctx.setCreateBlocksId.calledWith('bd-2'));
      assert.ok(ctx.setCreateRelatedId.calledWith('bd-3'));
      assert.ok(ctx.setIsSuccess.calledWith(true));

      clock.restore();
    });

    test('handles AI error', () => {
      const ctx = buildCtx();
      processMessage({
        type: 'aiSuggestions',
        error: 'API failed'
      }, ctx);

      assert.ok(ctx.setIsAILoading.calledWith(false));
      assert.ok(ctx.setIsError.calledWith(true));
    });

    test('handles suggestions without links', () => {
      const ctx = buildCtx();
      const clock = sinon.useFakeTimers();

      processMessage({
        type: 'aiSuggestions',
        suggestions: {
          type: 'task',
          priority: 2,
          description: 'Simple task'
        }
      }, ctx);

      assert.ok(ctx.setCreateParentId.calledWith(''));
      assert.ok(ctx.setCreateBlocksId.calledWith(''));
      assert.ok(ctx.setCreateRelatedId.calledWith(''));

      clock.restore();
    });
  });

  suite('inlineIssueDetails', () => {
    test('stores issue details by ID', () => {
      const ctx = buildCtx();
      processMessage({
        type: 'inlineIssueDetails',
        issueId: 'bd-5',
        details: { title: 'Detail' }
      }, ctx);

      assert.ok(ctx.setIssueDetails.calledOnce);
      assert.ok(ctx.setLoadingDetails.calledOnce);
    });
  });

  suite('graphData', () => {
    test('stores graph data', () => {
      const ctx = buildCtx();
      ctx.graphPurposeRef.current = null;

      processMessage({ type: 'graphData', data: { nodes: [] } }, ctx);

      assert.ok(ctx.setGraphData.calledWith({ nodes: [] }));
      assert.ok(ctx.updateGraphPurpose.calledWith(null));
    });

    test('builds hierarchy model when purpose is hierarchy', () => {
      const ctx = buildCtx();
      ctx.graphPurposeRef.current = 'hierarchy';
      ctx.hierarchyIssueRef.current = 'bd-1';
      ctx.buildHierarchyModel.returns({ tree: {} });

      processMessage({ type: 'graphData', data: { nodes: [] } }, ctx);

      assert.ok(ctx.buildHierarchyModel.calledWith('bd-1', { nodes: [] }));
      assert.ok(ctx.setHierarchyModel.calledOnce);
      assert.ok(ctx.setShowHierarchyView.calledWith(true));
    });

    test('builds blocking model when purpose is blocking', () => {
      const ctx = buildCtx();
      ctx.graphPurposeRef.current = 'blocking';
      ctx.buildBlockingModel.returns({ items: [] });

      processMessage({ type: 'graphData', data: { nodes: [] } }, ctx);

      assert.ok(ctx.buildBlockingModel.calledWith({ nodes: [] }));
      assert.ok(ctx.setBlockingModel.calledOnce);
      assert.ok(ctx.setShowBlockingView.calledWith(true));
    });

    test('handles graph error message', () => {
      const ctx = buildCtx();
      processMessage({ type: 'graphData', error: 'no data' }, ctx);

      assert.ok(ctx.setIsError.calledWith(true));
    });

    test('handles hierarchy model build error', () => {
      const ctx = buildCtx();
      ctx.graphPurposeRef.current = 'hierarchy';
      ctx.hierarchyIssueRef.current = 'bd-1';
      ctx.buildHierarchyModel.throws(new Error('build failed'));

      processMessage({ type: 'graphData', data: { nodes: [] } }, ctx);

      assert.ok(ctx.setIsError.calledWith(true));
      assert.ok(ctx.setShowHierarchyView.calledWith(false));
    });

    test('handles blocking model build error', () => {
      const ctx = buildCtx();
      ctx.graphPurposeRef.current = 'blocking';
      ctx.buildBlockingModel.throws(new Error('build failed'));

      processMessage({ type: 'graphData', data: { nodes: [] } }, ctx);

      assert.ok(ctx.setIsError.calledWith(true));
      assert.ok(ctx.setShowBlockingView.calledWith(false));
    });
  });

  suite('pokepokeStateChange', () => {
    test('requests pokepoke status on state change', () => {
      const ctx = buildCtx();
      processMessage({
        type: 'pokepokeStateChange',
        state: 'running',
        itemId: 'bd-1'
      }, ctx);

      assert.ok(ctx.vscode.postMessage.calledWith({ type: 'pokepokeGetStatus' }));
    });

    test('shows error on failed state', () => {
      const ctx = buildCtx();
      processMessage({
        type: 'pokepokeStateChange',
        state: 'failed',
        itemId: 'bd-1',
        error: 'crashed'
      }, ctx);

      assert.ok(ctx.setOutput.called);
      assert.ok(ctx.setIsError.calledWith(true));
    });

    test('shows success on completed state', () => {
      const ctx = buildCtx();
      const clock = sinon.useFakeTimers();

      processMessage({
        type: 'pokepokeStateChange',
        state: 'completed',
        itemId: 'bd-1'
      }, ctx);

      assert.ok(ctx.setOutput.called);
      assert.ok(ctx.setIsSuccess.calledWith(true));

      clock.restore();
    });

    test('shows exit code when no error message', () => {
      const ctx = buildCtx();
      processMessage({
        type: 'pokepokeStateChange',
        state: 'failed',
        itemId: 'bd-1',
        code: 1
      }, ctx);

      const outputArg = ctx.setOutput.firstCall.args[0];
      assert.ok(outputArg.includes('exited with code 1'));
    });
  });

  suite('pokepokeStatus', () => {
    test('sets instances', () => {
      const ctx = buildCtx();
      processMessage({
        type: 'pokepokeStatus',
        instances: [{ id: 'bd-1' }]
      }, ctx);

      assert.ok(ctx.setPokepokeInstances.calledWith([{ id: 'bd-1' }]));
    });
  });

  suite('pokepokeLaunchResult', () => {
    test('shows error on failed launch', () => {
      const ctx = buildCtx();
      processMessage({
        type: 'pokepokeLaunchResult',
        success: false,
        error: 'not found'
      }, ctx);

      assert.ok(ctx.setIsError.calledWith(true));
    });

    test('shows success on successful launch', () => {
      const ctx = buildCtx();
      const clock = sinon.useFakeTimers();

      processMessage({
        type: 'pokepokeLaunchResult',
        success: true,
        itemId: 'bd-1'
      }, ctx);

      assert.ok(ctx.setOutput.called);
      assert.ok(ctx.setIsSuccess.calledWith(true));

      clock.restore();
    });
  });

  suite('pokepokeStopResult', () => {
    test('shows success message on stop', () => {
      const ctx = buildCtx();
      const clock = sinon.useFakeTimers();

      processMessage({
        type: 'pokepokeStopResult',
        success: true,
        itemId: 'bd-1'
      }, ctx);

      assert.ok(ctx.setOutput.called);
      assert.ok(ctx.setIsSuccess.calledWith(true));

      clock.restore();
    });

    test('shows error on failed stop', () => {
      const ctx = buildCtx();
      processMessage({
        type: 'pokepokeStopResult',
        success: false,
        error: 'not running'
      }, ctx);

      assert.ok(ctx.setIsError.calledWith(true));
    });
  });

  suite('githubInfo', () => {
    test('stores GitHub info when handler available', () => {
      const ctx = buildCtx();
      processMessage({
        type: 'githubInfo',
        authenticated: true,
        account: { label: 'user', id: '123' },
        repo: { owner: 'owner', repo: 'repo', remote: 'origin' },
        copilotAssignees: ['github-copilot', 'octo-bot']
      }, ctx);

      assert.ok(ctx.setGitHubInfo.calledOnce);
      const arg = ctx.setGitHubInfo.firstCall.args[0];
      assert.strictEqual(arg.authenticated, true);
      assert.strictEqual(arg.account.label, 'user');
      assert.strictEqual(arg.repo.owner, 'owner');
      assert.deepStrictEqual(arg.copilotAssignees, ['github-copilot', 'octo-bot']);
    });

    test('handles missing repo gracefully', () => {
      const ctx = buildCtx();
      processMessage({
        type: 'githubInfo',
        authenticated: false,
        account: null,
        repo: null
      }, ctx);

      const arg = ctx.setGitHubInfo.firstCall.args[0];
      assert.strictEqual(arg.authenticated, false);
      assert.strictEqual(arg.account, null);
      assert.strictEqual(arg.repo, null);
    });
  });

  suite('parallelPhaseDispatch', () => {
    test('forwards dispatch started to handler', () => {
      const ctx = buildCtx();
      const msg = { type: 'parallelPhaseDispatchStarted', assignments: [] };
      processMessage(msg, ctx);
      assert.ok(ctx.handleParallelPhaseDispatch.calledWith(msg));
    });

    test('forwards dispatch progress to handler', () => {
      const ctx = buildCtx();
      const msg = { type: 'parallelPhaseDispatchProgress', issueId: 'bd-1', state: 'creating' };
      processMessage(msg, ctx);
      assert.ok(ctx.handleParallelPhaseDispatch.calledWith(msg));
    });

    test('forwards dispatch complete to handler', () => {
      const ctx = buildCtx();
      const msg = { type: 'parallelPhaseDispatchComplete', successCount: 1, failureCount: 0 };
      processMessage(msg, ctx);
      assert.ok(ctx.handleParallelPhaseDispatch.calledWith(msg));
    });

    test('forwards dispatch error to handler', () => {
      const ctx = buildCtx();
      const msg = { type: 'parallelPhaseDispatchError', error: 'failed' };
      processMessage(msg, ctx);
      assert.ok(ctx.handleParallelPhaseDispatch.calledWith(msg));
    });
  });

  suite('githubConversionResult', () => {
    test('shows success message with URL', () => {
      const ctx = buildCtx();
      const clock = sinon.useFakeTimers();
      processMessage({
        type: 'githubConversionResult',
        success: true,
        issueId: 'bd-42',
        url: 'https://github.com/owner/repo/issues/42',
        commandKey: 'convertToGitHub:bd-42'
      }, ctx);
      assert.ok(ctx.setOutput.called);
      const output = ctx.setOutput.firstCall.args[0];
      assert.ok(output.includes('https://github.com/owner/repo/issues/42'));
      assert.ok(ctx.completeCommandProgress.calledWith('convertToGitHub:bd-42'));
      assert.ok(ctx.setIsError.calledWith(false));
      clock.restore();
    });

    test('shows error message on failure', () => {
      const ctx = buildCtx();
      processMessage({
        type: 'githubConversionResult',
        success: false,
        error: 'gh auth login required',
        issueId: 'bd-42',
        commandKey: 'convertToGitHub:bd-42'
      }, ctx);
      assert.ok(ctx.setOutput.called);
      assert.ok(ctx.setIsError.calledWith(true));
      assert.ok(ctx.completeCommandProgress.calledWith('convertToGitHub:bd-42'));
    });
  });

  suite('copilotDispatchResult', () => {
    test('shows success message and completes progress', () => {
      const ctx = buildCtx();
      const clock = sinon.useFakeTimers();
      processMessage({
        type: 'copilotDispatchResult',
        success: true,
        issueId: 'bd-7',
        url: 'https://github.com/owner/repo/issues/7',
        assignedTo: 'github-copilot',
        commandKey: 'assignCopilot:bd-7'
      }, ctx);
      assert.ok(ctx.setOutput.called);
      assert.ok(ctx.setIsError.calledWith(false));
      assert.ok(ctx.completeCommandProgress.calledWith('assignCopilot:bd-7'));
      clock.restore();
    });

    test('shows error message on failure', () => {
      const ctx = buildCtx();
      processMessage({
        type: 'copilotDispatchResult',
        success: false,
        error: 'no token',
        issueId: 'bd-7',
        commandKey: 'assignCopilot:bd-7',
        url: 'https://github.com/owner/repo/issues/7'
      }, ctx);
      assert.ok(ctx.setOutput.called);
      assert.ok(ctx.setIsError.calledWith(true));
      assert.ok(ctx.completeCommandProgress.calledWith('assignCopilot:bd-7'));
    });
  });

  suite('unknown message type', () => {
    test('does nothing for unknown types', () => {
      const ctx = buildCtx();
      processMessage({ type: 'nonexistent' }, ctx);
      // No errors thrown, no state changes
      assert.ok(ctx.setOutput.notCalled);
    });
  });
});
