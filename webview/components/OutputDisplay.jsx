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

const IssueTreeNode = ({
  node,
  existingAssignees,
  issueDetails,
  loadingDetails,
  onShowIssue,
  onCloseIssue,
  onReopenIssue,
  onEditIssue,
  onTypeChange,
  onPriorityChange,
  onAssigneeChange,
  onShowHierarchy,
  onDragStart,
  onDrop,
  draggedIssue,
  vscode
}) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;

  return (
    <div className="issue-tree__node">
      <div className="issue-tree__node-header">
        {hasChildren ? (
          <button
            className="issue-tree__toggle"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            aria-label={expanded ? 'Collapse children' : 'Expand children'}>
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="issue-tree__toggle-spacer" />
        )}
        <div className="issue-tree__card">
          <IssueCard 
            issue={node.issue} 
            onClick={() => onShowIssue(node.issue.id)}
            onClose={() => onCloseIssue(node.issue.id)}
            onReopen={() => onReopenIssue(node.issue.id)}
            onEdit={() => onEditIssue(node.issue.id)}
            onTypeChange={onTypeChange}
            onPriorityChange={onPriorityChange}
            onAssigneeChange={onAssigneeChange}
            onShowHierarchy={onShowHierarchy}
            existingAssignees={existingAssignees}
            detailedData={issueDetails[node.issue.id]}
            isLoadingDetails={loadingDetails[node.issue.id]}
            onDragStart={() => onDragStart(node.issue)}
            onDrop={() => onDrop(node.issue)}
            isDragging={draggedIssue?.id === node.issue.id}
            isDropTarget={draggedIssue && (node.issue.type === 'epic' || node.issue.type === 'feature') && draggedIssue.id !== node.issue.id}
            vscode={vscode}
          />
        </div>
      </div>
      {expanded && hasChildren && (
        <div className="issue-tree__children">
          {node.children.map((child) => (
            <IssueTreeNode
              key={child.issue.id}
              node={child}
              existingAssignees={existingAssignees}
              issueDetails={issueDetails}
              loadingDetails={loadingDetails}
              onShowIssue={onShowIssue}
              onCloseIssue={onCloseIssue}
              onReopenIssue={onReopenIssue}
              onEditIssue={onEditIssue}
              onTypeChange={onTypeChange}
              onPriorityChange={onPriorityChange}
              onAssigneeChange={onAssigneeChange}
              onShowHierarchy={onShowHierarchy}
              onDragStart={onDragStart}
              onDrop={onDrop}
              draggedIssue={draggedIssue}
              vscode={vscode}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const OutputDisplay = ({ output, isError, isSuccess, onShowIssue, onCloseIssue, onReopenIssue, onEditIssue, onLinkParent, onTypeChange, onPriorityChange, onAssigneeChange, onShowHierarchy, issueDetails = {}, loadingDetails = {}, vscode }) => {
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

    const handleDragStart = (issue) => {
      setDraggedIssue(issue);
    };

    const handleDrop = (targetIssue) => {
      if (draggedIssue && draggedIssue.id !== targetIssue.id && onLinkParent) {
        onLinkParent(draggedIssue.id, targetIssue.id);
      }
      setDraggedIssue(null);
    };

    const hierarchyRoots = (output.hierarchy && output.hierarchy.length > 0)
      ? output.hierarchy
      : output.openIssues.map(issue => ({ issue, children: [] }));

    const totalRootItems = hierarchyRoots.length;
    const paginatedRoots = paginateItems(hierarchyRoots, currentPage, pageSize);

    return (
      <div className={`output ${className} output-display`}>
        <div className="output-display__command">
          $ bd {output.command}
        </div>
        
        <PaginationControls
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={totalRootItems}
          onPageChange={setCurrentPage}
          onPageSizeChange={handlePageSizeChange}
        />

        <div className="issue-tree">
          {paginatedRoots.length === 0 ? (
            <div className="issue-tree__empty">No open issues.</div>
          ) : (
            paginatedRoots.map((node) => (
              <IssueTreeNode
                key={node.issue.id}
                node={node}
                existingAssignees={existingAssignees}
                issueDetails={issueDetails}
                loadingDetails={loadingDetails}
                onShowIssue={onShowIssue}
                onCloseIssue={onCloseIssue}
                onReopenIssue={onReopenIssue}
                onEditIssue={onEditIssue}
                onTypeChange={onTypeChange}
                onPriorityChange={onPriorityChange}
                onAssigneeChange={onAssigneeChange}
                onShowHierarchy={onShowHierarchy}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                draggedIssue={draggedIssue}
                vscode={vscode}
              />
            ))
          )}
        </div>
        
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
                  onShowHierarchy={onShowHierarchy}
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
