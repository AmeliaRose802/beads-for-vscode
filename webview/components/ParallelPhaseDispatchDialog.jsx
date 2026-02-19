import React from 'react';

const STATUS_LABELS = {
  pending: 'Pending',
  creating: 'Creating…',
  created: 'Created',
  failed: 'Failed'
};

const formatPhaseTitle = (phaseIndex) => {
  if (typeof phaseIndex !== 'number' || !Number.isFinite(phaseIndex)) {
    return 'Dispatch phase to Copilot';
  }
  return `Dispatch Phase ${phaseIndex + 1} to Copilot`;
};

/**
 * ParallelPhaseDispatchDialog
 * Confirmation + progress dialog for bulk-dispatching a dependency phase.
 */
export default function ParallelPhaseDispatchDialog({
  open,
  phaseIndex,
  repo,
  items,
  assignments,
  progressById,
  running,
  completed,
  summary,
  error,
  onCancel,
  onStart,
  onClose
}) {
  if (!open) {
    return null;
  }

  const title = formatPhaseTitle(phaseIndex);
  const repoLabel = repo && repo.owner && repo.repo ? `${repo.owner}/${repo.repo}` : null;
  const isConfirmStep = !running && !completed;

  return (
    <div className="ppd-dialog__overlay" role="presentation" onMouseDown={(e) => {
      if (e.target === e.currentTarget && !running) {
        onCancel && onCancel();
      }
    }}>
      <div className="ppd-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="ppd-dialog__header">
          <div className="ppd-dialog__title">{title}</div>
          <button
            type="button"
            className="ppd-dialog__close"
            onClick={() => (running ? undefined : (onCancel && onCancel()))}
            disabled={running}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {repoLabel && (
          <div className="ppd-dialog__repo">
            Target repo: <span className="ppd-dialog__repo-name">{repoLabel}</span>
          </div>
        )}

        <div className="ppd-dialog__body">
          {error && (
            <div className="ppd-dialog__error">{error}</div>
          )}

          {isConfirmStep && (
            <div className="ppd-dialog__hint">
              This will create a GitHub issue for each beads item and assign them round-robin.
            </div>
          )}

          <div className="ppd-dialog__list">
            {items.map((item, idx) => {
              const assignment = assignments && assignments[idx] ? assignments[idx] : null;
              const progress = progressById && progressById[item.id] ? progressById[item.id] : null;
              const status = progress && progress.state ? progress.state : (running ? 'pending' : 'pending');
              const statusLabel = STATUS_LABELS[status] || status;

              return (
                <div key={item.id} className="ppd-dialog__row">
                  <div className="ppd-dialog__row-main">
                    <div className="ppd-dialog__row-id">{item.id}</div>
                    <div className="ppd-dialog__row-title">{item.title}</div>
                    {assignment && (
                      <div className="ppd-dialog__row-assignee">@{assignment}</div>
                    )}
                  </div>

                  <div className={`ppd-dialog__row-status ppd-dialog__row-status--${status}`}>{statusLabel}</div>

                  {progress && progress.url && (
                    <a className="ppd-dialog__row-link" href={progress.url} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  )}

                  {progress && progress.warning && (
                    <div className="ppd-dialog__row-warning">{progress.warning}</div>
                  )}

                  {progress && progress.error && (
                    <div className="ppd-dialog__row-error">{progress.error}</div>
                  )}
                </div>
              );
            })}
          </div>

          {completed && summary && (
            <div className="ppd-dialog__summary">
              <span className="ppd-dialog__summary-item">✅ {summary.successCount} created</span>
              <span className="ppd-dialog__summary-item">❌ {summary.failureCount} failed</span>
            </div>
          )}
        </div>

        <div className="ppd-dialog__footer">
          {isConfirmStep && (
            <>
              <button type="button" className="ppd-dialog__btn" onClick={() => onCancel && onCancel()}>
                Cancel
              </button>
              <button
                type="button"
                className="ppd-dialog__btn ppd-dialog__btn--primary"
                onClick={() => onStart && onStart()}
                disabled={!items || items.length === 0}
              >
                Dispatch
              </button>
            </>
          )}

          {running && (
            <button type="button" className="ppd-dialog__btn" disabled>
              Dispatching…
            </button>
          )}

          {completed && (
            <button type="button" className="ppd-dialog__btn ppd-dialog__btn--primary" onClick={() => onClose && onClose()}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
