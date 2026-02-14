import React, { useMemo, useState } from 'react';
const { buildPlanSchedule } = require('../plan-utils');
const { getStatusIcon } = require('../field-utils');

const DEFAULT_MAX_PARALLEL = 4;

const BlockingPlanView = ({ issues, edges, completionOrder, readyIds, onIssueClick }) => {
  const [maxParallel, setMaxParallel] = useState(DEFAULT_MAX_PARALLEL);

  const plan = useMemo(
    () => buildPlanSchedule(issues, edges, completionOrder, maxParallel),
    [issues, edges, completionOrder, maxParallel]
  );

  const handleLimitChange = (event) => {
    const nextValue = Math.max(1, Math.floor(Number(event.target.value) || 1));
    setMaxParallel(nextValue);
  };

  const throughputLabel = plan.totalWaves === 0
    ? '0'
    : plan.averageThroughput.toFixed(1);

  return (
    <div className="blocking-view__plan">
      <div className="blocking-view__plan-controls">
        <label className="blocking-view__plan-label">
          Max parallel items
          <input
            className="blocking-view__plan-input"
            type="number"
            min="1"
            value={maxParallel}
            onChange={handleLimitChange}
            aria-label="Max parallel items"
          />
        </label>
        <div className="blocking-view__plan-summary">
          <span className="blocking-view__plan-stat">Total waves: {plan.totalWaves}</span>
          <span className="blocking-view__plan-stat">
            Estimated throughput: {throughputLabel} items/wave
          </span>
          <span className="blocking-view__plan-stat">{plan.totalItems} scheduled</span>
        </div>
      </div>

      {plan.totalItems === 0 ? (
        <div className="blocking-view__plan-empty">
          No open items to schedule. Closed work is treated as complete.
        </div>
      ) : (
        plan.waves.map((wave, index) => (
          <div key={`${index}-${wave.length}`} className="blocking-view__plan-wave">
            <div className="blocking-view__plan-wave-header">
              <span className="blocking-view__plan-wave-title">Wave {index + 1}</span>
              <span className="blocking-view__plan-wave-meta">
                {wave.length} item{wave.length !== 1 ? 's' : ''} (capacity {wave.length}/{plan.capacity})
              </span>
            </div>
            <div className="blocking-view__plan-items">
              {wave.map(issue => {
                const isReady = readyIds?.has(issue.id);
                const itemClass = [
                  'blocking-view__plan-item',
                  isReady ? 'blocking-view__plan-item--ready' : ''
                ].filter(Boolean).join(' ');

                return (
                  <div
                    key={issue.id}
                    className={itemClass}
                    onClick={() => onIssueClick?.(issue)}
                  >
                    <span className="blocking-view__plan-status">{getStatusIcon(issue.status)}</span>
                    <span className="blocking-view__plan-id">{issue.id}</span>
                    <span className="blocking-view__plan-title">{issue.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default BlockingPlanView;
