/**
 * Commands that modify issue state and require a sync + refresh.
 * @type {string[]}
 */
const MODIFYING_COMMANDS = ['create', 'update', 'close', 'reopen', 'link'];

/**
 * Commands whose results can be cached for instant navigation.
 * @type {string[]}
 */
const CACHEABLE_COMMANDS = ['list', 'ready', 'blocked', 'stats'];

/**
 * Create shared action handlers for the main app component.
 * @param {object} ctx - Context with state setters and utilities.
 * @returns {{displayResult: Function, runCommand: Function, requestGraphData: Function, handleInlineActionResult: Function, clearOutput: Function, runInlineAction: Function, refreshCommand: Function}}
 */
function createAppActions(ctx) {
  const {
    parseListJSON,
    parseStatsOutput,
    setOutput,
    setIsError,
    setIsSuccess,
    setShowRelationshipPanel,
    setShowCreatePanel,
    setShowEditPanel,
    setShowHierarchyView,
    setShowBlockingView,
    setHierarchyModel,
    setBlockingModel,
    setCreateTitle,
    setCreateDescription,
    setCreateParentId,
    setCreateBlocksId,
    setCreateRelatedId,
    setCreateType,
    setCreatePriority,
    updateGraphPurpose,
    vscode,
    outputRef,
    beginCommandProgress = () => {},
    completeCommandProgress = () => {}
  } = ctx;

  /** @type {Map<string, {output: any, isError: boolean}>} */
  const pageCache = new Map();
  /** @type {Map<string, {sequence: number, refreshCommand: string|null, trackProgress: boolean}>} */
  const pendingSyncs = new Map();
  let actionSequence = 0;
  let syncRequestCounter = 0;

  const markUserAction = () => {
    actionSequence += 1;
    return actionSequence;
  };

  const queueBackgroundSync = ({ refreshCommand = null, trackProgress = false } = {}) => {
    syncRequestCounter += 1;
    const requestId = `sync-${syncRequestCounter}`;
    pendingSyncs.set(requestId, {
      sequence: actionSequence,
      refreshCommand,
      trackProgress
    });
    if (trackProgress) {
      beginCommandProgress('sync', 'background');
    }
    vscode.postMessage({
      type: 'executeCommand',
      command: 'sync',
      requestId,
      isBackgroundSync: true
    });
  };

  const closeAllPanels = () => {
    setShowRelationshipPanel(false);
    setShowCreatePanel(false);
    setShowEditPanel(false);
    setShowHierarchyView(false);
    setShowBlockingView(false);
  };

  const displayResult = (command, resultOutput, success, meta = {}) => {
    if (meta.isBackgroundSync && command === 'sync') {
      const pending = meta.requestId ? pendingSyncs.get(meta.requestId) : null;
      if (pending) {
        pendingSyncs.delete(meta.requestId);
        if (pending.trackProgress) {
          completeCommandProgress('sync');
        }
        if (!success) {
          const errorMessage = resultOutput || 'Command failed';
          if (pending.sequence === actionSequence) {
            setOutput(`❌ Error: ${errorMessage}`);
            setIsError(true);
            setIsSuccess(false);
          } else {
            console.error('Background sync failed:', errorMessage);
          }
          return;
        }
        if (pending.refreshCommand && pending.sequence === actionSequence) {
          runCommand(pending.refreshCommand, true, { suppressSequence: true });
        }
        return;
      }
      console.error('Background sync response missing request ID:', meta.requestId);
      return;
    }
    let parsed;
    if (command.includes('list') || command.includes('ready') || command.includes('blocked')) {
      parsed = parseListJSON(resultOutput, command);
      setOutput(parsed);
    } else if (command.includes('stats')) {
      parsed = parseStatsOutput(resultOutput);
      parsed.command = command;
      setOutput(parsed);
    } else {
      parsed = `$ bd ${command}\n\n${resultOutput}`;
      setOutput(parsed);
    }
    setIsError(!success);
    setIsSuccess(success);
    completeCommandProgress(command);

    // Cache successful results for cacheable commands
    const cacheKey = CACHEABLE_COMMANDS.find(c => command.includes(c));
    if (cacheKey && success) {
      pageCache.set(cacheKey, { output: parsed, isError: false });
    }

    if (success && MODIFYING_COMMANDS.some(cmd => command.includes(cmd))) {
      queueBackgroundSync({ trackProgress: true });
    }
  };

  const runInlineAction = (command, successMessage) => {
    markUserAction();
    beginCommandProgress(command, 'inline');
    vscode.postMessage({
      type: 'executeCommand',
      command,
      isInlineAction: true,
      successMessage
    });
  };

  const runCommand = (command, forceRefresh = false, options = {}) => {
    if (!options.suppressSequence) {
      markUserAction();
    }
    closeAllPanels();

    // Serve from cache if available and not forcing refresh
    const cacheKey = CACHEABLE_COMMANDS.find(c => command === c);
    if (!forceRefresh && cacheKey && pageCache.has(cacheKey)) {
      const cached = pageCache.get(cacheKey);
      setOutput(cached.output);
      setIsError(cached.isError);
      setIsSuccess(false);
      return;
    }

    setOutput(`$ bd ${command}\n\nExecuting...`);
    setIsError(false);
    setIsSuccess(false);
    beginCommandProgress(command, 'primary');

    const useJSON = command === 'list' || command === 'ready' || command === 'blocked';

    vscode.postMessage({
      type: 'executeCommand',
      command,
      useJSON
    });

  };

  /**
   * Force a fresh fetch for the given command, bypassing cache.
   * @param {string} command - The command to refresh
   */
  const refreshCommand = (command) => {
    runCommand(command, true);
  };

  const requestGraphData = (purpose = 'graph') => {
    updateGraphPurpose(purpose);
    setOutput(purpose === 'graph' ? 'Loading dependency graph...' : 'Loading hierarchy data...');
    setIsError(false);
    setIsSuccess(false);
    closeAllPanels();
    if (purpose !== 'graph') {
      setHierarchyModel(null);
    }

    vscode.postMessage({
      type: 'getGraphData'
    });
  };

  const requestBlockingData = () => {
    updateGraphPurpose('blocking');
    setOutput('Loading dependencies view...');
    setIsError(false);
    setIsSuccess(false);
    closeAllPanels();
    setBlockingModel(null);

    vscode.postMessage({
      type: 'getGraphData'
    });
  };

  const handleInlineActionResult = (message) => {
    const { command, output: cmdOutput, success, successMessage } = message;
    completeCommandProgress(command);
    if (success) {
      const currentOutput = outputRef.current;
      if (command.includes('create')) {
        setCreateTitle(''); setCreateDescription('');
        setCreateParentId(''); setCreateBlocksId(''); setCreateRelatedId('');
        setCreateType('task'); setCreatePriority('2');
      }
      if (successMessage) {
        const tempOutput = currentOutput;
        const restoreSequence = actionSequence;
        setOutput(`✓ ${successMessage}`);
        setIsSuccess(true); setIsError(false);
        setTimeout(() => {
          if (actionSequence === restoreSequence) {
            setOutput(tempOutput);
            setIsSuccess(false);
          }
        }, 2000);
      }
      if (MODIFYING_COMMANDS.some(cmd => command.includes(cmd))) {
        // Invalidate all cached pages since data changed
        pageCache.clear();
        const refreshCommand =
          typeof currentOutput === 'object' && currentOutput.command
            ? currentOutput.command
            : null;
        queueBackgroundSync({ refreshCommand });
      }
    } else {
      setOutput(`❌ Error: ${cmdOutput || 'Command failed'}`);
      setIsError(true); setIsSuccess(false);
    }
  };

  /**
   * Store a page result in the cache for instant navigation.
   * @param {string} command - The command that produced the result
   * @param {any} output - The parsed output to cache
   */
  const cachePageResult = (command, output) => {
    const cacheKey = CACHEABLE_COMMANDS.find(c => command.includes(c));
    if (cacheKey) {
      pageCache.set(cacheKey, { output, isError: false });
    }
  };

  const clearOutput = () => {
    setOutput('Ready to execute commands...');
    setIsError(false);
    setIsSuccess(false);
  };

  return {
    displayResult,
    runCommand,
    refreshCommand,
    requestGraphData,
    requestBlockingData,
    handleInlineActionResult,
    clearOutput,
    runInlineAction,
    closeAllPanels,
    cachePageResult
  };
}

module.exports = { createAppActions };
