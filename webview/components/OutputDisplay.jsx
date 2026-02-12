import React, { useState } from 'react';
import IssueCard from './IssueCard';
import StatsDisplay from './StatsDisplay';

const OutputDisplay = ({ output, isError, isSuccess, onShowIssue, onCloseIssue, onReopenIssue, onEditIssue, onLinkParent, onTypeChange, onPriorityChange, onAssigneeChange, issueDetails = {}, loadingDetails = {}, vscode }) => {
  const [draggedIssue, setDraggedIssue] = useState(null);
  const className = isError ? 'error' : isSuccess ? 'success' : '';
  
  if (typeof output === 'object' && output.type === 'stats') {
    return <StatsDisplay stats={output.stats} header={output.header} command={output.command} />;
  }
  
  if (typeof output === 'object' && output.type === 'list') {
    // Extract existing assignees from all issues
    const existingAssignees = [...new Set(
      [...output.openIssues, ...output.closedIssues]
        .map(issue => issue.assignee)
        .filter(Boolean)
    )];

    // Group issues by type for better organization
    const groupedIssues = output.openIssues.reduce((groups, issue) => {
      const type = issue.type || 'task';
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(issue);
      return groups;
    }, {});

    // Define display order for issue types
    const typeOrder = ['epic', 'feature', 'bug', 'task', 'chore'];
    const typeLabels = {
      epic: '📚 Epics',
      feature: '✨ Features',
      bug: '🐛 Bugs',
      task: '📋 Tasks',
      chore: '🔧 Chores'
    };

    const handleDragStart = (issue) => {
      setDraggedIssue(issue);
    };

    const handleDrop = (targetIssue) => {
      if (draggedIssue && draggedIssue.id !== targetIssue.id && onLinkParent) {
        onLinkParent(draggedIssue.id, targetIssue.id);
      }
      setDraggedIssue(null);
    };

    return (
      <div className={`output ${className} output-display`}>
        <div className="output-display__command">
          $ bd {output.command}
        </div>
        {output.header && (
          <div className="output-display__header">
            {output.header}
          </div>
        )}
        
        {typeOrder.map(type => {
          if (!groupedIssues[type] || groupedIssues[type].length === 0) return null;
          
          return (
            <div key={type} className="issue-group">
              <div className="issue-group__header">
                {typeLabels[type]} ({groupedIssues[type].length})
              </div>
              <div className="issue-group__items">
                {groupedIssues[type].map((issue, idx) => (
                  <IssueCard 
                    key={idx} 
                    issue={issue} 
                    onClick={() => onShowIssue(issue.id)}
                    onClose={() => onCloseIssue(issue.id)}
                    onReopen={() => onReopenIssue(issue.id)}
                    onEdit={() => onEditIssue(issue.id)}
                    onTypeChange={onTypeChange}
                    onPriorityChange={onPriorityChange}
                    onAssigneeChange={onAssigneeChange}
                    existingAssignees={existingAssignees}
                    detailedData={issueDetails[issue.id]}
                    isLoadingDetails={loadingDetails[issue.id]}
                    onDragStart={handleDragStart}
                    onDrop={handleDrop}
                    isDragging={draggedIssue?.id === issue.id}
                    isDropTarget={draggedIssue && (issue.type === 'epic' || issue.type === 'feature') && draggedIssue.id !== issue.id}
                    vscode={vscode}
                  />
                ))}
              </div>
            </div>
          );
        })}
        
        {output.closedIssues.length > 0 && (
          <details className="output-display__closed-section">
            <summary className="output-display__closed-summary">
              ✓ Closed ({output.closedIssues.length})
            </summary>
            <div className="output-display__closed-items">
              {output.closedIssues.map((issue, idx) => (
                <IssueCard 
                  key={idx} 
                  issue={issue} 
                  onClick={() => onShowIssue(issue.id)}
                  onClose={() => onCloseIssue(issue.id)}
                  onReopen={() => onReopenIssue(issue.id)}
                  onEdit={() => onEditIssue(issue.id)}
                  onAssigneeChange={onAssigneeChange}
                  existingAssignees={existingAssignees}
                  detailedData={issueDetails[issue.id]}
                  isLoadingDetails={loadingDetails[issue.id]}
                  vscode={vscode}
                />
              ))}
            </div>
          </details>
        )}
      </div>
    );
  }

  return (
    <pre className={`output ${className}`}>
      {output}
    </pre>
  );
};

export default OutputDisplay;
