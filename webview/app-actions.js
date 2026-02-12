/**
 * Create shared action handlers for the main app component.
 * @param {object} ctx - Context with state setters and utilities.
 * @returns {{displayResult: Function, runCommand: Function, requestGraphData: Function, handleInlineActionResult: Function, clearOutput: Function, runInlineAction: Function}}
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
    outputRef
  } = ctx;

  const displayResult = (command, resultOutput, success) => {
    if (command.includes('list') || command.includes('ready') || command.includes('blocked')) {
      const parsed = parseListJSON(resultOutput, command);
      setOutput(parsed);
    } else if (command.includes('stats')) {
      const parsed = parseStatsOutput(resultOutput);
      parsed.command = command;
      setOutput(parsed);
    } else {
      setOutput(`$ bd ${command}\n\n${resultOutput}`);
    }
    setIsError(!success);
    setIsSuccess(success);
  };

  const runInlineAction = (command, successMessage) => {
    vscode.postMessage({
      type: 'executeCommand',
      command,
      isInlineAction: true,
      successMessage
    });
  };

  const runCommand = (command) => {
    setOutput(`$ bd ${command}\n\nExecuting...`);
    setIsError(false);
    setIsSuccess(false);
    setShowRelationshipPanel(false);
    setShowCreatePanel(false);
    setShowEditPanel(false);
    setShowHierarchyView(false);

    const useJSON = command === 'list' || command === 'ready' || command === 'blocked';

    vscode.postMessage({
      type: 'executeCommand',
      command,
      useJSON
    });

    const modifyingCommands = ['create', 'update', 'close', 'reopen', 'link'];
    const isModifying = modifyingCommands.some(cmd => command.includes(cmd));

    if (isModifying) {
      setTimeout(() => {
        vscode.postMessage({
          type: 'executeCommand',
          command: 'sync'
        });
      }, 1000);
    }
  };

  const requestGraphData = (purpose = 'graph') => {
    updateGraphPurpose(purpose);
    setOutput(purpose === 'graph' ? 'Loading dependency graph...' : 'Loading hierarchy data...');
    setIsError(false);
    setIsSuccess(false);
    setShowRelationshipPanel(false);
    setShowCreatePanel(false);
    setShowEditPanel(false);
    setShowBlockingView(false);
    if (purpose === 'graph') {
      setShowHierarchyView(false);
    } else {
      setHierarchyModel(null);
      setShowHierarchyView(false);
    }

    vscode.postMessage({
      type: 'getGraphData'
    });
  };

  const requestBlockingData = () => {
    updateGraphPurpose('blocking');
    setOutput('Loading blocking view...');
    setIsError(false);
    setIsSuccess(false);
    setShowRelationshipPanel(false);
    setShowCreatePanel(false);
    setShowEditPanel(false);
    setShowHierarchyView(false);
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
      const modifyingCommands = ['create', 'update', 'close', 'reopen', 'link'];
      if (modifyingCommands.some(cmd => command.includes(cmd))) {
        setTimeout(() => {
          vscode.postMessage({ type: 'executeCommand', command: 'sync' });
          setTimeout(() => {
            const currentOutput = outputRef.current;
            if (typeof currentOutput === 'object' && currentOutput.command) runCommand(currentOutput.command);
          }, 500);
        }, 1000);
      }
    } else {
      setOutput(`❌ Error: ${cmdOutput || 'Command failed'}`);
      setIsError(true); setIsSuccess(false);
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
    requestGraphData,
    requestBlockingData,
    handleInlineActionResult,
    clearOutput,
    runInlineAction
  };
}

module.exports = { createAppActions };
