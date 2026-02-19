import React, { useState, useEffect } from 'react';
import AssigneeDropdown from './AssigneeDropdown';
import CopyableIssueId from './CopyableIssueId';
import IssueCardDetails from './IssueCardDetails';
import { parseComments } from './utils';
import { useAsyncData } from '../hooks/useAsyncData';

const IssueCard = ({ issue, onClick, onClose, onReopen, onEdit, onTypeChange, onPriorityChange, onAssigneeChange, onShowHierarchy, onPokePoke, onConvertToGitHub, pokepokeRunning, existingAssignees, detailedData, isLoadingDetails, onDragStart, onDrop, isDragging, isDropTarget, vscode, defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [comments, setComments] = useState([]);
  const [showQuickEdit, setShowQuickEdit] = useState(false);
  const [dependencies, setDependencies] = useState(null);
  const [dependents, setDependents] = useState(null);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [isEditingAssignee, setIsEditingAssignee] = useState(false);
  const [assigneeSaveState, setAssigneeSaveState] = useState('idle'); // idle, saving, saved, error
  const [shouldLoadDeps, setShouldLoadDeps] = useState(false);
  const [shouldLoadComments, setShouldLoadComments] = useState(false);
  const isClosed = issue.status === 'closed';

  // Calculate total relationship count
  const totalRelationships = (issue.dependency_count || 0) + (issue.dependent_count || 0);

  const { loading: loadingDeps } = useAsyncData({
    shouldLoad: shouldLoadDeps && totalRelationships > 0,
    vscode,
    issueId: issue.id,
    request: { type: 'getDependencies', issueId: issue.id },
    responseType: 'dependenciesResult',
    onResponse: (msg) => {
      setDependencies(msg.dependencies || []);
      setDependents(msg.dependents || []);
      setShouldLoadDeps(false);
    }
  });

  const { loading: loadingComments } = useAsyncData({
    shouldLoad: shouldLoadComments,
    vscode,
    issueId: issue.id,
    request: { type: 'getComments', issueId: issue.id },
    responseType: 'commentsResult',
    onResponse: (msg) => {
      if (msg.success && msg.output) {
        setComments(parseComments(msg.output));
      }
      setCommentsLoaded(true);
      setShouldLoadComments(false);
    }
  });

  useEffect(() => {
    if (defaultExpanded && !isExpanded) {
      setIsExpanded(true);
    }
  }, [defaultExpanded, isExpanded]);

  useEffect(() => {
    if (!isExpanded) return;

    if (!detailedData && !isLoadingDetails && onClick) {
      onClick();
    }

    if (totalRelationships > 0 && dependencies === null && !loadingDeps && vscode) {
      setShouldLoadDeps(true);
    }

    if (!commentsLoaded && !loadingComments && vscode) {
      setShouldLoadComments(true);
    }
  }, [
    isExpanded,
    detailedData,
    isLoadingDetails,
    onClick,
    totalRelationships,
    dependencies,
    loadingDeps,
    commentsLoaded,
    loadingComments,
    vscode
  ]);

  const handleCardClick = (e) => {
    // Don't trigger card click if clicking on action buttons, quick edit, or assignee editor
    if (e.target.closest('.issue-card__actions') || 
        e.target.closest('.issue-card__quick-edit') ||
        e.target.closest('.issue-card__assignee-editor')) {
      return;
    }
    
    const willExpand = !isExpanded;
    setIsExpanded(willExpand);
    
  };

  const handleShowHierarchyClick = (e) => {
    e.stopPropagation();
    if (onShowHierarchy) {
      onShowHierarchy(issue.id);
    }
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

  const handleConvertToGitHubClick = (e) => {
    e.stopPropagation();
    if (onConvertToGitHub) {
      onConvertToGitHub(issue.id);
    }
  };

  const toggleQuickEdit = (e) => {
    e.stopPropagation();
    setShowQuickEdit(!showQuickEdit);
  };

  const handleAssigneeClick = (e) => {
    e.stopPropagation();
    if (!isClosed && onAssigneeChange) {
      setIsEditingAssignee(true);
    }
  };

  const handleAssigneeChange = async (newAssignee) => {
    if (!onAssigneeChange) return;

    const currentAssignee = (issue.assignee || detailedData?.assignee || '').trim();
    const nextAssignee = (newAssignee || '').trim();
    if (nextAssignee === currentAssignee) {
      setIsEditingAssignee(false);
      setAssigneeSaveState('idle');
      return;
    }

    setAssigneeSaveState('saving');
    
    try {
      await onAssigneeChange(issue.id, nextAssignee);
      setAssigneeSaveState('saved');
      
      // Reset to idle after showing saved state
      setTimeout(() => {
        setAssigneeSaveState('idle');
        setIsEditingAssignee(false);
      }, 1500);
    } catch (error) {
      setAssigneeSaveState('error');
      
      // Reset to idle after showing error
      setTimeout(() => {
        setAssigneeSaveState('idle');
      }, 3000);
    }
  };

  const handleAssigneeBlur = () => {
    // Only close if not saving
    if (assigneeSaveState !== 'saving') {
      setTimeout(() => {
        setIsEditingAssignee(false);
        setAssigneeSaveState('idle');
      }, 200); // Small delay to allow click events to fire
    }
  };

  const priorityClass = `issue-card--priority-${issue.priority.toLowerCase()}`;
  const clickableClass = onClick ? '' : 'issue-card--not-clickable';
  const draggingClass = isDragging ? 'issue-card--dragging' : '';
  const dropTargetClass = isDropTarget ? 'issue-card--drop-target' : '';
  const conversionEnabled = Boolean(onConvertToGitHub && !isClosed);
  
  // Only allow dragging for non-closed issues, and only epics/features can be drop targets
  const canBeDropTarget = issue.type === 'epic' || issue.type === 'feature';
  const canBeDragged = !isClosed && issue.type !== 'epic'; // Epics can't be children

  const labels = Array.isArray(issue.labels) ? issue.labels.filter(Boolean) : [];
  
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
          <CopyableIssueId id={issue.id} className="issue-card__id" />
          <span className={`issue-card__badge issue-card__badge--priority issue-card__badge--priority-${issue.priority.toLowerCase()}`}>
            {issue.priority}
          </span>
          <span className={`issue-card__badge issue-card__badge--type-${issue.type}`}>
            {issue.type}
          </span>
          <span className={`issue-card__status issue-card__status--${issue.status.replace('_', '-')}`}>
            ● {issue.status}
          </span>
          {issue.isBlocked && (
            <span className="issue-card__badge issue-card__badge--blocked" title="Blocked by open dependencies">
              🚫 blocked
            </span>
          )}
          {totalRelationships > 0 && (
            <span className="issue-card__relationships-badge" title={`${issue.dependency_count || 0} dependencies, ${issue.dependent_count || 0} dependents`}>
              🔗 {totalRelationships}
            </span>
          )}
          {!isClosed && (
            <div 
              className={`issue-card__assignee-editor ${isEditingAssignee ? 'issue-card__assignee-editor--active' : ''}`}
              onClick={handleAssigneeClick}
            >
              {!isEditingAssignee ? (
                <span 
                  className="issue-card__assignee-display"
                  title={onAssigneeChange ? 'Click to edit assignee' : 'Assignee'}
                >
                  {assigneeSaveState === 'saving' && '⏳ '}
                  {assigneeSaveState === 'saved' && '✓ '}
                  {assigneeSaveState === 'error' && '❌ '}
                  👤 {issue.assignee || detailedData?.assignee || 'Unassigned'}
                </span>
              ) : (
                <div className="issue-card__assignee-input-wrapper" onClick={(e) => e.stopPropagation()}>
                  <AssigneeDropdown
                    value={issue.assignee || detailedData?.assignee || ''}
                    onCommit={handleAssigneeChange}
                    existingAssignees={existingAssignees || []}
                    placeholder="Select or type assignee"
                  />
                </div>
              )}
            </div>
          )}
        </div>
        <div className="issue-card__actions">
          {totalRelationships > 0 && (
            <button
              onClick={handleShowHierarchyClick}
              className="issue-card__action-btn"
              title="Show hierarchy view">
              🌳
            </button>
          )}
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
          {!isClosed && onPokePoke && (
            <button
              onClick={(e) => { e.stopPropagation(); onPokePoke(issue.id, issue.title, totalRelationships > 0); }}
              className={`issue-card__action-btn ${pokepokeRunning ? 'issue-card__action-btn--pokepoke-running' : ''}`}
              title={pokepokeRunning ? 'PokePoke is running' : 'Assign to PokePoke'}
              disabled={pokepokeRunning}>
              {pokepokeRunning ? '⏳' : '🤖'}
            </button>
          )}
          {onConvertToGitHub && (
            <button
              onClick={handleConvertToGitHubClick}
              className="issue-card__action-btn issue-card__action-btn--github"
              title="Convert to GitHub issue"
              disabled={!conversionEnabled}>
              🐙
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
      {labels.length > 0 && (
        <div className="issue-card__tags">
          {labels.map((label) => (
            <span key={label} className="issue-card__tag">
              {label}
            </span>
          ))}
        </div>
      )}
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
          <IssueCardDetails 
            isLoadingDetails={isLoadingDetails}
            detailedData={detailedData}
            issue={issue}
            totalRelationships={totalRelationships}
            loadingDeps={loadingDeps}
            dependencies={dependencies}
            dependents={dependents}
            loadingComments={loadingComments}
            comments={comments}
          />
        </div>
      )}
    </div>
  );
};

export default IssueCard;
