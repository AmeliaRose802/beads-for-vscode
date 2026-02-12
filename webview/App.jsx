import React, { useState, useEffect, useRef } from 'react';
import OutputDisplay from './components/OutputDisplay';
import CreatePanel from './components/CreatePanel';
import RelationshipPanel from './components/RelationshipPanel';
import EditPanel from './components/EditPanel';
import DependencyGraph from './components/DependencyGraph';
import HierarchyView from './components/HierarchyView';
const { parseListJSON, parseStatsOutput } = require('./parse-utils');
const { buildCreateCommand, buildUpdateCommand, createAssigneeChangeHandler } = require('./form-handlers');
const { buildHierarchyModel } = require('./hierarchy-utils');
const { processMessage } = require('./message-handler');
const { createAppActions } = require('./app-actions');

const vscode = acquireVsCodeApi();

// Main App Component
const App = () => {
  const [cwd, setCwd] = useState('Loading...');
  const [output, setOutput] = useState('Ready to execute commands...');
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showRelationshipPanel, setShowRelationshipPanel] = useState(false);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showDependencyGraph, setShowDependencyGraph] = useState(false);
  const [showHierarchyView, setShowHierarchyView] = useState(false);
  const [graphData, setGraphData] = useState(null);
  const [, setGraphRequestPurpose] = useState(null);
  const [, setHierarchyIssueId] = useState(null);
  const [hierarchyModel, setHierarchyModel] = useState(null);
  const graphPurposeRef = useRef(null);
  const hierarchyIssueRef = useRef(null);
  const outputRef = useRef(output);

  const updateGraphPurpose = (purpose) => {
    setGraphRequestPurpose(purpose);
    graphPurposeRef.current = purpose;
  };

  const updateHierarchyIssue = (issueId) => {
    setHierarchyIssueId(issueId);
    hierarchyIssueRef.current = issueId;
  };
  
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

  // Relationship form state
  const [sourceBead, setSourceBead] = useState('');
  const [targetBead, setTargetBead] = useState('');
  const [relationType, setRelationType] = useState('parent');

  const {
    displayResult,
    runCommand,
    requestGraphData,
    handleInlineActionResult,
    clearOutput,
    runInlineAction
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
    setHierarchyModel,
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
  });

  useEffect(() => {
    outputRef.current = output;
  }, [output]);

  useEffect(() => {
    vscode.postMessage({ type: 'getCwd' });
    vscode.postMessage({ type: 'getCurrentFile' });

    const messageHandler = (event) => {
      processMessage(event.data, {
        parseListJSON,
        displayResult,
        handleInlineActionResult,
        setOutput,
        setIsError,
        setCwd,
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
        setShowDependencyGraph,
        setHierarchyModel,
        setShowHierarchyView,
        buildHierarchyModel,
        updateGraphPurpose,
        graphPurposeRef,
        hierarchyIssueRef
      });
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);

  const handleQuickTypeChange = (issueId, newType) => {
    runInlineAction(`update ${issueId} --type ${newType}`, `Updated ${issueId} type to ${newType}`);
  };

  const handleQuickPriorityChange = (issueId, newPriority) => {
    runInlineAction(`update ${issueId} --priority ${newPriority}`, `Updated ${issueId} priority to P${newPriority}`);
  };

  // Create assignee change handler using the extracted function
  const handleAssigneeChange = createAssigneeChangeHandler(vscode, output, runCommand);

  const handleCreateIssue = () => {
    const command = buildCreateCommand({
      title: createTitle, type: createType, priority: createPriority,
      description: createDescription, parentId: createParentId,
      blocksId: createBlocksId, relatedId: createRelatedId, currentFile
    });
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
    // Don't fetch if already loaded or loading
    if (issueDetails[issueId] || loadingDetails[issueId]) {
      return;
    }

    // Mark as loading
    setLoadingDetails(prev => ({
      ...prev,
      [issueId]: true
    }));

    // Request details from extension
    vscode.postMessage({
      type: 'getIssueDetails',
      issueId: issueId
    });
  };

  const handleShowHierarchy = (issueId) => {
    updateHierarchyIssue(issueId);
    setShowDependencyGraph(false);
    setShowRelationshipPanel(false);
    setShowCreatePanel(false);
    setShowEditPanel(false);

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

  const handleDepAction = (action) => {
    if (!sourceBead.trim() || !targetBead.trim()) {
      setOutput('Error: Please provide both source and target bead IDs');
      setIsError(true);
      return;
    }
    const verb = action === 'add' ? 'Linked' : 'Unlinked';
    const arrow = action === 'add' ? '→' : '⇸';
    runInlineAction(`dep ${action} ${sourceBead} --${relationType} ${targetBead}`, `${verb} ${sourceBead} ${arrow} ${targetBead}`);
    setSourceBead('');
    setTargetBead('');
  };

  const handleUpdateIssue = () => {
    const command = buildUpdateCommand({
      issueId: editIssueId, title: editTitle, type: editType,
      priority: editPriority, description: editDescription, status: editStatus
    });
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
    // Request issue details from extension using list command with --json
    vscode.postMessage({
      type: 'executeCommand',
      command: `list --id ${id} --json`
    });
    
    setEditIssueId(id);
    setShowEditPanel(true);
    setShowCreatePanel(false);
    setShowRelationshipPanel(false);
  };

  return (
    <div className="container">
      <div className="header">
        <h1>🔮 Beads</h1>
        <div className="cwd">{cwd}</div>
      </div>

      <div className="main-content">
        <div className="section">
          <div className="section-title">Quick Actions</div>
          <div className="button-grid">
            <button className="action-btn" onClick={() => runCommand('list')} title="Show all issues (open, in progress, blocked)">📋 List</button>
            <button className="action-btn" onClick={() => runCommand('ready')} title="Show unblocked issues ready to work on">✅ Ready</button>
            <button className="action-btn" onClick={() => runCommand('blocked')} title="Show issues blocked by dependencies">🚫 Blocked</button>
            <button className="action-btn" onClick={() => runCommand('stats')} title="Show project statistics">📊 Stats</button>
            <button className="action-btn" onClick={() => { clearOutput(); setShowCreatePanel(!showCreatePanel); setShowRelationshipPanel(false); setShowDependencyGraph(false); }} title="Create a new issue">➕ Create</button>
            <button className="action-btn" onClick={() => { clearOutput(); setShowRelationshipPanel(!showRelationshipPanel); setShowCreatePanel(false); setShowDependencyGraph(false); }} title="Manage dependencies between issues">🔗 Links</button>
            <button className="action-btn" onClick={requestGraphData} title="Visualize dependency relationships as a graph">🔀 Graph</button>
          </div>
        </div>

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

        {showDependencyGraph && (
          <div className="section">
            <DependencyGraph
              graphData={graphData}
              onIssueClick={(issue) => handleShowIssueInline(issue.id)}
              onClose={() => setShowDependencyGraph(false)}
            />
          </div>
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

        {!showDependencyGraph && !showHierarchyView && (
          <div className="section output-section">
            <div className="output-header">
              <div className="section-title">Results</div>
              <button className="clear-btn" onClick={clearOutput}>Clear</button>
            </div>
            <OutputDisplay 
              output={output} 
              isError={isError} 
              isSuccess={isSuccess}
              onShowIssue={handleShowIssueInline}
              onCloseIssue={(id) => runInlineAction(`close ${id} -r "Closed from UI"`, `Closed ${id}`)}
              onReopenIssue={(id) => runInlineAction(`reopen ${id} -r "Reopened from UI"`, `Reopened ${id}`)}
              onEditIssue={handleEditIssue}
              onLinkParent={(childId, parentId) => runInlineAction(`dep add ${childId} --parent ${parentId}`, `Linked ${childId} → ${parentId}`)}
              onTypeChange={handleQuickTypeChange}
              onPriorityChange={handleQuickPriorityChange}
              onAssigneeChange={handleAssigneeChange}
              onShowHierarchy={handleShowHierarchy}
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
