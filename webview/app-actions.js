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
    setShowDependencyGraph,
    updateGraphPurpose,
    vscode,
    outputRef
  } = ctx;

  /** @type {Map<string, {output: any, isError: boolean}>} */
  const pageCache = new Map();

  const closeAllPanels = () => {
    setShowRelationshipPanel(false);
    setShowCreatePanel(false);
    setShowEditPanel(false);
    setShowDependencyGraph(false);
    setShowHierarchyView(false);
    setShowBlockingView(false);
  };

  const displayResult = (command, resultOutput, success) => {
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

    // Cache successful results for cacheable commands
    const cacheKey = CACHEABLE_COMMANDS.find(c => command.includes(c));
    if (cacheKey && success) {
      pageCache.set(cacheKey, { output: parsed, isError: false });
    }
  };

  const runInlineAction = (command, successMessage) => {
    vscode.postMessage({
      type: 'executeCommand',
      command,
      isInlineAction: true,
      successMessage
    });
  };

  const runCommand = (command, forceRefresh = false) => {
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

    const useJSON = command === 'list' || command === 'ready' || command === 'blocked';

    vscode.postMessage({
      type: 'executeCommand',
      command,
      useJSON
    });

    const isModifying = MODIFYING_COMMANDS.some(cmd => command.includes(cmd));

    if (isModifying) {
      setTimeout(() => {
        vscode.postMessage({
          type: 'executeCommand',
          command: 'sync'
        });
      }, 1000);
    }
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
    if (success) {
      if (command.includes('create')) {
        setCreateTitle(''); setCreateDescription('');
        setCreateParentId(''); setCreateBlocksId(''); setCreateRelatedId('');
        setCreateType('task'); setCreatePriority('2');
      }
      if (successMessage) {
        const tempOutput = outputRef.current;
        setOutput(`✓ ${successMessage}`);
        setIsSuccess(true); setIsError(false);
        setTimeout(() => { setOutput(tempOutput); setIsSuccess(false); }, 2000);
      }
      if (MODIFYING_COMMANDS.some(cmd => command.includes(cmd))) {
        // Invalidate all cached pages since data changed
        pageCache.clear();
        setTimeout(() => {
          vscode.postMessage({ type: 'executeCommand', command: 'sync' });
          setTimeout(() => {
            const currentOutput = outputRef.current;
            if (typeof currentOutput === 'object' && currentOutput.command) runCommand(currentOutput.command, true);
          }, 500);
        }, 1000);
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
