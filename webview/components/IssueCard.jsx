import React, { useState } from 'react';

const IssueCard = ({ issue, onClick, onClose, onReopen, onEdit, onTypeChange, onPriorityChange, detailedData, isLoadingDetails, onDragStart, onDrop, isDragging, isDropTarget, vscode }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showQuickEdit, setShowQuickEdit] = useState(false);
  const [dependencies, setDependencies] = useState(null);
  const [dependents, setDependents] = useState(null);
  const [loadingDeps, setLoadingDeps] = useState(false);
  const isClosed = issue.status === 'closed';

  // Calculate total relationship count
  const totalRelationships = (issue.dependency_count || 0) + (issue.dependent_count || 0);

  const handleCardClick = (e) => {
    // Don't trigger card click if clicking on action buttons or quick edit
    if (e.target.closest('.issue-card__actions') || e.target.closest('.issue-card__quick-edit')) {
      return;
    }
    
    const willExpand = !isExpanded;
    setIsExpanded(willExpand);
    
    // Load details on expansion if not already loaded
    if (willExpand && !detailedData && onClick) {
      onClick();
    }
    
    // Load dependencies on expansion if there are any and not already loaded
    if (willExpand && totalRelationships > 0 && dependencies === null && !loadingDeps && vscode) {
      setLoadingDeps(true);
      vscode.postMessage({
        type: 'getDependencies',
        issueId: issue.id
      });
      
      const depsHandler = (event) => {
        const message = event.data;
        if (message.type === 'dependenciesResult' && message.issueId === issue.id) {
          setLoadingDeps(false);
          setDependencies(message.dependencies || []);
          setDependents(message.dependents || []);
          window.removeEventListener('message', depsHandler);
        }
      };
      window.addEventListener('message', depsHandler);
    }
    
    // Load comments on expansion if not already loaded
    if (willExpand && comments.length === 0 && !loadingComments && vscode) {
      setLoadingComments(true);
      // Send message to get comments
      vscode.postMessage({
        type: 'getComments',
        issueId: issue.id
      });
      
      // Listen for comments response
      const handler = (event) => {
        const message = event.data;
        if (message.type === 'commentsResult' && message.issueId === issue.id) {
          setLoadingComments(false);
          if (message.success && message.output) {
            // Parse comments from text output
            const parsed = parseComments(message.output);
            setComments(parsed);
          }
          window.removeEventListener('message', handler);
        }
      };
      window.addEventListener('message', handler);
    }
  };
  
  const parseComments = (output) => {
    if (output.includes('No comments')) {
      return [];
    }
    
    const lines = output.split('\\n');
    const commentList = [];
    
    for (let line of lines) {
      // Match format: [AUTHOR] Comment text at TIMESTAMP
      const match = line.match(/^\\[(.+?)\\]\\s+(.+?)\\s+at\\s+(.+)$/);
      if (match) {
        commentList.push({
          author: match[1],
          text: match[2],
          timestamp: match[3]
        });
      }
    }
    
    return commentList;
  };

  const handleDragStart = (e) => {
    e.stopPropagation();
    if (onDragStart) {
      onDragStart(issue);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDrop) {
      onDrop(issue);
    }
  };

  const handleClose = (e) => {
    e.stopPropagation();
    onClose && onClose();
  };

  const handleReopen = (e) => {
    e.stopPropagation();
    onReopen && onReopen();
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    onEdit && onEdit();
  };

  const handleTypeChange = (e) => {
    e.stopPropagation();
    const newType = e.target.value;
    if (newType !== issue.type && onTypeChange) {
      onTypeChange(issue.id, newType);
    }
    setShowQuickEdit(false);
  };

  const handlePriorityChange = (e) => {
    e.stopPropagation();
    const newPriority = e.target.value;
    const currentPriority = issue.priority.replace('p', '');
    if (newPriority !== currentPriority && onPriorityChange) {
      onPriorityChange(issue.id, newPriority);
    }
    setShowQuickEdit(false);
  };

  const toggleQuickEdit = (e) => {
    e.stopPropagation();
    setShowQuickEdit(!showQuickEdit);
  };

  const priorityClass = `issue-card--priority-${issue.priority.toLowerCase()}`;
  const clickableClass = onClick ? '' : 'issue-card--not-clickable';
  const draggingClass = isDragging ? 'issue-card--dragging' : '';
  const dropTargetClass = isDropTarget ? 'issue-card--drop-target' : '';
  
  // Only allow dragging for non-closed issues, and only epics/features can be drop targets
  const canBeDropTarget = issue.type === 'epic' || issue.type === 'feature';
  const canBeDragged = !isClosed && issue.type !== 'epic'; // Epics can't be children
  
  return (
    <div 
      className={`issue-card ${priorityClass} ${clickableClass} ${draggingClass} ${dropTargetClass}`}
      onClick={handleCardClick}
      draggable={canBeDragged}
      onDragStart={handleDragStart}
      onDragOver={canBeDropTarget ? handleDragOver : undefined}
      onDrop={canBeDropTarget ? handleDrop : undefined}>
      <div className="issue-card__header">
        <div className="issue-card__badges">
          {canBeDragged && <span className="issue-card__drag-handle" title="Drag to set parent">⋮⋮</span>}
          <span className="issue-card__id">
            {issue.id}
          </span>
          <span className={`issue-card__badge issue-card__badge--priority issue-card__badge--priority-${issue.priority.toLowerCase()}`}>
            {issue.priority}
          </span>
          <span className={`issue-card__badge issue-card__badge--type-${issue.type}`}>
            {issue.type}
          </span>
          <span className={`issue-card__status issue-card__status--${issue.status.replace('_', '-')}`}>
            ● {issue.status}
          </span>
          {totalRelationships > 0 && (
            <span className="issue-card__relationships-badge" title={`${issue.dependency_count || 0} dependencies, ${issue.dependent_count || 0} dependents`}>
              🔗 {totalRelationships}
            </span>
          )}
          {issue.status === 'in_progress' && (issue.assignee || detailedData?.assignee) && (
            <span className="issue-card__assignee-badge" title="Assigned to">
              👤 {issue.assignee || detailedData?.assignee}
            </span>
          )}
        </div>
        <div className="issue-card__actions">
          {!isClosed && onTypeChange && onPriorityChange && (
            <button
              onClick={toggleQuickEdit}
              className={`issue-card__action-btn ${showQuickEdit ? 'issue-card__action-btn--active' : ''}`}
              title="Quick edit type/priority">
              ⚡
            </button>
          )}
          {!isClosed && (
            <button
              onClick={handleEdit}
              className="issue-card__action-btn"
              title="Edit issue">
              ✏️
            </button>
          )}
          {isClosed ? (
            <button
              onClick={handleReopen}
              className="issue-card__action-btn"
              title="Reopen issue">
              🔄
            </button>
          ) : (
            <button
              onClick={handleClose}
              className="issue-card__action-btn"
              title="Close issue">
              ✅
            </button>
          )}
        </div>
      </div>
      <div className="issue-card__title">
        {issue.title}
      </div>
      {showQuickEdit && !isClosed && (
        <div className="issue-card__quick-edit">
          <div className="issue-card__quick-edit-group">
            <label className="issue-card__quick-edit-label">Type</label>
            <select
              className="issue-card__quick-edit-select"
              value={issue.type}
              onChange={handleTypeChange}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="epic">Epic</option>
              <option value="feature">Feature</option>
              <option value="bug">Bug</option>
              <option value="task">Task</option>
              <option value="chore">Chore</option>
            </select>
          </div>
          <div className="issue-card__quick-edit-group">
            <label className="issue-card__quick-edit-label">Priority</label>
            <select
              className="issue-card__quick-edit-select"
              value={issue.priority.replace('p', '')}
              onChange={handlePriorityChange}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="0">P0 - Critical</option>
              <option value="1">P1 - High</option>
              <option value="2">P2 - Medium</option>
              <option value="3">P3 - Low</option>
              <option value="4">P4 - Backlog</option>
            </select>
          </div>
        </div>
      )}
      {isExpanded && (
        <div className="issue-card__details">
          {isLoadingDetails ? (
            <div className="issue-card__loading">⏳ Loading details...</div>
          ) : (
            <>
              {(detailedData?.description || issue.description) && (
                <div className="issue-card__description">
                  <strong>Description:</strong>
                  <div>{detailedData?.description || issue.description}</div>
                </div>
              )}
              {detailedData?.acceptance && (
                <div className="issue-card__acceptance">
                  <strong>Acceptance Criteria:</strong>
                  <div>{detailedData.acceptance}</div>
                </div>
              )}
              {detailedData?.design && (
                <div className="issue-card__design">
                  <strong>Design Notes:</strong>
                  <div>{detailedData.design}</div>
                </div>
              )}
              {detailedData?.notes && (
                <div className="issue-card__notes">
                  <strong>Notes:</strong>
                  <div>{detailedData.notes}</div>
                </div>
              )}
              {detailedData?.assignee && (
                <div className="issue-card__assignee">
                  <strong>Assignee:</strong> {detailedData.assignee}
                </div>
              )}
              {/* Relationships section */}
              {totalRelationships > 0 && (
                <div className="issue-card__relationships">
                  <strong>Relationships:</strong>
                  {loadingDeps && (
                    <div className="issue-card__loading">⏳ Loading relationships...</div>
                  )}
                  {!loadingDeps && dependencies !== null && (
                    <div className="issue-card__relationships-content">
                      {dependencies.length > 0 && (
                        <div className="issue-card__relationship-group">
                          <span className="issue-card__relationship-label">Depends on ({dependencies.length}):</span>
                          <div className="issue-card__relationship-list">
                            {dependencies.map((dep, idx) => (
                              <span key={idx} className="issue-card__relationship-item issue-card__relationship-item--dependency">
                                {dep.to_id || dep.ToID || dep.target_id || dep.id || JSON.stringify(dep)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {dependents && dependents.length > 0 && (
                        <div className="issue-card__relationship-group">
                          <span className="issue-card__relationship-label">Depended on by ({dependents.length}):</span>
                          <div className="issue-card__relationship-list">
                            {dependents.map((dep, idx) => (
                              <span key={idx} className="issue-card__relationship-item issue-card__relationship-item--dependent">
                                {dep.from_id || dep.FromID || dep.source_id || dep.id || JSON.stringify(dep)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {dependencies.length === 0 && (!dependents || dependents.length === 0) && (
                        <div className="issue-card__relationship-empty">No detailed relationship info available</div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {loadingComments && (
                <div className="issue-card__loading">⏳ Loading comments...</div>
              )}
              {!loadingComments && comments.length > 0 && (
                <div className="issue-card__comments">
                  <strong>Comments ({comments.length}):</strong>
                  {comments.map((comment, idx) => (
                    <div key={idx} className="issue-card__comment">
                      <div className="issue-card__comment-header">
                        <span className="issue-card__comment-author">{comment.author}</span>
                        <span className="issue-card__comment-time">{comment.timestamp}</span>
                      </div>
                      <div className="issue-card__comment-text">{comment.text}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="issue-card__metadata">
                <div><strong>Created:</strong> {issue.created_at ? new Date(issue.created_at).toLocaleString() : 'N/A'}</div>
                {issue.updated_at && <div><strong>Updated:</strong> {new Date(issue.updated_at).toLocaleString()}</div>}
                {issue.closed_at && <div><strong>Closed:</strong> {new Date(issue.closed_at).toLocaleString()}</div>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default IssueCard;
