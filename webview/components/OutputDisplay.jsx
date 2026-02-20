import React, { useState, useEffect, useMemo, useCallback } from 'react';
import IssueCard from './IssueCard';
import StatsDisplay from './StatsDisplay';
import PaginationControls from './PaginationControls';
import ListFilterControls from './ListFilterControls';

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

/**
 * Checks if an issue matches the search filter.
 * @param {object} issue - Issue object
 * @param {string} search - Search term (case-insensitive)
 * @returns {boolean}
 */
function matchesSearch(issue, search) {
  if (!search) return true;
  const lower = search.toLowerCase();
  const id = (issue.id || '').toLowerCase();
  const title = (issue.title || '').toLowerCase();
  const description = (issue.description || '').toLowerCase();
  return id.includes(lower) || title.includes(lower) || description.includes(lower);
}

/**
 * Checks if an issue matches the assignee filter.
 * @param {object} issue - Issue object
 * @param {string} assigneeFilter - Assignee filter (case-insensitive)
 * @returns {boolean}
 */
function matchesAssignee(issue, assigneeFilter) {
  if (!assigneeFilter) return true;
  const assignee = (issue.assignee || '').toLowerCase();
  return assignee.includes(assigneeFilter.toLowerCase());
}

/**
 * Checks if an issue matches the label filter.
 * @param {object} issue - Issue object
 * @param {string} labelFilter - Label filter (case-insensitive)
 * @returns {boolean}
 */
function matchesLabel(issue, labelFilter) {
  if (!labelFilter) return true;
  if (!Array.isArray(issue.labels) || issue.labels.length === 0) return false;
  const lower = labelFilter.toLowerCase();
  return issue.labels.some((label) => label.toLowerCase().includes(lower));
}

/**
 * Checks if an issue matches the status filter.
 * @param {object} issue - Issue object
 * @param {string} statusFilter - Status filter value
 * @returns {boolean}
 */
function matchesStatus(issue, statusFilter) {
  if (!statusFilter) return true;
  const normalized = statusFilter.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.startsWith('not')) {
    return issue.status !== 'in_progress' && issue.status !== 'closed' && issue.status !== 'done';
  }
  if (normalized.startsWith('in')) {
    return issue.status === 'in_progress';
  }
  const issueStatus = (issue.status || '').toLowerCase().replace(/_/g, ' ');
  return issueStatus.includes(normalized);
}

/**
 * Checks if an issue matches the priority filter.
 * @param {object} issue - Issue object
 * @param {string} priorityFilter - Priority filter value (e.g., "P0 - Critical")
 * @returns {boolean}
 */
function matchesPriority(issue, priorityFilter) {
  if (!priorityFilter) return true;
  const normalized = priorityFilter.trim().toLowerCase();
  if (!normalized) return true;
  
  // Extract priority number from filter (e.g., "P0 - Critical" -> "0")
  const match = normalized.match(/p(\d)/);
  if (!match) return true;
  const filterPriority = match[1];
  
  // Extract priority from issue (handles "p0", "0", etc.)
  const issuePriority = String(issue.priority || '2').toLowerCase().replace(/^p/, '');
  
  return issuePriority === filterPriority;
}

const OutputDisplay = ({
  output,
  isError,
  isSuccess,
  onShowIssue,
  onCloseIssue,
  onReopenIssue,
  onEditIssue,
  onLinkParent,
  onTypeChange,
  onPriorityChange,
  onAssigneeChange,
  onShowHierarchy,
  onPokePoke,
  onConvertToGitHub,
  onAssignToCopilot,
  pokepokeInstances,
  issueDetails = {},
  loadingDetails = {},
  vscode
}) => {
  const [draggedIssue, setDraggedIssue] = useState(null);
  const [pageSize, setPageSize] = useState(getStoredPageSize);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchFilter, setSearchFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const className = isError ? 'error' : isSuccess ? 'success' : '';

  // Reset to page 1 and clear filters when output changes
  useEffect(() => {
    setCurrentPage(1);
    setSearchFilter('');
    setAssigneeFilter('');
    setLabelFilter('');
    setStatusFilter('');
    setPriorityFilter('');
  }, [output]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchFilter, assigneeFilter, labelFilter, statusFilter, priorityFilter]);

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
    savePageSize(newSize);
  };

  const handleClearAllFilters = () => {
    setSearchFilter('');
    setAssigneeFilter('');
    setLabelFilter('');
    setStatusFilter('');
    setPriorityFilter('');
  };

  // Unconditionally compute list-specific derived data to satisfy React hooks rules.
  // These must run on every render regardless of output type.
  const isListOutput = typeof output === 'object' && output.type === 'list';
  const listOpenIssues = isListOutput ? output.openIssues : [];
  const listClosedIssues = isListOutput ? output.closedIssues : [];
  const hasActiveFilters = searchFilter || assigneeFilter || labelFilter || statusFilter || priorityFilter;

  const filterFn = useCallback((issue) =>
    matchesSearch(issue, searchFilter) &&
    matchesAssignee(issue, assigneeFilter) &&
    matchesLabel(issue, labelFilter) &&
    matchesStatus(issue, statusFilter) &&
    matchesPriority(issue, priorityFilter),
  [searchFilter, assigneeFilter, labelFilter, statusFilter, priorityFilter]);

  const filteredOpenIssues = useMemo(() => {
    if (!hasActiveFilters) return listOpenIssues;
    return listOpenIssues.filter(filterFn);
  }, [listOpenIssues, hasActiveFilters, filterFn]);

  const filteredClosedIssues = useMemo(() => {
    if (!hasActiveFilters) return listClosedIssues;
    return listClosedIssues.filter(filterFn);
  }, [listClosedIssues, hasActiveFilters, filterFn]);

  if (typeof output === 'object' && output.type === 'stats') {
    return <StatsDisplay stats={output.stats} header={output.header} command={output.command} />;
  }

  if (isListOutput) {
    // All issues for filter options extraction
    const allIssues = [...listOpenIssues, ...listClosedIssues];

    // Extract existing assignees from all issues
    const existingAssignees = [...new Set(
      allIssues.map(issue => issue.assignee).filter(Boolean)
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

    const totalUnfilteredItems = listOpenIssues.length;
    const totalFilteredItems = filteredOpenIssues.length;
    const paginatedOpenIssues = paginateItems(filteredOpenIssues, currentPage, pageSize);

    return (
      <div className={`output ${className} output-display`}>
        <div className="output-display__command">
          $ bd {output.command}
        </div>

        <ListFilterControls
          searchFilter={searchFilter}
          assigneeFilter={assigneeFilter}
          labelFilter={labelFilter}
          statusFilter={statusFilter}
          priorityFilter={priorityFilter}
          onSearchChange={setSearchFilter}
          onAssigneeChange={setAssigneeFilter}
          onLabelChange={setLabelFilter}
          onStatusChange={setStatusFilter}
          onPriorityChange={setPriorityFilter}
          onClearAll={handleClearAllFilters}
          allIssues={allIssues}
        />
        
        <PaginationControls
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={totalFilteredItems}
          onPageChange={setCurrentPage}
          onPageSizeChange={handlePageSizeChange}
          filteredCount={hasActiveFilters ? totalFilteredItems : null}
          unfilteredCount={hasActiveFilters ? totalUnfilteredItems : null}
        />

        <div className="issue-tree issue-tree--flat">
          {paginatedOpenIssues.length === 0 ? (
            <div className="issue-tree__empty">
              {hasActiveFilters ? 'No open issues match the current filters.' : 'No open issues.'}
            </div>
          ) : (
            paginatedOpenIssues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onClick={() => onShowIssue(issue.id)}
                onClose={() => onCloseIssue(issue.id)}
                onReopen={() => onReopenIssue(issue.id)}
                onEdit={() => onEditIssue(issue.id)}
                onTypeChange={onTypeChange}
                onPriorityChange={onPriorityChange}
                onAssigneeChange={onAssigneeChange}
                onShowHierarchy={onShowHierarchy}
                onPokePoke={onPokePoke}
                onConvertToGitHub={onConvertToGitHub}
                onAssignToCopilot={onAssignToCopilot}
                pokepokeRunning={pokepokeInstances && pokepokeInstances.some(i => i.itemId === issue.id && (i.state === 'running' || i.state === 'starting'))}
                existingAssignees={existingAssignees}
                detailedData={issueDetails[issue.id]}
                isLoadingDetails={loadingDetails[issue.id]}
                onDragStart={() => handleDragStart(issue)}
                onDrop={() => handleDrop(issue)}
                isDragging={draggedIssue?.id === issue.id}
                isDropTarget={draggedIssue && (issue.type === 'epic' || issue.type === 'feature') && draggedIssue.id !== issue.id}
                vscode={vscode}
              />
            ))
          )}
        </div>
        
        {filteredClosedIssues.length > 0 && (
          <details className="output-display__closed-section">
            <summary className="output-display__closed-summary">
              ✓ Closed ({filteredClosedIssues.length}{hasActiveFilters && output.closedIssues.length !== filteredClosedIssues.length ? ` of ${output.closedIssues.length}` : ''})
            </summary>
            <div className="output-display__closed-items">
              {filteredClosedIssues.map((issue, idx) => (
                <IssueCard 
                  key={idx} 
                  issue={issue} 
                  onClick={() => onShowIssue(issue.id)}
                  onClose={() => onCloseIssue(issue.id)}
                  onReopen={() => onReopenIssue(issue.id)}
                  onEdit={() => onEditIssue(issue.id)}
                  onShowHierarchy={onShowHierarchy}
                  onAssigneeChange={onAssigneeChange}
                  onConvertToGitHub={onConvertToGitHub}
                  onAssignToCopilot={onAssignToCopilot}
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
