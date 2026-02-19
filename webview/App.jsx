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
import ParallelPhaseDispatchDialog from './components/ParallelPhaseDispatchDialog';
import { useCommandProgress } from './hooks/useCommandProgress';
import { useParallelPhaseDispatch } from './hooks/useParallelPhaseDispatch';
import { createAssigneeChangeHandler } from './hooks/createAssigneeChangeHandler';
import { useEditFormState } from './hooks/useEditFormState';
import { useCreateFormState } from './hooks/useCreateFormState';
import { useRelationshipFormState } from './hooks/useRelationshipFormState';
import { usePanelVisibility } from './hooks/usePanelVisibility';
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
  const [blockingModel, setBlockingModel] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [hierarchyModel, setHierarchyModel] = useState(null);
  const outputRef = useRef(output);
  const [isAILoading, setIsAILoading] = useState(false);
  const [currentFile, setCurrentFile] = useState('');
  const [issueDetails, setIssueDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});
  const [pokepokeInstances, setPokepokeInstances] = useState([]);
  const [gitHubInfo, setGitHubInfo] = useState({
    authenticated: false, account: null, repo: null, copilotAssignees: ['github-copilot']
  });
  // Custom hooks for form and panel state
  const editForm = useEditFormState();
  const createForm = useCreateFormState();
  const relationshipForm = useRelationshipFormState();
  const panels = usePanelVisibility();
  const { parallelPhaseDispatch, openParallelPhaseDispatch, startParallelPhaseDispatch,
    cancelParallelPhaseDispatch, closeParallelPhaseDispatch, handleParallelPhaseDispatchMessage } =
    useParallelPhaseDispatch({ vscode, gitHubInfo });
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
    cachePageResult
  } = createAppActions({
    parseListJSON,
    parseStatsOutput,
    setOutput,
    setIsError,
    setIsSuccess,
    setShowRelationshipPanel: panels.setShowRelationshipPanel,
    setShowCreatePanel: panels.setShowCreatePanel,
    setShowEditPanel: panels.setShowEditPanel,
    setShowHierarchyView: panels.setShowHierarchyView,
    setShowBlockingView: panels.setShowBlockingView,
    setHierarchyModel,
    setBlockingModel,
    setCreateTitle: createForm.setCreateTitle,
    setCreateDescription: createForm.setCreateDescription,
    setCreateParentId: createForm.setCreateParentId,
    setCreateBlocksId: createForm.setCreateBlocksId,
    setCreateRelatedId: createForm.setCreateRelatedId,
    setCreateType: createForm.setCreateType,
    setCreatePriority: createForm.setCreatePriority,
    updateGraphPurpose: panels.updateGraphPurpose,
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
    vscode.postMessage({ type: 'getGitHubInfo', silent: true });

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
        setEditTitle: editForm.setEditTitle,
        setEditType: editForm.setEditType,
        setEditPriority: editForm.setEditPriority,
        setEditDescription: editForm.setEditDescription,
        setEditStatus: editForm.setEditStatus,
        setIsAILoading,
        setCreateType: createForm.setCreateType,
        setCreatePriority: createForm.setCreatePriority,
        setCreateParentId: createForm.setCreateParentId,
        setCreateBlocksId: createForm.setCreateBlocksId,
        setCreateRelatedId: createForm.setCreateRelatedId,
        setIsSuccess,
        setIssueDetails,
        setLoadingDetails,
        setGraphData,
        setHierarchyModel,
        setShowHierarchyView: panels.setShowHierarchyView,
        setBlockingModel,
        setShowBlockingView: panels.setShowBlockingView,
        setPokepokeInstances,
        setGitHubInfo,
        handleParallelPhaseDispatch: handleParallelPhaseDispatchMessage,
        vscode,
        completeCommandProgress,
        buildHierarchyModel,
        buildBlockingModel,
        updateGraphPurpose: panels.updateGraphPurpose,
        graphPurposeRef: panels.graphPurposeRef,
        hierarchyIssueRef: panels.hierarchyIssueRef
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
  const handleAssigneeChange = createAssigneeChangeHandler({
    safeShellArg,
    beginCommandProgress,
    completeCommandProgress,
    outputRef,
    runCommand,
    vscode
  });
  const handleCreateIssue = () => {
    let command;
    try {
      command = buildCreateCommand({
        title: createForm.createTitle, type: createForm.createType, priority: createForm.createPriority,
        description: createForm.createDescription, parentId: createForm.createParentId,
        blocksId: createForm.createBlocksId, relatedId: createForm.createRelatedId, currentFile
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
    runInlineAction(command, `Created new ${createForm.createType}`);
  };
  const handleAISuggest = async () => {
    if (!createForm.createTitle.trim()) {
      setOutput('Error: Title is required for AI suggestions');
      setIsError(true);
      return;
    }
    setIsAILoading(true);
    setOutput('🤖 Analyzing issue with AI...');
    setIsError(false);
    setIsSuccess(false);
    vscode.postMessage({
      type: 'getAISuggestions',
      title: createForm.createTitle,
      currentDescription: createForm.createDescription
    });
  };
  const handleShowIssueInline = (issueId) => {
    if (issueDetails[issueId] || loadingDetails[issueId]) return;
    setLoadingDetails(prev => ({ ...prev, [issueId]: true }));
    vscode.postMessage({ type: 'getIssueDetails', issueId });
  };
  const handleShowHierarchy = (issueId) => {
    panels.updateHierarchyIssue(issueId);
    panels.closeAllPanels();
    if (graphData) {
      try {
        const model = buildHierarchyModel(issueId, graphData);
        setHierarchyModel(model);
        panels.setShowHierarchyView(true);
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
  const handleConvertToGitHub = (issueId) => {
    if (!issueId) {
      return;
    }
    const commandId = `convertToGitHub:${issueId}`;
    beginCommandProgress(commandId, 'inline');
    setOutput(`🐙 Converting ${issueId} to a GitHub issue...`);
    setIsError(false);
    setIsSuccess(false);
    vscode.postMessage({ type: 'convertToGitHub', issueId, commandKey: commandId });
  };

  const handleDepAction = (action) => {
    const { sourceBead, targetBead, relationType } = relationshipForm;
    if (!sourceBead.trim() || !targetBead.trim()) { setOutput('Error: Please provide both source and target bead IDs'); setIsError(true); return; }
    const beadIdPattern = /^[a-zA-Z0-9_-]+$/;
    if (!beadIdPattern.test(sourceBead.trim()) || !beadIdPattern.test(targetBead.trim())) { setOutput('Error: Bead IDs may only contain letters, numbers, hyphens, and underscores'); setIsError(true); return; }
    const verb = action === 'add' ? 'Linked' : 'Unlinked';
    const arrow = action === 'add' ? '→' : '⇸';
    runInlineAction(`dep ${action} ${sourceBead.trim()} --${relationType} ${targetBead.trim()}`, `${verb} ${sourceBead} ${arrow} ${targetBead}`);
    relationshipForm.resetRelationshipForm();
  };

  const handleOpenDependencies = (tab = 'list') => {
    panels.setActiveBlockingTab(tab);
    requestBlockingData();
  };

  const handleUpdateIssue = () => {
    let command;
    try {
      command = buildUpdateCommand({
        issueId: editForm.editIssueId, title: editForm.editTitle, type: editForm.editType,
        priority: editForm.editPriority, description: editForm.editDescription, status: editForm.editStatus
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
    runInlineAction(command, `Updated ${editForm.editIssueId}`);
    panels.setShowEditPanel(false);
    editForm.resetEditForm();
  };
  const handleEditIssue = (id) => {
    panels.closeAllPanels();
    vscode.postMessage({
      type: 'executeCommand',
      command: `list --id ${id} --json`
    });
    editForm.setEditIssueId(id);
    panels.setShowEditPanel(true);
  };
  const handleCloseIssue = (id) =>
    runInlineAction(`close ${id} -r "Closed from UI"`, `Closed ${id}`);
  const handleReopenIssue = (id) =>
    runInlineAction(`reopen ${id} -r "Reopened from UI"`, `Reopened ${id}`);
  const shouldShowResultsPanel = !panels.showHierarchyView && !panels.showBlockingView;
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
            <button className="action-btn" onClick={() => { clearOutput(); panels.closeAllPanels(); panels.setShowCreatePanel(!panels.showCreatePanel); }} title="Create a new issue">➕ Create</button>
            <button className="action-btn" onClick={() => { clearOutput(); panels.closeAllPanels(); panels.setShowRelationshipPanel(!panels.showRelationshipPanel); }} title="Manage dependencies between issues">🔗 Add Links</button>
            <button className="action-btn" onClick={() => handleOpenDependencies('task-graph')} title="Visualize dependency relationships as a graph within Dependencies">🔀 Graph</button>
            <button className="action-btn" onClick={() => handleOpenDependencies('list')} title="View dependency chains and completion order">🔗 Dependencies</button>
          </div>
        </div>
        <PokePokeStatus instances={pokepokeInstances} onStop={handlePokePokeStop} vscode={vscode} />
        {panels.showCreatePanel && (
          <CreatePanel
            title={createForm.createTitle}
            type={createForm.createType}
            priority={createForm.createPriority}
            description={createForm.createDescription}
            parentId={createForm.createParentId}
            blocksId={createForm.createBlocksId}
            relatedId={createForm.createRelatedId}
            currentFile={currentFile}
            onTitleChange={createForm.setCreateTitle}
            onTypeChange={createForm.setCreateType}
            onPriorityChange={createForm.setCreatePriority}
            onDescriptionChange={createForm.setCreateDescription}
            onParentIdChange={createForm.setCreateParentId}
            onBlocksIdChange={createForm.setCreateBlocksId}
            onRelatedIdChange={createForm.setCreateRelatedId}
            onCreate={handleCreateIssue}
            onCancel={() => panels.setShowCreatePanel(false)}
            onAISuggest={handleAISuggest}
            isAILoading={isAILoading}
          />
        )}

        {panels.showRelationshipPanel && (
          <RelationshipPanel
            sourceBead={relationshipForm.sourceBead}
            targetBead={relationshipForm.targetBead}
            relationType={relationshipForm.relationType}
            onSourceChange={relationshipForm.setSourceBead}
            onTargetChange={relationshipForm.setTargetBead}
            onTypeChange={relationshipForm.setRelationType}
            onLink={() => handleDepAction('add')}
            onUnlink={() => handleDepAction('remove')}
            onCancel={() => panels.setShowRelationshipPanel(false)}
          />
        )}

        {panels.showEditPanel && (
          <EditPanel
            issueId={editForm.editIssueId}
            title={editForm.editTitle}
            type={editForm.editType}
            priority={editForm.editPriority}
            description={editForm.editDescription}
            status={editForm.editStatus}
            onTitleChange={editForm.setEditTitle}
            onTypeChange={editForm.setEditType}
            onPriorityChange={editForm.setEditPriority}
            onDescriptionChange={editForm.setEditDescription}
            onStatusChange={editForm.setEditStatus}
            onUpdate={handleUpdateIssue}
            onCancel={() => panels.setShowEditPanel(false)}
          />
        )}

        {panels.showHierarchyView && (
          <div className="section">
            <HierarchyView
              hierarchy={hierarchyModel}
              onSelectIssue={(id) => {
                handleShowIssueInline(id);
                handleShowHierarchy(id);
              }}
              onClose={() => panels.setShowHierarchyView(false)}
            />
          </div>
        )}

        {panels.showBlockingView && (
          <div className="section">
            <BlockingView
              blockingModel={blockingModel}
              graphData={graphData}
              activeTab={panels.activeBlockingTab}
              onTabChange={panels.setActiveBlockingTab}
              onIssueClick={(issue) => handleShowIssueInline(issue.id)}
              onClose={() => panels.setShowBlockingView(false)}
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
              onConvertToGitHub={handleConvertToGitHub}
              onDispatchPhase={openParallelPhaseDispatch}
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
              onConvertToGitHub={handleConvertToGitHub}
              pokepokeInstances={pokepokeInstances}
              issueDetails={issueDetails}
              loadingDetails={loadingDetails}
              vscode={vscode}
            />
          </div>
        )}

        <ParallelPhaseDispatchDialog
          open={parallelPhaseDispatch.open}
          phaseIndex={parallelPhaseDispatch.phaseIndex}
          repo={gitHubInfo.repo}
          items={parallelPhaseDispatch.items}
          assignments={parallelPhaseDispatch.assignments}
          progressById={parallelPhaseDispatch.progressById}
          running={parallelPhaseDispatch.running}
          completed={parallelPhaseDispatch.completed}
          summary={parallelPhaseDispatch.summary}
          error={parallelPhaseDispatch.error}
          onCancel={cancelParallelPhaseDispatch}
          onStart={startParallelPhaseDispatch}
          onClose={closeParallelPhaseDispatch}
        />
      </div>
    </div>
  );
};

export default App;
