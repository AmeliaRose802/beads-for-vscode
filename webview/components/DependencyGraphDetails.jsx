import React from 'react';
import CopyableIssueId from './CopyableIssueId';

const DependencyGraphDetails = ({ issue, onClose }) => {
  if (!issue) {
    return null;
  }

  return (
    <div className="dependency-graph__details">
      <div className="dependency-graph__details-header">
        <CopyableIssueId id={issue.id} className="dependency-graph__details-id" />
        <button
          className="dependency-graph__details-close"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div className="dependency-graph__details-title">
        {issue.title}
      </div>
      <div className="dependency-graph__details-meta">
        <span className={`dependency-graph__details-badge dependency-graph__details-badge--${issue.issue_type}`}>
          {issue.issue_type}
        </span>
        <span className={`dependency-graph__details-badge dependency-graph__details-badge--p${issue.priority}`}>
          P{issue.priority}
        </span>
        <span className={`dependency-graph__details-status dependency-graph__details-status--${issue.status}`}>
          {issue.status}
        </span>
      </div>
    </div>
  );
};

export default DependencyGraphDetails;
