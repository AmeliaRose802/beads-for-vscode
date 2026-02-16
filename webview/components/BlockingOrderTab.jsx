const { getStatusIcon } = require('../field-utils');

const BlockingOrderTab= ({
  issues,
  criticalPathIds,
  readyIds,
  onIssueClick,
  onCopy,
  renderCopyFeedback
}) => (
  <div className="blocking-view__order">
    <div className="blocking-view__order-header blocking-view__copy-actions">
      <span className="blocking-view__order-label">
        Suggested completion order (dependencies first):
      </span>
      <div className="blocking-view__copy-controls">
        <button
          type="button"
          className="blocking-view__copy-button"
          onClick={onCopy}
          aria-label="Copy the suggested completion order"
        >
          Copy order
        </button>
        {renderCopyFeedback?.('order')}
      </div>
    </div>
    <ol className="blocking-view__order-list">
      {issues.map((issue, idx) => {
        const isCritical = criticalPathIds.has(issue.id);
        const isReady = readyIds.has(issue.id);
        const itemClass = [
          'blocking-view__order-item',
          isCritical ? 'blocking-view__order-item--critical' : '',
          isReady ? 'blocking-view__order-item--ready' : '',
          issue.status === 'closed' ? 'blocking-view__order-item--done' : ''
        ].filter(Boolean).join(' ');

        return (
          <li
            key={issue.id}
            className={itemClass}
            onClick={() => onIssueClick(issue)}
          >
            <span className="blocking-view__order-step">{idx + 1}</span>
            <span className="blocking-view__order-status">{getStatusIcon(issue.status)}</span>
            <span className="blocking-view__order-id">{issue.id}</span>
            <span className="blocking-view__order-title">{issue.title}</span>
            {isCritical && <span className="blocking-view__tag blocking-view__tag--critical">Critical</span>}
            {isReady && <span className="blocking-view__tag blocking-view__tag--ready">Ready</span>}
          </li>
        );
      })}
    </ol>
  </div>
);

export default BlockingOrderTab;
