import React, { useState, useEffect } from 'react';
import OutputDisplay from './components/OutputDisplay';
import CreatePanel from './components/CreatePanel';
import RelationshipPanel from './components/RelationshipPanel';
import EditPanel from './components/EditPanel';
import DependencyGraph from './components/DependencyGraph';

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
  const [graphData, setGraphData] = useState(null);
  
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

  useEffect(() => {
    vscode.postMessage({ type: 'getCwd' });
    vscode.postMessage({ type: 'getCurrentFile' });

    const messageHandler = (event) => {
      const message = event.data;
      
      switch (message.type) {
        case 'commandResultJSON':
          // Handle JSON list output
          const parsed = parseListJSON(message.output, message.command);
          if (parsed.type === 'error') {
            setOutput(parsed.message);
            setIsError(true);
          } else {
            setOutput(parsed);
            setIsError(false);
          }
          break;
        case 'commandResult':
          displayResult(message.command, message.output, message.success);
          break;
        case 'inlineActionResult':
          handleInlineActionResult(message);
          break;
        case 'cwdResult':
          setCwd(message.cwd);
          break;
        case 'currentFileResult':
          setCurrentFile(message.file || '');
          break;
        case 'issueDetails':
          // Populate edit form with issue details
          if (message.issue) {
            setEditTitle(message.issue.title || '');
            setEditType(message.issue.issue_type || 'task');
            setEditPriority(String(message.issue.priority || '2'));
            setEditDescription(message.issue.description || '');
            setEditStatus(message.issue.status || 'open');
          }
          break;
        case 'aiSuggestions':
          // Populate create form with AI suggestions
          setIsAILoading(false);
          if (message.suggestions) {
            const { type, priority, description, links } = message.suggestions;
            if (type) setCreateType(type);
            if (priority !== undefined) setCreatePriority(String(priority));
            
            // Parse links and populate separate fields
            let linkCount = 0;
            if (links) {
              const parentMatch = links.match(/--parent\s+([\w-]+)/);
              const blocksMatch = links.match(/--blocks\s+([\w-]+)/);
              const relatedMatch = links.match(/--related\s+([\w-]+)/);
              
              if (parentMatch) {
                setCreateParentId(parentMatch[1]);
                linkCount++;
              }
              if (blocksMatch) {
                setCreateBlocksId(blocksMatch[1]);
                linkCount++;
              }
              if (relatedMatch) {
                setCreateRelatedId(relatedMatch[1]);
                linkCount++;
              }
            }
            
            // Show AI reasoning as a toast/info message
            let message = `💡 AI Suggestion: ${description}`;
            if (linkCount > 0) {
              message += ` (${linkCount} relationship${linkCount > 1 ? 's' : ''} suggested)`;
            }
            setOutput(message);
            setIsSuccess(true);
            setTimeout(() => setIsSuccess(false), 3000);
          }
          if (message.error) {
            setOutput(`AI Suggestion Error: ${message.error}`);
            setIsError(true);
          }
          break;
        case 'inlineIssueDetails':
          // Update inline issue details without changing view
          if (message.issueId && message.details) {
            setIssueDetails(prev => ({
              ...prev,
              [message.issueId]: message.details
            }));
            setLoadingDetails(prev => ({
              ...prev,
              [message.issueId]: false
            }));
          }
          break;
        case 'graphData':
          // Handle dependency graph data
          if (message.data) {
            setGraphData(message.data);
            setShowDependencyGraph(true);
          }
          if (message.error) {
            setOutput(`Graph Error: ${message.error}`);
            setIsError(true);
          }
          break;
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);

  const parseListJSON = (jsonOutput, command) => {
    try {
      const issues = JSON.parse(jsonOutput);
      const openIssues = [];
      const closedIssues = [];
      
      issues.forEach(issue => {
        // Normalize the issue data
        const normalizedIssue = {
          id: issue.id,
          title: issue.title,
          type: issue.issue_type || 'task',
          priority: `p${issue.priority}`,
          status: issue.status,
          created_at: issue.created_at,
          updated_at: issue.updated_at,
          closed_at: issue.closed_at,
          description: issue.description,
          assignee: issue.assignee,
          dependency_count: issue.dependency_count || 0,
          dependent_count: issue.dependent_count || 0
        };
        
        if (issue.status === 'closed') {
          closedIssues.push(normalizedIssue);
        } else {
          openIssues.push(normalizedIssue);
        }
      });
      
      // Sort closed issues by closed_at (most recent first)
      closedIssues.sort((a, b) => {
        if (a.closed_at && b.closed_at) {
          return new Date(b.closed_at) - new Date(a.closed_at);
        }
        return 0;
      });
      
      return { 
        type: 'list', 
        command, 
        header: `Found ${openIssues.length} issue${openIssues.length !== 1 ? 's' : ''}`,
        openIssues, 
        closedIssues 
      };
    } catch (error) {
      console.error('Failed to parse JSON list output:', error);
      return { type: 'error', message: 'Failed to parse issue list', command };
    }
  };

  const parseStatsOutput = (text) => {
    const lines = text.split('\n');
    const stats = {};
    let header = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.includes('Statistics')) {
        header = trimmed;
        continue;
      }

      const match = trimmed.match(/^([^:]+):\s+(.+)$/);
      if (match) {
        const [, key, value] = match;
        stats[key.trim()] = value.trim();
      }
    }

    return { type: 'stats', header, stats };
  };

  const displayResult = (command, resultOutput, success) => {
    if (command.includes('list') || command.includes('ready') || command.includes('blocked')) {
      const parsed = parseListOutput(resultOutput);
      parsed.command = command;
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

  const runCommand = (command) => {
    setOutput(`$ bd ${command}\n\nExecuting...`);
    setIsError(false);
    setIsSuccess(false);
    setShowRelationshipPanel(false);
    setShowCreatePanel(false);
    setShowEditPanel(false);

    // Use JSON mode for list, ready, and blocked commands
    const useJSON = command === 'list' || command === 'ready' || command === 'blocked';
    
    vscode.postMessage({
      type: 'executeCommand',
      command: command,
      useJSON: useJSON
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

  const requestGraphData = () => {
    setOutput('Loading dependency graph...');
    setIsError(false);
    setIsSuccess(false);
    setShowRelationshipPanel(false);
    setShowCreatePanel(false);
    setShowEditPanel(false);
    
    vscode.postMessage({
      type: 'getGraphData'
    });
  };

  const handleInlineActionResult = (message) => {
    const { command, output: cmdOutput, success, successMessage } = message;
    
    if (success) {
      // Clear form if it was a create command
      if (command.includes('create')) {
        setCreateTitle('');
        setCreateDescription('');
        setCreateParentId('');
        setCreateBlocksId('');
        setCreateRelatedId('');
        setCreateType('task');
        setCreatePriority('2');
      }
      
      // Show brief success message
      if (successMessage) {
        const tempOutput = output;
        setOutput(`✓ ${successMessage}`);
        setIsSuccess(true);
        setIsError(false);
        
        // Restore previous output after brief delay
        setTimeout(() => {
          setOutput(tempOutput);
          setIsSuccess(false);
        }, 2000);
      }
      
      // Trigger sync for modifying commands
      const modifyingCommands = ['create', 'update', 'close', 'reopen', 'link'];
      const isModifying = modifyingCommands.some(cmd => command.includes(cmd));
      
      if (isModifying) {
        setTimeout(() => {
          vscode.postMessage({
            type: 'executeCommand',
            command: 'sync'
          });
          // Refresh the current view
          setTimeout(() => {
            if (typeof output === 'object' && output.command) {
              runCommand(output.command);
            }
          }, 500);
        }, 1000);
      }
    } else {
      // Show error message and keep form data
      setOutput(`❌ Error: ${cmdOutput || 'Command failed'}`);
      setIsError(true);
      setIsSuccess(false);
    }
  };

  const clearOutput = () => {
    setOutput('Ready to execute commands...');
    setIsError(false);
    setIsSuccess(false);
  };

  const handleQuickTypeChange = (issueId, newType) => {
    runInlineAction(`update ${issueId} --type ${newType}`, `Updated ${issueId} type to ${newType}`);
  };

  const handleQuickPriorityChange = (issueId, newPriority) => {
    runInlineAction(`update ${issueId} --priority ${newPriority}`, `Updated ${issueId} priority to P${newPriority}`);
  };

  const runInlineAction = (command, successMessage) => {
    // Execute command without clearing current view
    vscode.postMessage({
      type: 'executeCommand',
      command: command,
      isInlineAction: true,
      successMessage: successMessage
    });
  };

  const handleCreateIssue = () => {
    if (!createTitle.trim()) {
      setOutput('❌ Error: Title is required');
      setIsError(true);
      return;
    }

    let command = `create --title "${createTitle}" -t ${createType} -p ${createPriority}`;
    if (createDescription.trim()) {
      command += ` -d "${createDescription}"`;
    }
    
    // Add file reference to notes if available
    if (currentFile) {
      command += ` --notes "File: ${currentFile}"`;
    }
    
    // Build links using separate --deps flags for each relationship
    if (createParentId.trim()) {
      command += ` --deps parent:${createParentId.trim()}`;
    }
    if (createBlocksId.trim()) {
      command += ` --deps blocks:${createBlocksId.trim()}`;
    }
    if (createRelatedId.trim()) {
      command += ` --deps related:${createRelatedId.trim()}`;
    }

    runInlineAction(command, `Created new ${createType}`);
    // Form will be cleared by handleInlineActionResult on success
    // Don't close the panel - keep it open for creating more issues
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

  const handleLinkBeads = () => {
    if (!sourceBead.trim() || !targetBead.trim()) {
      setOutput('Error: Please provide both source and target bead IDs');
      setIsError(true);
      return;
    }

    const command = `dep add ${sourceBead} --${relationType} ${targetBead}`;
    runInlineAction(command, `Linked ${sourceBead} → ${targetBead}`);
    
    // Clear inputs but stay on the page
    setSourceBead('');
    setTargetBead('');
  };

  const handleUnlinkBeads = () => {
    if (!sourceBead.trim() || !targetBead.trim()) {
      setOutput('Error: Please provide both source and target bead IDs');
      setIsError(true);
      return;
    }

    const command = `dep remove ${sourceBead} --${relationType} ${targetBead}`;
    runInlineAction(command, `Unlinked ${sourceBead} ⇸ ${targetBead}`);
    
    // Clear inputs but stay on the page
    setSourceBead('');
    setTargetBead('');
  };

  const handleUpdateIssue = () => {
    if (!editTitle.trim()) {
      setOutput('Error: Title is required');
      setIsError(true);
      return;
    }

    let command = `update ${editIssueId}`;
    
    // Build update command with changed fields
    command += ` --title "${editTitle}"`;
    command += ` --type ${editType}`;
    command += ` --priority ${editPriority}`;
    command += ` --status ${editStatus}`;
    
    if (editDescription.trim()) {
      command += ` --description "${editDescription}"`;
    }

    runInlineAction(command, `Updated ${editIssueId}`);
    
    // Close edit panel
    setShowEditPanel(false);
    
    // Clear form
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
            onLink={handleLinkBeads}
            onUnlink={handleUnlinkBeads}
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

        {!showDependencyGraph && (
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
