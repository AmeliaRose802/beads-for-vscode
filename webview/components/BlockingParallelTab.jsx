const { getStatusIcon } = require('../field-utils');

const BlockingParallelTab= ({
  parallelGroups,
  readyIds,
  onIssueClick,
  onCopyGroup,
  onCopyAll,
  renderCopyFeedback,
  getPhasePreview,
  onTogglePhase
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
    {parallelGroups.map((group, idx) => {
      const {
        isExpanded,
        shouldToggle,
        hiddenCount,
        visibleItems
      } = getPhasePreview(group, idx);
      return (
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
            {visibleItems.map(issue => (
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
          {shouldToggle && (
            <button
              type="button"
              className="blocking-view__phase-toggle"
              onClick={() => onTogglePhase(idx)}
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} phase ${idx + 1}`}
            >
              {isExpanded ? 'Show fewer' : `Show ${hiddenCount} more`}
            </button>
          )}
        </div>
      );
    })}
  </div>
);

export default BlockingParallelTab;
