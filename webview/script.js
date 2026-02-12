const vscode = acquireVsCodeApi();

// Initialize
window.addEventListener('load', () => {
  vscode.postMessage({ type: 'getCwd' });
});

// Handle messages from extension
window.addEventListener('message', event => {
  const message = event.data;
  
  switch (message.type) {
    case 'commandResult':
      displayResult(message.command, message.output, message.success);
      break;
    case 'cwdResult':
      document.getElementById('cwd').textContent = message.cwd;
      break;
  }
});

/**
 * Executes a bd command via vscode message.
 * @param {string} command - The bd command to execute.
 */
function runCommand(command) {
  const output = document.getElementById('output');
  output.textContent = `$ bd ${command}\n\nExecuting...`;
  output.className = 'output';
  
  // Hide all panels when running a command
  hideRelationshipPanel();
  hideCreatePanel();
  
  vscode.postMessage({
    type: 'executeCommand',
    command: command
  });
}

/**
 * Displays command results in the output area.
 * @param {string} command - The bd command that was executed.
 * @param {string} resultOutput - The raw output from the command.
 * @param {boolean} success - Whether the command succeeded.
 */
function displayResult(command, resultOutput, success) {
  const output = document.getElementById('output');
  
  // Format the output for better readability
  let formattedOutput = resultOutput;
  
  // Check if this is a list command output
  if (command.includes('list') || command.includes('ready') || command.includes('blocked')) {
    formattedOutput = formatListOutput(resultOutput);
  } else if (command.includes('show')) {
    formattedOutput = formatShowOutput(resultOutput);
  } else if (command.includes('stats')) {
    formattedOutput = formatStatsOutput(resultOutput);
  } else {
    // For other commands, preserve formatting but escape HTML
    formattedOutput = `<pre style="margin: 0; font-family: inherit; white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(resultOutput)}</pre>`;
  }
  
  output.innerHTML = `<div style="color: var(--vscode-descriptionForeground); margin-bottom: 8px;">$ bd ${command}</div>\n${formattedOutput}`;
  output.className = success ? 'output success' : 'output error';
}

/**
 * Formats bd show output as HTML.
 * @param {string} text - The raw text output from bd show.
 * @returns {string} Formatted HTML string.
 */
function formatShowOutput(text) {
  const lines = text.split('\n');
  let html = '';
  let title = '';
  let metadata = {};
  let description = '';
  let inDescription = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Parse title (first line with ID)
    if (i === 0 && line.includes(':')) {
      const parts = line.split(':');
      const id = parts[0].trim();
      title = parts.slice(1).join(':').trim();
      html += `<div style="margin-bottom: 16px;">
        <div style="font-size: 14px; font-weight: 600; color: var(--vscode-textLink-foreground); margin-bottom: 8px;">${escapeHtml(id)}</div>
        <div style="font-size: 13px; color: var(--vscode-foreground);">${escapeHtml(title)}</div>
      </div>`;
      continue;
    }
    
    // Parse metadata
    if (line.includes(':') && !inDescription) {
      const colonIndex = line.indexOf(':');
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      
      if (key === 'Description') {
        inDescription = true;
        html += `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--vscode-panel-border);">
          <div style="font-weight: 600; margin-bottom: 6px; color: var(--vscode-descriptionForeground);">Description:</div>`;
        continue;
      }
      
      if (key && value) {
        const valueColor = key === 'Status' ? getStatusColor(value) :
                          key === 'Priority' ? getPriorityColor(value) :
                          'var(--vscode-foreground)';
        
        html += `<div style="display: flex; gap: 8px; margin-bottom: 4px; font-size: 11px;">
          <span style="color: var(--vscode-descriptionForeground); min-width: 70px;">${escapeHtml(key)}:</span>
          <span style="color: ${valueColor}; font-weight: 500;">${escapeHtml(value)}</span>
        </div>`;
      }
    } else if (inDescription && line.trim()) {
      html += `<div style="color: var(--vscode-foreground); padding: 8px; background: var(--vscode-textBlockQuote-background); border-left: 3px solid var(--vscode-textBlockQuote-border); border-radius: 2px; margin-top: 6px; line-height: 1.4;">${escapeHtml(line.trim())}</div>`;
    }
  }
  
  if (inDescription) {
    html += '</div>';
  }
  
  return html || `<pre style="margin: 0;">${escapeHtml(text)}</pre>`;
}

/**
 * Formats bd stats output as HTML.
 * @param {string} text - The raw text output from bd stats.
 * @returns {string} Formatted HTML string.
 */
function formatStatsOutput(text) {
  const lines = text.split('\n');
  let html = '';
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    if (line.includes(':')) {
      const [key, value] = line.split(':').map(s => s.trim());
      html += `<div style="display: flex; justify-content: space-between; padding: 6px 8px; margin-bottom: 4px; background: var(--vscode-editor-background); border-radius: 3px;">
        <span style="color: var(--vscode-descriptionForeground);">${escapeHtml(key)}</span>
        <span style="color: var(--vscode-terminal-ansiCyan); font-weight: 600;">${escapeHtml(value)}</span>
      </div>`;
    } else {
      html += `<div style="font-weight: 600; margin-top: 12px; margin-bottom: 6px; color: var(--vscode-foreground);">${escapeHtml(line)}</div>`;
    }
  }
  
  return html || `<pre style="margin: 0;">${escapeHtml(text)}</pre>`;
}

/**
 * Returns a CSS color variable for the given issue status.
 * @param {string} status - The issue status (e.g., 'open', 'in_progress', 'closed', 'blocked').
 * @returns {string} A CSS variable string for the status color.
 */
function getStatusColor(status) {
  const s = status.toLowerCase();
  if (s === 'open') return 'var(--vscode-terminal-ansiBlue)';
  if (s === 'in_progress') return 'var(--vscode-terminal-ansiYellow)';
  if (s === 'closed') return 'var(--vscode-terminal-ansiGreen)';
  if (s === 'blocked') return 'var(--vscode-errorForeground)';
  return 'var(--vscode-foreground)';
}

/**
 * Returns a CSS color variable for the given priority level.
 * @param {string} priority - The priority level (e.g., 'P0', 'P1').
 * @returns {string} A CSS variable string for the priority color.
 */
function getPriorityColor(priority) {
  if (priority === 'P0') return 'var(--vscode-errorForeground)';
  if (priority === 'P1') return 'var(--vscode-terminal-ansiYellow)';
  return 'var(--vscode-descriptionForeground)';
}

/**
 * Formats bd list output as HTML.
 * @param {string} text - The raw text output from bd list, ready, or blocked commands.
 * @returns {string} Formatted HTML string.
 */
function formatListOutput(text) {
  // Parse beads list output and format it beautifully
  const lines = text.split('\n');
  let openIssuesHtml = '';
  let closedIssuesHtml = '';
  let currentIssue = null;
  let currentIssueHtml = '';
  let headerHtml = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) continue;
    
    // Header line (e.g., "Found 4 issues:")
    if (line.startsWith('Found')) {
      headerHtml = `<div style="color: var(--vscode-textPreformat-foreground); font-weight: 600; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--vscode-panel-border);">${escapeHtml(line)}</div>`;
      continue;
    }
    
    // Issue header line (e.g., "beads_ui-1 [P1] [feature] open")
    const issueMatch = line.match(/^([\w-]+)\s+\[([^\]]+)\]\s+\[([^\]]+)\]\s+(\w+)/);
    if (issueMatch) {
      // Save previous issue if exists
      if (currentIssue) {
        currentIssueHtml += '</div>';
        if (currentIssue.status === 'closed') {
          closedIssuesHtml += currentIssueHtml;
        } else {
          openIssuesHtml += currentIssueHtml;
        }
      }
      
      const [, id, priority, type, status] = issueMatch;
      
      // Color coding
      const priorityColor = priority === 'P0' ? 'var(--vscode-errorForeground)' :
                            priority === 'P1' ? 'var(--vscode-terminal-ansiYellow)' :
                            'var(--vscode-descriptionForeground)';
      
      const statusColor = status === 'open' ? 'var(--vscode-terminal-ansiBlue)' :
                          status === 'in_progress' ? 'var(--vscode-terminal-ansiYellow)' :
                          status === 'closed' ? 'var(--vscode-terminal-ansiGreen)' :
                          status === 'blocked' ? 'var(--vscode-errorForeground)' :
                          'var(--vscode-foreground)';
      
      const typeColor = type === 'bug' ? 'var(--vscode-errorForeground)' :
                       type === 'feature' ? 'var(--vscode-terminal-ansiCyan)' :
                       'var(--vscode-foreground)';
      
      currentIssueHtml = `
        <div style="margin-bottom: 12px; padding: 8px; background-color: var(--vscode-editor-background); border-left: 3px solid ${priorityColor}; border-radius: 3px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="font-family: var(--vscode-editor-font-family); font-weight: 600; color: var(--vscode-textLink-foreground);">${escapeHtml(id)}</span>
            <span style="background: ${priorityColor}; color: var(--vscode-badge-foreground); padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 600;">${escapeHtml(priority)}</span>
            <span style="background: ${typeColor}; color: var(--vscode-badge-foreground); padding: 2px 6px; border-radius: 3px; font-size: 10px;">${escapeHtml(type)}</span>
            <span style="color: ${statusColor}; font-size: 11px; font-weight: 500;">● ${escapeHtml(status)}</span>
          </div>`;
      
      currentIssue = { id, priority, type, status };
      continue;
    }
    
    // Issue title/description (indented lines after the header)
    if (currentIssue && line) {
      currentIssueHtml += `<div style="color: var(--vscode-foreground); font-size: 12px; line-height: 1.4;">${escapeHtml(line)}</div>`;
    } else if (line) {
      // Any other line
      openIssuesHtml += `<div style="margin-bottom: 4px;">${escapeHtml(line)}</div>`;
    }
  }
  
  // Save last issue if exists
  if (currentIssue) {
    currentIssueHtml += '</div>';
    if (currentIssue.status === 'closed') {
      closedIssuesHtml += currentIssueHtml;
    } else {
      openIssuesHtml += currentIssueHtml;
    }
  }
  
  // Build final HTML with closed items in collapsible section
  let finalHtml = headerHtml + openIssuesHtml;
  
  if (closedIssuesHtml) {
    const closedCount = (closedIssuesHtml.match(/margin-bottom: 12px;/g) || []).length;
    finalHtml += `
      <details style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--vscode-panel-border);">
        <summary style="cursor: pointer; font-size: 12px; font-weight: 600; color: var(--vscode-descriptionForeground); padding: 6px; margin-bottom: 8px; user-select: none;">
          ✓ Closed (${closedCount})
        </summary>
        <div style="margin-top: 8px;">
          ${closedIssuesHtml}
        </div>
      </details>`;
  }
  
  return finalHtml || escapeHtml(text);
}

/**
 * Escapes HTML special characters in the given text.
 * @param {string} text - The text to escape.
 * @returns {string} The HTML-escaped text.
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Runs the command currently entered in the command input field.
 */
function runCustomCommand() {
  const commandInput = document.getElementById('command-input');
  const command = commandInput.value.trim();
  
  if (!command) return;
  
  runCommand(command);
}

/**
 * Sets the command input field value and focuses it.
 * @param {string} command - The command string to set.
 */
function setCommand(command) {
  document.getElementById('command-input').value = command;
  document.getElementById('command-input').focus();
}

/**
 * Clears the output display area.
 */
function clearOutput() {
  const output = document.getElementById('output');
  output.textContent = 'Ready to execute commands...';
  output.className = 'output';
}

/**
 * Handles keypress events in the command input, executing on Enter.
 * @param {KeyboardEvent} event - The keyboard event.
 */
function handleKeyPress(event) {
  if (event.key === 'Enter') {
    runCustomCommand();
  }
}

/**
 * Toggles visibility of the create issue panel.
 */
function showCreateIssue() {
  const panel = document.getElementById('create-panel');
  if (panel.style.display === 'none') {
    hideRelationshipPanel(); // Hide other panels
    panel.style.display = 'block';
    document.getElementById('create-title').focus();
  } else {
    panel.style.display = 'none';
  }
}

/**
 * Hides the create issue panel and resets its form inputs.
 */
function hideCreatePanel() {
  document.getElementById('create-panel').style.display = 'none';
  // Clear inputs
  document.getElementById('create-title').value = '';
  document.getElementById('create-description').value = '';
  document.getElementById('create-type').value = 'task';
  document.getElementById('create-priority').value = '2';
}

/**
 * Creates a new issue from the create issue form data.
 */
function createIssue() {
  const title = document.getElementById('create-title').value.trim();
  const type = document.getElementById('create-type').value;
  const priority = document.getElementById('create-priority').value;
  const description = document.getElementById('create-description').value.trim();
  
  if (!title) {
    const output = document.getElementById('output');
    output.textContent = 'Error: Title is required';
    output.className = 'output error';
    return;
  }
  
  let command = `create --title "${title}" -t ${type} -p ${priority}`;
  if (description) {
    command += ` -d "${description}"`;
  }
  
  runCommand(command);
  hideCreatePanel();
}

/**
 * Initializes bd in the current workspace after user confirmation.
 */
function initBeads() {
  const confirmed = confirm('This will initialize beads in the current workspace. Continue?');
  if (confirmed) {
    runCommand('init --quiet');
  }
}

/**
 * Toggles visibility of the relationship management panel.
 */
function showRelationshipPanel() {
  const panel = document.getElementById('relationship-panel');
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    document.getElementById('source-bead').focus();
  } else {
    panel.style.display = 'none';
  }
}

/**
 * Hides the relationship panel and resets its form inputs.
 */
function hideRelationshipPanel() {
  document.getElementById('relationship-panel').style.display = 'none';
  // Clear inputs
  document.getElementById('source-bead').value = '';
  document.getElementById('target-bead').value = '';
}

/**
 * Links two beads with the selected relationship type.
 */
function linkBeads() {
  const sourceBead = document.getElementById('source-bead').value.trim();
  const targetBead = document.getElementById('target-bead').value.trim();
  const relationType = document.getElementById('relationship-type').value;
  
  if (!sourceBead || !targetBead) {
    const output = document.getElementById('output');
    output.textContent = 'Error: Please provide both source and target bead IDs';
    output.className = 'output error';
    return;
  }
  
  const command = `link add ${sourceBead} --${relationType} ${targetBead}`;
  runCommand(command);
  hideRelationshipPanel();
}

/**
 * Unlinks two beads by removing the selected relationship type.
 */
function unlinkBeads() {
  const sourceBead = document.getElementById('source-bead').value.trim();
  const targetBead = document.getElementById('target-bead').value.trim();
  const relationType = document.getElementById('relationship-type').value;
  
  if (!sourceBead || !targetBead) {
    const output = document.getElementById('output');
    output.textContent = 'Error: Please provide both source and target bead IDs';
    output.className = 'output error';
    return;
  }
  
  const command = `link remove ${sourceBead} --${relationType} ${targetBead}`;
  runCommand(command);
  hideRelationshipPanel();
}
