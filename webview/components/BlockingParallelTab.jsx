import React from 'react';
const { getStatusIcon } = require('../field-utils');

const BlockingParallelTab = ({
  parallelGroups,
  readyIds,
  onIssueClick,
  onCopyGroup,
  onCopyAll,
  renderCopyFeedback
}) => (
  <div className="blocking-view__parallel">
    <div className="blocking-view__parallel-header blocking-view__copy-actions">
      <span className="blocking-view__parallel-label">
        Work can be parallelized into {parallelGroups.length} phases:
      </span>
      <div className="blocking-view__copy-controls">
        <button
          type="button"
          className="blocking-view__copy-button"
          onClick={onCopyAll}
          aria-label="Copy all parallel phases"
        >
          Copy all phases
        </button>
        {renderCopyFeedback?.('parallel-all')}
      </div>
    </div>
    {parallelGroups.map((group, idx) => (
      <div key={idx} className="blocking-view__parallel-group">
        <div className="blocking-view__parallel-phase-row">
          <div className="blocking-view__parallel-phase">
            Phase {idx + 1} ({group.length} item{group.length !== 1 ? 's' : ''})
          </div>
          <div className="blocking-view__parallel-phase-actions">
            <button
              type="button"
              className="blocking-view__copy-button"
              onClick={() => onCopyGroup(group, idx)}
              aria-label={`Copy phase ${idx + 1}`}
            >
              Copy phase
            </button>
            {renderCopyFeedback?.(`phase-${idx}`)}
          </div>
        </div>
        <div className="blocking-view__parallel-items">
          {group.map(issue => (
            <div
              key={issue.id}
              className={`blocking-view__parallel-item ${readyIds.has(issue.id) ? 'blocking-view__parallel-item--ready' : ''}`}
              onClick={() => onIssueClick(issue)}
            >
              <span className="blocking-view__parallel-status">{getStatusIcon(issue.status)}</span>
              <span className="blocking-view__parallel-id">{issue.id}</span>
              <span className="blocking-view__parallel-title">{issue.title}</span>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

export default BlockingParallelTab;
