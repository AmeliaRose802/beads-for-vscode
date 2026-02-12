import React, { useState, useEffect } from 'react';
import IssueCard from './IssueCard';
import StatsDisplay from './StatsDisplay';
import PaginationControls from './PaginationControls';

const STORAGE_KEY = 'beads-ui-page-size';

/**
 * Get page size from localStorage or use default.
 * @returns {number|string} Page size value
 */
function getStoredPageSize() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'all') return 'all';
    const parsed = parseInt(stored, 10);
    return [50, 100, 200].includes(parsed) ? parsed : 50;
  } catch {
    return 50;
  }
}

/**
 * Save page size to localStorage.
 * @param {number|string} pageSize - Page size to store
 */
function savePageSize(pageSize) {
  try {
    localStorage.setItem(STORAGE_KEY, String(pageSize));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Paginate an array of items.
 * @param {Array} items - Items to paginate
 * @param {number} page - Current page (1-indexed)
 * @param {number|string} pageSize - Items per page or 'all'
 * @returns {Array} Paginated items
 */
function paginateItems(items, page, pageSize) {
  if (pageSize === 'all') return items;
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

const OutputDisplay = ({ output, isError, isSuccess, onShowIssue, onCloseIssue, onReopenIssue, onEditIssue, onLinkParent, onTypeChange, onPriorityChange, onAssigneeChange, issueDetails = {}, loadingDetails = {}, vscode }) => {
  const [draggedIssue, setDraggedIssue] = useState(null);
  const [pageSize, setPageSize] = useState(getStoredPageSize);
  const [currentPage, setCurrentPage] = useState(1);
  const className = isError ? 'error' : isSuccess ? 'success' : '';

  // Reset to page 1 when output changes
  useEffect(() => {
    setCurrentPage(1);
  }, [output]);

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
    savePageSize(newSize);
  };
  
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

    // Apply pagination to open issues before grouping
    const paginatedOpenIssues = paginateItems(output.openIssues, currentPage, pageSize);
    const totalOpenItems = output.openIssues.length;

    // Group paginated issues by type
    const paginatedGroupedIssues = paginatedOpenIssues.reduce((groups, issue) => {
      const type = issue.type || 'task';
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(issue);
      return groups;
    }, {});

    return (
      <div className={`output ${className} output-display`}>
        <div className="output-display__command">
          $ bd {output.command}
        </div>
        
        <PaginationControls
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={totalOpenItems}
          onPageChange={setCurrentPage}
          onPageSizeChange={handlePageSizeChange}
        />
        
        {typeOrder.map(type => {
          if (!paginatedGroupedIssues[type] || paginatedGroupedIssues[type].length === 0) return null;
          
          return (
            <div key={type} className="issue-group">
              <div className="issue-group__header">
                {typeLabels[type]} ({paginatedGroupedIssues[type].length})
              </div>
              <div className="issue-group__items">
                {paginatedGroupedIssues[type].map((issue, idx) => (
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
