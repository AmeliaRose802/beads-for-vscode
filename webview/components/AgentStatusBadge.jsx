import React from 'react';
import { deriveAgentStatus } from '../hooks/useAgentTracking';

const STATUS_CONFIG = {
  merged: { icon: '✅', label: 'PR Merged', className: 'agent-badge--merged' },
  'pr-open': { icon: '🟢', label: 'PR Open', className: 'agent-badge--pr-open' },
  closed: { icon: '⚪', label: 'Issue Closed', className: 'agent-badge--closed' },
  open: { icon: '🔵', label: 'Agent Working', className: 'agent-badge--open' },
  dispatched: { icon: '🟡', label: 'Dispatched', className: 'agent-badge--dispatched' }
};

/**
 * Badge component showing GitHub Copilot agent tracking status.
 * @param {{ tracking: object, onRefresh: function }} props
 */
const AgentStatusBadge = ({ tracking, onRefresh }) => {
  if (!tracking) return null;

  const status = deriveAgentStatus(tracking);
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.dispatched;

  const handleRefreshClick = (e) => {
    e.stopPropagation();
    if (onRefresh) onRefresh();
  };

  const handleLinkClick = (e) => {
    e.stopPropagation();
  };

  return (
    <span className={`agent-badge ${config.className}`} title={config.label}>
      {tracking.url ? (
        <a
          href={tracking.url}
          className="agent-badge__link"
          onClick={handleLinkClick}
          title={`GitHub Issue #${tracking.number || '?'} - ${config.label}`}
        >
          {config.icon} #{tracking.number || '?'}
        </a>
      ) : (
        <span>{config.icon}</span>
      )}
      {tracking.pr && tracking.pr.url && (
        <a
          href={tracking.pr.url}
          className="agent-badge__pr-link"
          onClick={handleLinkClick}
          title={`PR #${tracking.pr.number} - ${tracking.pr.title || config.label}`}
        >
          PR #{tracking.pr.number}
        </a>
      )}
      {onRefresh && (
        <button
          className="agent-badge__refresh"
          onClick={handleRefreshClick}
          title="Refresh agent status"
        >
          🔄
        </button>
      )}
    </span>
  );
};

export default AgentStatusBadge;
