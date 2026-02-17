import React, { useMemo, useState } from 'react';
const { buildPlanSchedule } = require('../plan-utils');
const { getStatusIcon } = require('../field-utils');

const DEFAULT_MAX_PARALLEL = 4;

const BlockingPlanView = ({ 
  issues, 
  edges, 
  completionOrder, 
  readyIds, 
  onIssueClick, 
  onCopy, 
  renderCopyFeedback 
}) => {
  const [maxParallel, setMaxParallel] = useState(DEFAULT_MAX_PARALLEL);
  const [inputValue, setInputValue] = useState(String(DEFAULT_MAX_PARALLEL));

  const plan = useMemo(
    () => buildPlanSchedule(issues, edges, completionOrder, maxParallel),
    [issues, edges, completionOrder, maxParallel]
  );
  const cycleIdSet = useMemo(() => new Set(plan?.cycleIds || []), [plan]);
  const hasCycles = Array.isArray(plan?.cycleGroups) && plan.cycleGroups.length > 0;

  const handleLimitChange = (event) => {
    const value = event.target.value;
    setInputValue(value);
    
    const numValue = Number(value);
    if (value !== '' && !isNaN(numValue) && numValue >= 1) {
      setMaxParallel(Math.floor(numValue));
    }
  };

  const handleLimitBlur = () => {
    const numValue = Number(inputValue);
    if (inputValue === '' || isNaN(numValue) || numValue < 1) {
      const defaultValue = Math.max(1, maxParallel);
      setMaxParallel(defaultValue);
      setInputValue(String(defaultValue));
    }
  };

  const throughputLabel = plan.totalWaves === 0
    ? '0'
    : plan.averageThroughput.toFixed(1);

  return (
    <div className="blocking-view__plan">
      <div className="blocking-view__plan-controls">
        <div className="blocking-view__plan-config">
          <label className="blocking-view__plan-label">
            Max parallel items
            <input
              className="blocking-view__plan-input"
              type="number"
              min="1"
              value={inputValue}
              onChange={handleLimitChange}
              onBlur={handleLimitBlur}
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
        <div className="blocking-view__copy-controls">
          <button
            type="button"
            className="blocking-view__copy-button"
            onClick={() => onCopy?.(plan)}
            aria-label="Copy execution plan"
          >
            Copy plan
          </button>
          {renderCopyFeedback?.('plan')}
        </div>
      </div>

      {hasCycles && (
        <div className="blocking-view__plan-warning" role="alert">
          <span className="blocking-view__plan-warning-icon" aria-hidden="true">⚠️</span>
          <div className="blocking-view__plan-warning-content">
            <span className="blocking-view__plan-warning-title">Circular dependencies detected</span>
            <p className="blocking-view__plan-warning-description">
              Resolve these cycles so work can progress in later waves.
            </p>
            <ul className="blocking-view__plan-warning-list">
              {plan.cycleGroups.map((group, index) => {
                const label = group
                  .map(issue => {
                    const issueId = issue?.id ?? '?';
                    const title = issue?.title ? ` – ${issue.title}` : '';
                    return `${issueId}${title}`;
                  })
                  .join(' ↔ ');
                return (
                  <li key={`cycle-${index}`} className="blocking-view__plan-warning-item">
                    {label}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

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
                const isCycle = cycleIdSet.has(issue.id);
                const itemClass = [
                  'blocking-view__plan-item',
                  isReady ? 'blocking-view__plan-item--ready' : '',
                  isCycle ? 'blocking-view__plan-item--cycle' : ''
                ].filter(Boolean).join(' ');

                return (
                  <div
                    key={issue.id}
                    className={itemClass}
                    onClick={() => onIssueClick?.(issue)}
                  >
                    <span className="blocking-view__plan-status">{getStatusIcon(issue.status)}</span>
                    {isCycle && (
                      <span className="blocking-view__plan-cycle" aria-label="Cycle" title="Circular dependency detected">
                        🔄
                      </span>
                    )}
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
