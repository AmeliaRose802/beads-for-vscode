import React, { useState, useEffect, useRef } from 'react';
import OutputDisplay from './components/OutputDisplay';
import CreatePanel from './components/CreatePanel';
import RelationshipPanel from './components/RelationshipPanel';
import EditPanel from './components/EditPanel';
import HierarchyView from './components/HierarchyView';
import BlockingView from './components/BlockingView';
import CommandProgress from './components/CommandProgress';
import BeadsInitWarning from './components/BeadsInitWarning';
import PokePokeStatus from './components/PokePokeStatus';
import { useCommandProgress } from './hooks/useCommandProgress';
const { parseListJSON, parseStatsOutput } = require('./parse-utils');
const { buildCreateCommand, buildUpdateCommand, safeShellArg } = require('./form-handlers');
const { buildHierarchyModel } = require('./hierarchy-utils');
const { buildBlockingModel } = require('./blocking-utils');
const { processMessage } = require('./message-handler');
const { createAppActions } = require('./app-actions');
const vscode = acquireVsCodeApi();
// Main App Component
const App = () => {
  const [cwd, setCwd] = useState('Loading...');
  const [beadsStatus, setBeadsStatus] = useState(null);
  const [output, setOutput] = useState('Ready to execute commands...');
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showRelationshipPanel, setShowRelationshipPanel] = useState(false);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showHierarchyView, setShowHierarchyView] = useState(false);
  const [showBlockingView, setShowBlockingView] = useState(false);
  const [activeBlockingTab, setActiveBlockingTab] = useState('list');
  const [blockingModel, setBlockingModel] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [hierarchyModel, setHierarchyModel] = useState(null);
  const graphPurposeRef = useRef(null);
  const hierarchyIssueRef = useRef(null);
  const outputRef = useRef(output);
  const updateGraphPurpose = (purpose) => { graphPurposeRef.current = purpose; };
  const updateHierarchyIssue = (issueId) => { hierarchyIssueRef.current = issueId; };
  // Edit issue form state
  const [editIssueId, setEditIssueId] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState('task');
  const [editPriority, setEditPriority] = useState('2');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState('open');
  // Create issue form state
  const [createTitle, setCreateTitle] = useState('');
  const [createType, setCreateType] = useState('task');
  const [createPriority, setCreatePriority] = useState('2');
  const [createDescription, setCreateDescription] = useState('');
  const [createParentId, setCreateParentId] = useState('');
  const [createBlocksId, setCreateBlocksId] = useState('');
  const [createRelatedId, setCreateRelatedId] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [currentFile, setCurrentFile] = useState('');
  // Issue details state (for inline expansion)
  const [issueDetails, setIssueDetails] = useState({}); // Map of issueId -> details
  const [loadingDetails, setLoadingDetails] = useState({}); // Map of issueId -> boolean
  // PokePoke state
  const [pokepokeInstances, setPokepokeInstances] = useState([]);
  // Relationship form state
  const [sourceBead, setSourceBead] = useState('');
  const [targetBead, setTargetBead] = useState('');
  const [relationType, setRelationType] = useState('parent');
  const {
    pendingOperations,
    beginCommandProgress,
    completeCommandProgress
  } = useCommandProgress();
  const {
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
  } = createAppActions({
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
    beginCommandProgress,
    completeCommandProgress
  });
  useEffect(() => {
    outputRef.current = output;
  }, [output]);
  useEffect(() => {
    vscode.postMessage({ type: 'getCwd' });
    vscode.postMessage({ type: 'getCurrentFile' });
    vscode.postMessage({ type: 'getBeadsStatus' });

    const messageHandler = (event) => {
      processMessage(event.data, {
        parseListJSON,
        displayResult,
        handleInlineActionResult,
        cachePageResult,
        setOutput,
        setIsError,
        setCwd,
        setBeadsStatus,
        setCurrentFile,
        setEditTitle,
        setEditType,
        setEditPriority,
        setEditDescription,
        setEditStatus,
        setIsAILoading,
        setCreateType,
        setCreatePriority,
        setCreateParentId,
        setCreateBlocksId,
        setCreateRelatedId,
        setIsSuccess,
        setIssueDetails,
        setLoadingDetails,
        setGraphData,
        setHierarchyModel,
        setShowHierarchyView,
        setBlockingModel,
        setShowBlockingView,
        setPokepokeInstances,
        vscode,
        completeCommandProgress,
        buildHierarchyModel,
        buildBlockingModel,
        updateGraphPurpose,
        graphPurposeRef,
        hierarchyIssueRef
      });
    };
    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);
  const handleInitBeads = () => runInlineAction('init', 'Initialized beads in this workspace');
  const handleQuickTypeChange = (issueId, newType) =>
    runInlineAction(`update ${issueId} --type ${newType}`, `Updated ${issueId} type to ${newType}`);
  const handleQuickPriorityChange = (issueId, newPriority) =>
    runInlineAction(`update ${issueId} --priority ${newPriority}`, `Updated ${issueId} priority to P${newPriority}`);
  const handleAssigneeChange = (issueId, newAssignee) => new Promise((resolve, reject) => {
    const trimmedAssignee = newAssignee.trim();
    const assigneeArg = trimmedAssignee ? `--assignee ${safeShellArg(newAssignee)}` : '--assignee ""';
    const command = `update ${issueId} ${assigneeArg}`;
    const successMsg = trimmedAssignee
      ? `Assigned ${issueId} to ${newAssignee}`
      : `Cleared assignee for ${issueId}`;
    beginCommandProgress(command, 'inline');
    const messageHandler = (event) => {
      const message = event.data;
      if (message.type === 'inlineActionResult' && message.command === command) {
        window.removeEventListener('message', messageHandler);
        if (message.success) {
          resolve();
          setTimeout(() => {
            const currentOutput = outputRef.current;
            if (typeof currentOutput === 'object' && currentOutput.command) {
              runCommand(currentOutput.command);
            }
          }, 500);
        } else {
          reject(new Error(message.output || 'Failed to update assignee'));
        }
      }
    };
    window.addEventListener('message', messageHandler);
    vscode.postMessage({
      type: 'executeCommand',
      command,
      isInlineAction: true,
      successMessage: successMsg
    });
    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      completeCommandProgress(command);
      reject(new Error('Timeout updating assignee'));
    }, 5000);
  });
  const handleCreateIssue = () => {
    let command;
    try {
      command = buildCreateCommand({
        title: createTitle, type: createType, priority: createPriority,
        description: createDescription, parentId: createParentId,
        blocksId: createBlocksId, relatedId: createRelatedId, currentFile
      });
    } catch (error) {
      setOutput(`❌ Error: ${error.message}`);
      setIsError(true);
      return;
    }
    if (!command) {
      setOutput('❌ Error: Title is required');
      setIsError(true);
      return;
    }
    runInlineAction(command, `Created new ${createType}`);
  };
  const handleAISuggest = async () => {
    if (!createTitle.trim()) {
      setOutput('Error: Title is required for AI suggestions');
      setIsError(true);
      return;
    }
    setIsAILoading(true);
    setOutput('🤖 Analyzing issue with AI...');
    setIsError(false);
    setIsSuccess(false);
    // Request AI suggestions from extension
    vscode.postMessage({
      type: 'getAISuggestions',
      title: createTitle,
      currentDescription: createDescription
    });
  };
  const handleShowIssueInline = (issueId) => {
    if (issueDetails[issueId] || loadingDetails[issueId]) return;
    setLoadingDetails(prev => ({ ...prev, [issueId]: true }));
    vscode.postMessage({ type: 'getIssueDetails', issueId });
  };
  const handleShowHierarchy = (issueId) => {
    updateHierarchyIssue(issueId);
    closeAllPanels();
    if (graphData) {
      try {
        const model = buildHierarchyModel(issueId, graphData);
        setHierarchyModel(model);
        setShowHierarchyView(true);
      } catch (error) {
        setOutput(`Hierarchy Error: ${error.message}`);
        setIsError(true);
      }
    } else {
      requestGraphData('hierarchy');
    }
  };
  const handlePokePoke = (itemId, title, isTree) =>
    vscode.postMessage({ type: 'pokepokeLaunch', itemId, title, isTree });
  const handlePokePokeStop = (itemId) =>
    vscode.postMessage({ type: 'pokepokeStop', itemId });
  const handleDepAction = (action) => {
    if (!sourceBead.trim() || !targetBead.trim()) { setOutput('Error: Please provide both source and target bead IDs'); setIsError(true); return; }
    const beadIdPattern = /^[a-zA-Z0-9_-]+$/;
    if (!beadIdPattern.test(sourceBead.trim()) || !beadIdPattern.test(targetBead.trim())) { setOutput('Error: Bead IDs may only contain letters, numbers, hyphens, and underscores'); setIsError(true); return; }
    const verb = action === 'add' ? 'Linked' : 'Unlinked';
    const arrow = action === 'add' ? '→' : '⇸';
    runInlineAction(`dep ${action} ${sourceBead.trim()} --${relationType} ${targetBead.trim()}`, `${verb} ${sourceBead} ${arrow} ${targetBead}`);
    setSourceBead('');
    setTargetBead('');
  };

  const handleOpenDependencies = (tab = 'list') => {
    setActiveBlockingTab(tab);
    requestBlockingData();
  };

  const handleUpdateIssue = () => {
    let command;
    try {
      command = buildUpdateCommand({
        issueId: editIssueId, title: editTitle, type: editType,
        priority: editPriority, description: editDescription, status: editStatus
      });
    } catch (error) {
      setOutput(`Error: ${error.message}`);
      setIsError(true);
      return;
    }
    if (!command) {
      setOutput('Error: Title is required');
      setIsError(true);
      return;
    }
    runInlineAction(command, `Updated ${editIssueId}`);
    setShowEditPanel(false);
    setEditIssueId('');
    setEditTitle('');
    setEditDescription('');
    setEditType('task');
    setEditPriority('2');
    setEditStatus('open');
  };
  const handleEditIssue = (id) => {
    closeAllPanels();
    // Request issue details from extension using list command with --json
    vscode.postMessage({
      type: 'executeCommand',
      command: `list --id ${id} --json`
    });
    setEditIssueId(id);
    setShowEditPanel(true);
  };
  const handleCloseIssue = (id) =>
    runInlineAction(`close ${id} -r "Closed from UI"`, `Closed ${id}`);
  const handleReopenIssue = (id) =>
    runInlineAction(`reopen ${id} -r "Reopened from UI"`, `Reopened ${id}`);
  const shouldShowResultsPanel = !showHierarchyView && !showBlockingView;
  return (
    <div className="container">
      <div className="header">
        <h1>🔮 Beads</h1>
        <div className="cwd">{cwd}</div>
        <CommandProgress entries={pendingOperations} />
      </div>
      <div className="main-content">
        <BeadsInitWarning beadsStatus={beadsStatus} onInit={handleInitBeads} />
        <div className="section">
          <div className="section-title">Quick Actions</div>
          <div className="button-grid">
            <button className="action-btn" onClick={() => runCommand('list')} title="Show all issues including open, closed, and blocked">📋 List</button>
            <button className="action-btn" onClick={() => runCommand('ready')} title="Show unblocked issues ready to work on">✅ Ready</button>
            <button className="action-btn" onClick={() => runCommand('blocked')} title="Show issues blocked by dependencies">🚫 Blocked</button>
            <button className="action-btn" onClick={() => runCommand('stats')} title="Show project statistics">📊 Stats</button>
            <button className="action-btn" onClick={() => runCommand('dep cycles')} title="Detect blocking dependency cycles">🔄 Cycles</button>
            <button className="action-btn" onClick={() => { clearOutput(); closeAllPanels(); setShowCreatePanel(!showCreatePanel); }} title="Create a new issue">➕ Create</button>
            <button className="action-btn" onClick={() => { clearOutput(); closeAllPanels(); setShowRelationshipPanel(!showRelationshipPanel); }} title="Manage dependencies between issues">🔗 Add Links</button>
            <button className="action-btn" onClick={() => handleOpenDependencies('graph')} title="Visualize dependency relationships as a graph within Dependencies">🔀 Graph</button>
            <button className="action-btn" onClick={() => handleOpenDependencies('list')} title="View dependency chains and completion order">🔗 Dependencies</button>
          </div>
        </div>
        <PokePokeStatus instances={pokepokeInstances} onStop={handlePokePokeStop} vscode={vscode} />
        {showCreatePanel && (
          <CreatePanel
            title={createTitle}
            type={createType}
            priority={createPriority}
            description={createDescription}
            parentId={createParentId}
            blocksId={createBlocksId}
            relatedId={createRelatedId}
            currentFile={currentFile}
            onTitleChange={setCreateTitle}
            onTypeChange={setCreateType}
            onPriorityChange={setCreatePriority}
            onDescriptionChange={setCreateDescription}
            onParentIdChange={setCreateParentId}
            onBlocksIdChange={setCreateBlocksId}
            onRelatedIdChange={setCreateRelatedId}
            onCreate={handleCreateIssue}
            onCancel={() => setShowCreatePanel(false)}
            onAISuggest={handleAISuggest}
            isAILoading={isAILoading}
          />
        )}

        {showRelationshipPanel && (
          <RelationshipPanel
            sourceBead={sourceBead}
            targetBead={targetBead}
            relationType={relationType}
            onSourceChange={setSourceBead}
            onTargetChange={setTargetBead}
            onTypeChange={setRelationType}
            onLink={() => handleDepAction('add')}
            onUnlink={() => handleDepAction('remove')}
            onCancel={() => setShowRelationshipPanel(false)}
          />
        )}

        {showEditPanel && (
          <EditPanel
            issueId={editIssueId}
            title={editTitle}
            type={editType}
            priority={editPriority}
            description={editDescription}
            status={editStatus}
            onTitleChange={setEditTitle}
            onTypeChange={setEditType}
            onPriorityChange={setEditPriority}
            onDescriptionChange={setEditDescription}
            onStatusChange={setEditStatus}
            onUpdate={handleUpdateIssue}
            onCancel={() => setShowEditPanel(false)}
          />
        )}

        {showHierarchyView && (
          <div className="section">
            <HierarchyView
              hierarchy={hierarchyModel}
              onSelectIssue={(id) => {
                handleShowIssueInline(id);
                handleShowHierarchy(id);
              }}
              onClose={() => setShowHierarchyView(false)}
            />
          </div>
        )}

        {showBlockingView && (
          <div className="section">
            <BlockingView
              blockingModel={blockingModel}
              graphData={graphData}
              activeTab={activeBlockingTab}
              onTabChange={setActiveBlockingTab}
              onIssueClick={(issue) => handleShowIssueInline(issue.id)}
              onClose={() => setShowBlockingView(false)}
              issueDetails={issueDetails}
              loadingDetails={loadingDetails}
              onCloseIssue={handleCloseIssue}
              onReopenIssue={handleReopenIssue}
              onEditIssue={handleEditIssue}
              onTypeChange={handleQuickTypeChange}
              onPriorityChange={handleQuickPriorityChange}
              onAssigneeChange={handleAssigneeChange}
              onShowHierarchy={handleShowHierarchy}
              onPokePoke={handlePokePoke}
              pokepokeInstances={pokepokeInstances}
              vscode={vscode}
              onDepAction={(action, fromId, toId) => {
                runInlineAction(
                  `dep ${action} ${fromId} --blocks ${toId}`,
                  `${action === 'add' ? 'Linked' : 'Unlinked'} ${fromId} → ${toId}`
                );
              }}
            />
          </div>
        )}

        {shouldShowResultsPanel && (
          <div className="section output-section">
            <div className="output-header">
              <div className="section-title">Results</div>
              <div className="output-header__actions">
                {typeof output === 'object' && output.command && (
                  <button className="refresh-btn" onClick={() => refreshCommand(output.command)} title="Refresh data">🔄</button>
                )}
                <button className="clear-btn" onClick={clearOutput}>Clear</button>
              </div>
            </div>
            <OutputDisplay 
              output={output} 
              isError={isError} 
              isSuccess={isSuccess}
              onShowIssue={handleShowIssueInline}
              onCloseIssue={handleCloseIssue}
              onReopenIssue={handleReopenIssue}
              onEditIssue={handleEditIssue}
              onLinkParent={(childId, parentId) => runInlineAction(`dep add ${childId} --parent ${parentId}`, `Linked ${childId} → ${parentId}`)}
              onTypeChange={handleQuickTypeChange}
              onPriorityChange={handleQuickPriorityChange}
              onAssigneeChange={handleAssigneeChange}
              onShowHierarchy={handleShowHierarchy}
              onPokePoke={handlePokePoke}
              pokepokeInstances={pokepokeInstances}
              issueDetails={issueDetails}
              loadingDetails={loadingDetails}
              vscode={vscode}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
