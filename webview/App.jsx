import React, { useState, useEffect } from 'react';
import OutputDisplay from './components/OutputDisplay';
import CreatePanel from './components/CreatePanel';
import RelationshipPanel from './components/RelationshipPanel';

const vscode = acquireVsCodeApi();

// Main App Component
const App = () => {
  const [cwd, setCwd] = useState('Loading...');
  const [output, setOutput] = useState('Ready to execute commands...');
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [showRelationshipPanel, setShowRelationshipPanel] = useState(false);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [showCustomCommandPanel, setShowCustomCommandPanel] = useState(false);

  // Create issue form state
  const [createTitle, setCreateTitle] = useState('');
  const [createType, setCreateType] = useState('task');
  const [createPriority, setCreatePriority] = useState('2');
  const [createDescription, setCreateDescription] = useState('');

  // Relationship form state
  const [sourceBead, setSourceBead] = useState('');
  const [targetBead, setTargetBead] = useState('');
  const [relationType, setRelationType] = useState('parent');

  useEffect(() => {
    vscode.postMessage({ type: 'getCwd' });

    const messageHandler = (event) => {
      const message = event.data;
      
      switch (message.type) {
        case 'commandResult':
          displayResult(message.command, message.output, message.success);
          break;
        case 'cwdResult':
          setCwd(message.cwd);
          break;
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);

  const parseListOutput = (text) => {
    const lines = text.split('\n');
    const openIssues = [];
    const closedIssues = [];
    let currentIssue = null;
    let header = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('Found')) {
        header = line;
        continue;
      }

      if (line.includes('Ready work') || line.includes('blocked') || line.includes('No blocked')) {
        header = line;
        continue;
      }

      const readyMatch = line.match(/^\d+\.\s+\[([^\]]+)\]\s+([\w-]+):\s+(.+)$/);
      if (readyMatch) {
        const [, priority, id, title] = readyMatch;
        openIssues.push({ id, priority, type: 'task', status: 'open', title });
        continue;
      }

      const issueMatch = line.match(/^([\w-]+)\s+\[([^\]]+)\]\s+\[([^\]]+)\]\s+(\w+)/);
      if (issueMatch) {
        if (currentIssue) {
          if (currentIssue.status === 'closed') {
            closedIssues.push(currentIssue);
          } else {
            openIssues.push(currentIssue);
          }
        }

        const [, id, priority, type, status] = issueMatch;
        currentIssue = { id, priority, type, status, title: '' };
        continue;
      }

      if (currentIssue && line) {
        currentIssue.title += (currentIssue.title ? ' ' : '') + line;
      }
    }

    if (currentIssue) {
      if (currentIssue.status === 'closed') {
        closedIssues.push(currentIssue);
      } else {
        openIssues.push(currentIssue);
      }
    }

    return { type: 'list', command: '', header, openIssues, closedIssues };
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
    setShowCustomCommandPanel(false);

    vscode.postMessage({
      type: 'executeCommand',
      command: command
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

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      runCustomCommand();
    }
  };

  const runCustomCommand = () => {
    if (!commandInput.trim()) return;
    runCommand(commandInput);
  };

  const clearOutput = () => {
    setOutput('Ready to execute commands...');
    setIsError(false);
    setIsSuccess(false);
  };

  const handleCreateIssue = () => {
    if (!createTitle.trim()) {
      setOutput('Error: Title is required');
      setIsError(true);
      return;
    }

    let command = `create --title "${createTitle}" -t ${createType} -p ${createPriority}`;
    if (createDescription.trim()) {
      command += ` -d "${createDescription}"`;
    }

    runCommand(command);
    
    setCreateTitle('');
    setCreateDescription('');
    setCreateType('task');
    setCreatePriority('2');
    setShowCreatePanel(false);
  };

  const handleLinkBeads = () => {
    if (!sourceBead.trim() || !targetBead.trim()) {
      setOutput('Error: Please provide both source and target bead IDs');
      setIsError(true);
      return;
    }

    const command = `link add ${sourceBead} --${relationType} ${targetBead}`;
    runCommand(command);
    
    setSourceBead('');
    setTargetBead('');
    setShowRelationshipPanel(false);
  };

  const handleUnlinkBeads = () => {
    if (!sourceBead.trim() || !targetBead.trim()) {
      setOutput('Error: Please provide both source and target bead IDs');
      setIsError(true);
      return;
    }

    const command = `link remove ${sourceBead} --${relationType} ${targetBead}`;
    runCommand(command);
    
    setSourceBead('');
    setTargetBead('');
    setShowRelationshipPanel(false);
  };

  const handleInitBeads = () => {
    if (confirm('This will initialize beads in the current workspace. Continue?')) {
      runCommand('init --quiet');
    }
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
            <button className="action-btn" onClick={() => runCommand('list')}>📋 List</button>
            <button className="action-btn" onClick={() => runCommand('ready')}>✅ Ready</button>
            <button className="action-btn" onClick={() => runCommand('blocked')}>🚫 Blocked</button>
            <button className="action-btn" onClick={() => runCommand('stats')}>📊 Stats</button>
            <button className="action-btn" onClick={() => { clearOutput(); setShowCreatePanel(!showCreatePanel); setShowRelationshipPanel(false); setShowCustomCommandPanel(false); }}>➕ Create</button>
            <button className="action-btn" onClick={() => { clearOutput(); setShowRelationshipPanel(!showRelationshipPanel); setShowCreatePanel(false); setShowCustomCommandPanel(false); }}>🔗 Links</button>
            <button className="action-btn" onClick={() => { clearOutput(); setShowCustomCommandPanel(!showCustomCommandPanel); setShowRelationshipPanel(false); setShowCreatePanel(false); }}>✏️ Custom</button>
            <button className="action-btn" onClick={handleInitBeads}>🚀 Init</button>
          </div>
        </div>

        {showCreatePanel && (
          <CreatePanel
            title={createTitle}
            type={createType}
            priority={createPriority}
            description={createDescription}
            onTitleChange={setCreateTitle}
            onTypeChange={setCreateType}
            onPriorityChange={setCreatePriority}
            onDescriptionChange={setCreateDescription}
            onCreate={handleCreateIssue}
            onCancel={() => setShowCreatePanel(false)}
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

        {showCustomCommandPanel && (
          <div className="section">
            <div className="section-title">Custom Command</div>
            <div className="command-input-group">
              <div className="input-row">
                <div className="command-prefix">bd</div>
                <input
                  type="text"
                  id="command-input"
                  placeholder="Enter command..."
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                />
                <button className="run-btn" onClick={runCustomCommand}>▶</button>
              </div>
              <div className="common-commands">
                <button className="cmd-chip" onClick={() => setCommandInput('list --state open')}>open</button>
                <button className="cmd-chip" onClick={() => setCommandInput('show 1')}>show</button>
                <button className="cmd-chip" onClick={() => setCommandInput('update 1')}>update</button>
                <button className="cmd-chip" onClick={() => setCommandInput('close 1')}>close</button>
                <button className="cmd-chip" onClick={() => setCommandInput('link list 1')}>links</button>
                <button className="cmd-chip" onClick={() => setCommandInput('link graph 1')}>graph</button>
              </div>
            </div>
          </div>
        )}

        <div className="section output-section">
          <div className="output-header">
            <div className="section-title">Results</div>
            <button className="clear-btn" onClick={clearOutput}>Clear</button>
          </div>
          <OutputDisplay 
            output={output} 
            isError={isError} 
            isSuccess={isSuccess}
            onShowIssue={(id) => runCommand(`show ${id}`)}
            onCloseIssue={(id) => runCommand(`close ${id} -r "Closed from UI"`)}
            onReopenIssue={(id) => runCommand(`reopen ${id} -r "Reopened from UI"`)}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
