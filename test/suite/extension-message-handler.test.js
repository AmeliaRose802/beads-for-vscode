const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');

// Stub external dependencies BEFORE loading the handler so destructured
// bindings inside the module capture the stubs, not the originals.
const aiSuggestions = require('../../ai-suggestions');
const beadsBackend = require('../../beads-backend');
const githubConverter = require('../../github-converter');
const githubAuth = require('../../github-auth');

const aiStub = sinon.stub(aiSuggestions, 'getAISuggestions');
const backendStub = sinon.stub(beadsBackend, 'detectBeadsBackend');
const convertStub = sinon.stub(githubConverter, 'convertBeadsItemToGitHubIssue');
const ghSessionStub = sinon.stub(githubAuth, 'getGitHubSession');
const ghRepoStub = sinon.stub(githubAuth, 'detectGitHubRepo');

const { handleWebviewMessage } = require('../../extension-message-handler');

/**
 * Build a mock context (provider + webviewView) and a mock vscode API.
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
      }),
      asRelativePath: sinon.stub().returns('src/file.js')
    },
    window: {
      activeTextEditor: { document: { uri: '/workspace/src/file.js', fileName: '/workspace/src/file.js' } },
      createOutputChannel: sinon.stub().returns({ appendLine: sinon.stub() })
    }
  };
  return { ctx, vscode, postMessage };
}

suite('extension-message-handler', () => {
  let existsStub;

  setup(() => {
    aiStub.reset();
    backendStub.reset();
    convertStub.reset();
    ghSessionStub.reset();
    ghRepoStub.reset();
    existsStub = sinon.stub(fs, 'existsSync');
  });

  teardown(() => {
    existsStub.restore();
  });

  // ── getCopilotAssignees (internal, tested via getGitHubInfo) ─

  test('getCopilotAssignees falls back when setting is not an array', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    vscode.workspace.getConfiguration.returns({ get: sinon.stub().returns('not-array') });
    ghSessionStub.resolves(null);
    ghRepoStub.resolves(null);
    await handleWebviewMessage({ type: 'getGitHubInfo' }, ctx, vscode);
    const msg = postMessage.firstCall.args[0];
    assert.deepStrictEqual(msg.copilotAssignees, ['github-copilot']);
  });

  // ── executeCommand ────────────────────────────────────────────

  suite('executeCommand', () => {
    test('invalidates cache for modifying commands', async () => {
      const { ctx, vscode } = buildMocks();
      ctx.provider._executeBdCommand.resolves({ output: 'ok', success: true });
      await handleWebviewMessage({ type: 'executeCommand', command: 'create "test"' }, ctx, vscode);
      assert.ok(ctx.provider._invalidateCache.calledOnce);
    });

    test('does not invalidate cache for non-modifying commands', async () => {
      const { ctx, vscode } = buildMocks();
      ctx.provider._executeBdCommand.resolves({ output: '[]', success: true });
      await handleWebviewMessage({ type: 'executeCommand', command: 'show bd-1' }, ctx, vscode);
      assert.ok(ctx.provider._invalidateCache.notCalled);
    });

    test('routes list --json --id to issueDetails', async () => {
      const { ctx, vscode, postMessage } = buildMocks();
      ctx.provider._executeBdCommand.resolves({
        output: JSON.stringify([{ id: 'bd-1', title: 'Bug' }]), success: true
      });
      await handleWebviewMessage(
        { type: 'executeCommand', command: 'list --json --id bd-1' }, ctx, vscode
      );
      const msg = postMessage.firstCall.args[0];
      assert.strictEqual(msg.type, 'issueDetails');
      assert.strictEqual(msg.issue.id, 'bd-1');
    });

    test('handles empty results for list --json --id', async () => {
      const { ctx, vscode, postMessage } = buildMocks();
      ctx.provider._executeBdCommand.resolves({ output: '[]', success: true });
      await handleWebviewMessage(
        { type: 'executeCommand', command: 'list --json --id bd-99' }, ctx, vscode
      );
      const msg = postMessage.firstCall.args[0];
      assert.strictEqual(msg.success, false);
    });

    test('handles parse error for list --json --id', async () => {
      const { ctx, vscode, postMessage } = buildMocks();
      ctx.provider._executeBdCommand.resolves({ output: 'not json', success: true });
      await handleWebviewMessage(
        { type: 'executeCommand', command: 'list --json --id bd-1' }, ctx, vscode
      );
      const msg = postMessage.firstCall.args[0];
      assert.strictEqual(msg.type, 'commandResult');
    });

    test('routes useJSON list to commandResultJSON', async () => {
      const { ctx, vscode, postMessage } = buildMocks();
      ctx.provider._executeBdCommand.resolves({ output: '[]', success: true });
      await handleWebviewMessage(
        { type: 'executeCommand', command: 'list', useJSON: true }, ctx, vscode
      );
      const msg = postMessage.firstCall.args[0];
      assert.strictEqual(msg.type, 'commandResultJSON');
    });

    test('routes useJSON ready to commandResultJSON', async () => {
      const { ctx, vscode, postMessage } = buildMocks();
      ctx.provider._executeBdCommand.resolves({ output: '[]', success: true });
      await handleWebviewMessage(
        { type: 'executeCommand', command: 'ready', useJSON: true, requestId: 'r1' }, ctx, vscode
      );
      const msg = postMessage.firstCall.args[0];
      assert.strictEqual(msg.type, 'commandResultJSON');
      assert.strictEqual(msg.requestId, 'r1');
    });

    test('routes useJSON blocked to commandResultJSON', async () => {
      const { ctx, vscode, postMessage } = buildMocks();
      ctx.provider._executeBdCommand.resolves({ output: '[]', success: true });
      await handleWebviewMessage(
        { type: 'executeCommand', command: 'blocked', useJSON: true }, ctx, vscode
      );
      assert.strictEqual(postMessage.firstCall.args[0].type, 'commandResultJSON');
    });

    test('includes graph data in commandResultJSON', async () => {
      const { ctx, vscode, postMessage } = buildMocks();
      ctx.provider._executeBdCommand
        .onFirstCall().resolves({ output: '[]', success: true })
        .onSecondCall().resolves({ output: '{"nodes":[]}', success: true });
      await handleWebviewMessage(
        { type: 'executeCommand', command: 'list', useJSON: true }, ctx, vscode
      );
      const msg = postMessage.firstCall.args[0];
      assert.strictEqual(msg.graphData, '{"nodes":[]}');
      assert.strictEqual(msg.graphError, null);
    });

    test('includes graph error in commandResultJSON', async () => {
      const { ctx, vscode, postMessage } = buildMocks();
      ctx.provider._executeBdCommand
        .onFirstCall().resolves({ output: '[]', success: true })
        .onSecondCall().resolves({ output: 'graph fail', success: false });
      await handleWebviewMessage(
        { type: 'executeCommand', command: 'list', useJSON: true }, ctx, vscode
      );
      const msg = postMessage.firstCall.args[0];
      assert.strictEqual(msg.graphData, null);
      assert.strictEqual(msg.graphError, 'graph fail');
    });

    test('routes useJSON failure to commandResult', async () => {
      const { ctx, vscode, postMessage } = buildMocks();
      ctx.provider._executeBdCommand.resolves({ output: 'error', success: false });
      await handleWebviewMessage(
        { type: 'executeCommand', command: 'list', useJSON: true }, ctx, vscode
      );
      const msg = postMessage.firstCall.args[0];
      assert.strictEqual(msg.type, 'commandResult');
      assert.strictEqual(msg.success, false);
    });

    test('routes inline actions to inlineActionResult', async () => {
      const { ctx, vscode, postMessage } = buildMocks();
      ctx.provider._executeBdCommand.resolves({ output: 'ok', success: true });
      await handleWebviewMessage(
        { type: 'executeCommand', command: 'show bd-1', isInlineAction: true, successMessage: 'Done' },
        ctx, vscode
      );
      const msg = postMessage.firstCall.args[0];
      assert.strictEqual(msg.type, 'inlineActionResult');
      assert.strictEqual(msg.successMessage, 'Done');
    });

    test('routes other commands to commandResult', async () => {
      const { ctx, vscode, postMessage } = buildMocks();
      ctx.provider._executeBdCommand.resolves({ output: 'done', success: true });
      await handleWebviewMessage(
        { type: 'executeCommand', command: 'show bd-1' }, ctx, vscode
      );
      const msg = postMessage.firstCall.args[0];
      assert.strictEqual(msg.type, 'commandResult');
    });
  });

  // ── Simple message types ──────────────────────────────────────

  test('getCwd returns workspace path', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    await handleWebviewMessage({ type: 'getCwd' }, ctx, vscode);
    assert.strictEqual(postMessage.firstCall.args[0].type, 'cwdResult');
    assert.strictEqual(postMessage.firstCall.args[0].cwd, '/workspace');
  });

  test('getCwd falls back to process.cwd when no workspace', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    vscode.workspace.workspaceFolders = null;
    await handleWebviewMessage({ type: 'getCwd' }, ctx, vscode);
    assert.strictEqual(postMessage.firstCall.args[0].type, 'cwdResult');
    assert.ok(postMessage.firstCall.args[0].cwd);
  });

  test('getCurrentFile returns active file', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    await handleWebviewMessage({ type: 'getCurrentFile' }, ctx, vscode);
    const msg = postMessage.firstCall.args[0];
    assert.strictEqual(msg.type, 'currentFileResult');
    assert.strictEqual(msg.file, 'src/file.js');
  });

  test('getCurrentFile returns empty when no editor', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    vscode.window.activeTextEditor = null;
    await handleWebviewMessage({ type: 'getCurrentFile' }, ctx, vscode);
    assert.strictEqual(postMessage.firstCall.args[0].file, '');
  });

  test('getCurrentFile uses fileName when no workspace folders', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    vscode.workspace.workspaceFolders = null;
    await handleWebviewMessage({ type: 'getCurrentFile' }, ctx, vscode);
    const msg = postMessage.firstCall.args[0];
    assert.strictEqual(msg.file, '/workspace/src/file.js');
  });

  // ── getBeadsStatus ────────────────────────────────────────────

  test('getBeadsStatus returns initialized status', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    existsStub.returns(true);
    backendStub.returns({ backend: 'sqlite' });
    await handleWebviewMessage({ type: 'getBeadsStatus' }, ctx, vscode);
    const msg = postMessage.firstCall.args[0];
    assert.strictEqual(msg.type, 'beadsStatus');
    assert.strictEqual(msg.initialized, true);
    assert.strictEqual(msg.backend, 'sqlite');
  });

  test('getBeadsStatus handles uninitialized workspace', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    existsStub.returns(false);
    backendStub.returns({ backend: 'unknown' });
    await handleWebviewMessage({ type: 'getBeadsStatus' }, ctx, vscode);
    assert.strictEqual(postMessage.firstCall.args[0].initialized, false);
  });

  test('getBeadsStatus handles missing workspace', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    vscode.workspace.workspaceFolders = null;
    backendStub.returns({ backend: 'unknown' });
    await handleWebviewMessage({ type: 'getBeadsStatus' }, ctx, vscode);
    const msg = postMessage.firstCall.args[0];
    assert.strictEqual(msg.hasWorkspace, false);
    assert.strictEqual(msg.initialized, false);
  });

  // ── getAISuggestions ──────────────────────────────────────────

  test('getAISuggestions posts suggestions', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    aiStub.resolves({ suggestions: { type: 'bug' }, error: null });
    await handleWebviewMessage(
      { type: 'getAISuggestions', title: 'Fix bug', currentDescription: '' }, ctx, vscode
    );
    const msg = postMessage.firstCall.args[0];
    assert.strictEqual(msg.type, 'aiSuggestions');
    assert.deepStrictEqual(msg.suggestions, { type: 'bug' });
  });

  // ── getIssueDetails ───────────────────────────────────────────

  test('getIssueDetails fetches and posts details', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ctx.provider._getIssueDetails.resolves({ title: 'Bug' });
    await handleWebviewMessage({ type: 'getIssueDetails', issueId: 'bd-1' }, ctx, vscode);
    const msg = postMessage.firstCall.args[0];
    assert.strictEqual(msg.type, 'inlineIssueDetails');
    assert.strictEqual(msg.issueId, 'bd-1');
  });

  // ── getComments ───────────────────────────────────────────────

  test('getComments posts comment output', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ctx.provider._executeBdCommand.resolves({ output: 'comment text', success: true });
    await handleWebviewMessage({ type: 'getComments', issueId: 'bd-1' }, ctx, vscode);
    const msg = postMessage.firstCall.args[0];
    assert.strictEqual(msg.type, 'commentsResult');
    assert.strictEqual(msg.issueId, 'bd-1');
  });

  // ── getGraphData ──────────────────────────────────────────────

  test('getGraphData posts parsed graph on success', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ctx.provider._executeBdCommand.resolves({
      output: JSON.stringify({ nodes: [], edges: [] }), success: true
    });
    await handleWebviewMessage({ type: 'getGraphData' }, ctx, vscode);
    const msg = postMessage.firstCall.args[0];
    assert.strictEqual(msg.type, 'graphData');
    assert.ok(msg.data);
  });

  test('getGraphData posts error on failure', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ctx.provider._executeBdCommand.resolves({ output: 'fail', success: false });
    await handleWebviewMessage({ type: 'getGraphData' }, ctx, vscode);
    assert.ok(postMessage.firstCall.args[0].error);
  });

  test('getGraphData posts error on parse failure', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ctx.provider._executeBdCommand.resolves({ output: 'not json', success: true });
    await handleWebviewMessage({ type: 'getGraphData' }, ctx, vscode);
    assert.ok(postMessage.firstCall.args[0].error.includes('Failed to parse'));
  });

  // ── getDependencies ───────────────────────────────────────────

  test('getDependencies posts deps and dependents', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ctx.provider._executeBdCommand
      .onFirstCall().resolves({ output: '[{"id":"bd-2"}]', success: true })
      .onSecondCall().resolves({ output: '[{"id":"bd-3"}]', success: true });
    await handleWebviewMessage({ type: 'getDependencies', issueId: 'bd-1' }, ctx, vscode);
    const msg = postMessage.firstCall.args[0];
    assert.strictEqual(msg.type, 'dependenciesResult');
    assert.strictEqual(msg.issueId, 'bd-1');
    assert.deepStrictEqual(msg.dependencies, [{ id: 'bd-2' }]);
    assert.deepStrictEqual(msg.dependents, [{ id: 'bd-3' }]);
  });

  test('getDependencies handles failures gracefully', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ctx.provider._executeBdCommand.resolves({ output: 'err', success: false });
    await handleWebviewMessage({ type: 'getDependencies', issueId: 'bd-1' }, ctx, vscode);
    const msg = postMessage.firstCall.args[0];
    assert.deepStrictEqual(msg.dependencies, []);
    assert.deepStrictEqual(msg.dependents, []);
  });

  // ── PokePoke messages ────────────────────────────────────────

  test('pokepokeLaunch forwards result', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ctx.provider._launchPokePoke.resolves({ success: true });
    await handleWebviewMessage({ type: 'pokepokeLaunch', itemId: 'bd-1' }, ctx, vscode);
    assert.strictEqual(postMessage.firstCall.args[0].type, 'pokepokeLaunchResult');
  });

  test('pokepokeStop calls manager and posts result', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    await handleWebviewMessage({ type: 'pokepokeStop', itemId: 'bd-1' }, ctx, vscode);
    assert.strictEqual(postMessage.firstCall.args[0].type, 'pokepokeStopResult');
  });

  test('pokepokeGetStatus posts instances', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    await handleWebviewMessage({ type: 'pokepokeGetStatus' }, ctx, vscode);
    assert.strictEqual(postMessage.firstCall.args[0].type, 'pokepokeStatus');
  });

  test('pokepokeDismiss removes and posts status', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    await handleWebviewMessage({ type: 'pokepokeDismiss', itemId: 'bd-1' }, ctx, vscode);
    assert.strictEqual(postMessage.firstCall.args[0].type, 'pokepokeStatus');
  });

  // ── getGitHubInfo ─────────────────────────────────────────────

  test('getGitHubInfo posts session and repo info', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ghSessionStub.resolves({ account: { label: 'user' } });
    ghRepoStub.resolves({ owner: 'o', repo: 'r', remote: 'origin' });
    await handleWebviewMessage({ type: 'getGitHubInfo' }, ctx, vscode);
    const msg = postMessage.firstCall.args[0];
    assert.strictEqual(msg.type, 'githubInfo');
    assert.strictEqual(msg.authenticated, true);
    assert.strictEqual(msg.repo.owner, 'o');
  });

  test('getGitHubInfo handles unauthenticated state', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ghSessionStub.resolves(null);
    ghRepoStub.resolves(null);
    await handleWebviewMessage({ type: 'getGitHubInfo', silent: true }, ctx, vscode);
    const msg = postMessage.firstCall.args[0];
    assert.strictEqual(msg.authenticated, false);
    assert.strictEqual(msg.account, null);
  });

  // ── epicUnblock ───────────────────────────────────────────────

  test('epicUnblock removes direct and cascaded deps', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ctx.provider._executeBdCommand.resolves({ success: true });
    await handleWebviewMessage({
      type: 'epicUnblock', epicA: 'bd-1', epicB: 'bd-2',
      cascadedDeps: [{ from: 'bd-3', to: 'bd-4' }]
    }, ctx, vscode);
    const msg = postMessage.firstCall.args[0];
    assert.strictEqual(msg.type, 'epicUnblockResult');
    assert.strictEqual(msg.success, true);
    assert.strictEqual(msg.removedCount, 2);
  });

  test('epicUnblock retries reverse direction on failure', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ctx.provider._executeBdCommand
      .onFirstCall().resolves({ success: false })
      .onSecondCall().resolves({ success: true });
    await handleWebviewMessage({
      type: 'epicUnblock', epicA: 'bd-1', epicB: 'bd-2', cascadedDeps: []
    }, ctx, vscode);
    assert.strictEqual(ctx.provider._executeBdCommand.callCount, 2);
    assert.strictEqual(postMessage.firstCall.args[0].success, true);
  });

  test('epicUnblock reports errors from cascaded removals', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ctx.provider._executeBdCommand
      .onFirstCall().resolves({ success: true })
      .onSecondCall().resolves({ success: false });
    await handleWebviewMessage({
      type: 'epicUnblock', epicA: 'bd-1', epicB: 'bd-2',
      cascadedDeps: [{ from: 'bd-3', to: 'bd-4' }]
    }, ctx, vscode);
    const msg = postMessage.firstCall.args[0];
    assert.strictEqual(msg.errors.length, 1);
  });

  test('epicUnblock catches thrown errors', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ctx.provider._executeBdCommand.rejects(new Error('boom'));
    await handleWebviewMessage({
      type: 'epicUnblock', epicA: 'bd-1', epicB: 'bd-2', cascadedDeps: []
    }, ctx, vscode);
    assert.strictEqual(postMessage.firstCall.args[0].success, false);
    assert.ok(postMessage.firstCall.args[0].error.includes('boom'));
  });

  // ── convertToGitHub ───────────────────────────────────────────

  test('convertToGitHub converts and posts result', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ctx.provider._executeBdCommand.resolves({
      output: JSON.stringify([{ id: 'bd-1', title: 'Bug' }]), success: true
    });
    convertStub.resolves({ url: 'https://gh.com/1', number: 1 });
    await handleWebviewMessage(
      { type: 'convertToGitHub', issueId: 'bd-1', commandKey: 'ck' }, ctx, vscode
    );
    const msg = postMessage.firstCall.args[0];
    assert.strictEqual(msg.type, 'githubConversionResult');
    assert.strictEqual(msg.success, true);
    assert.strictEqual(msg.url, 'https://gh.com/1');
  });

  test('convertToGitHub errors without workspace', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    vscode.workspace.workspaceFolders = null;
    await handleWebviewMessage(
      { type: 'convertToGitHub', issueId: 'bd-1' }, ctx, vscode
    );
    assert.strictEqual(postMessage.firstCall.args[0].success, false);
  });

  test('convertToGitHub handles fetch failure', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ctx.provider._executeBdCommand.resolves({ output: 'err', success: false });
    await handleWebviewMessage(
      { type: 'convertToGitHub', issueId: 'bd-1', commandKey: 'ck' }, ctx, vscode
    );
    assert.strictEqual(postMessage.firstCall.args[0].success, false);
  });

  test('convertToGitHub handles empty issue list', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ctx.provider._executeBdCommand.resolves({ output: '[]', success: true });
    await handleWebviewMessage(
      { type: 'convertToGitHub', issueId: 'bd-1', commandKey: 'ck' }, ctx, vscode
    );
    assert.strictEqual(postMessage.firstCall.args[0].success, false);
  });

  test('convertToGitHub catches conversion errors', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ctx.provider._executeBdCommand.resolves({
      output: JSON.stringify([{ id: 'bd-1' }]), success: true
    });
    convertStub.rejects(new Error('gh auth needed'));
    await handleWebviewMessage(
      { type: 'convertToGitHub', issueId: 'bd-1', commandKey: 'ck' }, ctx, vscode
    );
    const msg = postMessage.firstCall.args[0];
    assert.strictEqual(msg.success, false);
    assert.ok(msg.error.includes('gh auth needed'));
  });

  // ── dispatchParallelPhase ─────────────────────────────────────

  test('dispatchParallelPhase errors without workspace', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    vscode.workspace.workspaceFolders = null;
    await handleWebviewMessage(
      { type: 'dispatchParallelPhase', issueIds: ['bd-1'] }, ctx, vscode
    );
    assert.strictEqual(postMessage.firstCall.args[0].type, 'parallelPhaseDispatchError');
  });

  test('dispatchParallelPhase dispatches issues successfully', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ctx.provider._executeBdCommand.resolves({
      output: JSON.stringify([{ id: 'bd-1', title: 'Task' }]), success: true
    });
    convertStub.resolves({ url: 'https://gh.com/1', number: 1 });
    await handleWebviewMessage({
      type: 'dispatchParallelPhase', issueIds: ['bd-1'], phaseIndex: 0
    }, ctx, vscode);
    const messages = postMessage.args.map(a => a[0]);
    assert.ok(messages.some(m => m.type === 'parallelPhaseDispatchStarted'));
    assert.ok(messages.some(m => m.type === 'parallelPhaseDispatchComplete'));
    const complete = messages.find(m => m.type === 'parallelPhaseDispatchComplete');
    assert.strictEqual(complete.successCount, 1);
  });

  test('dispatchParallelPhase handles conversion failure', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ctx.provider._executeBdCommand.resolves({ output: 'err', success: false });
    await handleWebviewMessage({
      type: 'dispatchParallelPhase', issueIds: ['bd-1'], phaseIndex: 0
    }, ctx, vscode);
    const messages = postMessage.args.map(a => a[0]);
    const complete = messages.find(m => m.type === 'parallelPhaseDispatchComplete');
    assert.strictEqual(complete.failureCount, 1);
  });

  test('dispatchParallelPhase retries without assignee on assignee error', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ctx.provider._executeBdCommand.resolves({
      output: JSON.stringify([{ id: 'bd-1', title: 'Task' }]), success: true
    });
    convertStub
      .onFirstCall().rejects(new Error('Could not resolve assignee'))
      .onSecondCall().resolves({ url: 'https://gh.com/1', number: 1 });
    await handleWebviewMessage({
      type: 'dispatchParallelPhase', issueIds: ['bd-1'], phaseIndex: 0
    }, ctx, vscode);
    const messages = postMessage.args.map(a => a[0]);
    const complete = messages.find(m => m.type === 'parallelPhaseDispatchComplete');
    assert.strictEqual(complete.successCount, 1);
    const result = complete.results[0];
    assert.strictEqual(result.assigned, false);
    assert.ok(result.warning);
  });

  test('dispatchParallelPhase deduplicates issue IDs', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ctx.provider._executeBdCommand.resolves({
      output: JSON.stringify([{ id: 'bd-1' }]), success: true
    });
    convertStub.resolves({ url: 'https://gh.com/1', number: 1 });
    await handleWebviewMessage({
      type: 'dispatchParallelPhase', issueIds: ['bd-1', 'bd-1'], phaseIndex: 0
    }, ctx, vscode);
    const messages = postMessage.args.map(a => a[0]);
    const started = messages.find(m => m.type === 'parallelPhaseDispatchStarted');
    assert.strictEqual(started.total, 1);
  });

  test('dispatchParallelPhase handles empty issue result', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ctx.provider._executeBdCommand.resolves({ output: '[]', success: true });
    await handleWebviewMessage({
      type: 'dispatchParallelPhase', issueIds: ['bd-99'], phaseIndex: 0
    }, ctx, vscode);
    const messages = postMessage.args.map(a => a[0]);
    const complete = messages.find(m => m.type === 'parallelPhaseDispatchComplete');
    assert.strictEqual(complete.failureCount, 1);
    assert.ok(complete.results[0].error.includes('not found'));
  });

  test('dispatchParallelPhase rethrows non-assignee conversion errors', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ctx.provider._executeBdCommand.resolves({
      output: JSON.stringify([{ id: 'bd-1', title: 'Task' }]), success: true
    });
    convertStub.rejects(new Error('network timeout'));
    await handleWebviewMessage({
      type: 'dispatchParallelPhase', issueIds: ['bd-1'], phaseIndex: 0
    }, ctx, vscode);
    const messages = postMessage.args.map(a => a[0]);
    const complete = messages.find(m => m.type === 'parallelPhaseDispatchComplete');
    assert.strictEqual(complete.failureCount, 1);
    assert.ok(complete.results[0].error.includes('network timeout'));
  });

  test('dispatchParallelPhase handles non-array issueIds', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    await handleWebviewMessage({
      type: 'dispatchParallelPhase', issueIds: null, phaseIndex: 0
    }, ctx, vscode);
    const messages = postMessage.args.map(a => a[0]);
    const started = messages.find(m => m.type === 'parallelPhaseDispatchStarted');
    assert.strictEqual(started.total, 0);
  });

  test('dispatchParallelPhase handles null phaseIndex', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    await handleWebviewMessage({
      type: 'dispatchParallelPhase', issueIds: [], phaseIndex: 'not-a-number'
    }, ctx, vscode);
    const messages = postMessage.args.map(a => a[0]);
    const started = messages.find(m => m.type === 'parallelPhaseDispatchStarted');
    assert.strictEqual(started.phaseIndex, null);
  });

  test('getGitHubInfo handles missing workspace', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    vscode.workspace.workspaceFolders = null;
    ghSessionStub.resolves(null);
    await handleWebviewMessage({ type: 'getGitHubInfo' }, ctx, vscode);
    const msg = postMessage.firstCall.args[0];
    assert.strictEqual(msg.repo, null);
  });

  // ── logError ──────────────────────────────────────────────────

  test('logError creates output channel and writes error', async () => {
    const { ctx, vscode } = buildMocks();
    const appendStub = sinon.stub();
    vscode.window.createOutputChannel.returns({ appendLine: appendStub });
    await handleWebviewMessage({
      type: 'logError',
      boundaryName: 'Test',
      error: { message: 'fail', stack: 'at line 1', componentStack: '<App>' }
    }, ctx, vscode);
    assert.ok(appendStub.called);
  });

  test('logError handles missing error properties', async () => {
    const { ctx, vscode } = buildMocks();
    const appendStub = sinon.stub();
    vscode.window.createOutputChannel.returns({ appendLine: appendStub });
    await handleWebviewMessage({
      type: 'logError', boundaryName: 'Test', error: {}
    }, ctx, vscode);
    assert.ok(appendStub.called);
  });

  // ── Top-level error handling ──────────────────────────────────

  test('catches unhandled errors and posts failure', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ctx.provider._executeBdCommand.rejects(new Error('unexpected'));
    await handleWebviewMessage(
      { type: 'executeCommand', command: 'show bd-1' }, ctx, vscode
    );
    const msg = postMessage.firstCall.args[0];
    assert.strictEqual(msg.success, false);
    assert.ok(msg.output.includes('unexpected'));
  });

  test('handles webview disposed during error recovery', async () => {
    const { ctx, vscode, postMessage } = buildMocks();
    ctx.provider._executeBdCommand.rejects(new Error('boom'));
    postMessage.throws(new Error('disposed'));
    // Should not throw
    await handleWebviewMessage(
      { type: 'executeCommand', command: 'show bd-1' }, ctx, vscode
    );
  });
});
