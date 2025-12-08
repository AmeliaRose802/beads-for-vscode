import React from 'react';

const IssueCard = ({ issue, onClick, onClose, onReopen }) => {
  const isClosed = issue.status === 'closed';

  const handleCardClick = (e) => {
    // Don't trigger card click if clicking on action buttons
    if (e.target.closest('.issue-card__actions')) {
      return;
    }
    onClick && onClick();
  };

  const handleClose = (e) => {
    e.stopPropagation();
    onClose && onClose();
  };

  const handleReopen = (e) => {
    e.stopPropagation();
    onReopen && onReopen();
  };

  const priorityClass = `issue-card--priority-${issue.priority.toLowerCase()}`;
  const clickableClass = onClick ? '' : 'issue-card--not-clickable';
  
  return (
    <div 
      className={`issue-card ${priorityClass} ${clickableClass}`}
      onClick={handleCardClick}>
      <div className="issue-card__header">
        <div className="issue-card__badges">
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
        </div>
        <div className="issue-card__actions">
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
    </div>
  );
};

export default IssueCard;
