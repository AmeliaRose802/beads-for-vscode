import { useCallback, useState } from 'react';

/**
 * @typedef {object} AgentTrackingEntry
 * @property {string} url - GitHub issue URL
 * @property {number|null} number - GitHub issue number
 * @property {string} assignee - Copilot assignee username
 * @property {string} issueState - Issue state: OPEN, CLOSED, UNKNOWN
 * @property {{ number: number, url: string, state: string, title: string }|null} pr
 * @property {string|null} lastChecked - ISO timestamp of last status check
 */

const initialMap = {};

/**
 * Derive a display status from tracking entry data.
 * @param {AgentTrackingEntry} entry - Tracking entry
 * @returns {string} Status key: 'merged', 'pr-open', 'closed', 'open', 'dispatched'
 */
export function deriveAgentStatus(entry) {
  if (!entry) return null;
  if (entry.pr && entry.pr.state === 'MERGED') return 'merged';
  if (entry.pr && entry.pr.state === 'OPEN') return 'pr-open';
  if (entry.issueState === 'CLOSED') return 'closed';
  if (entry.issueState === 'OPEN') return 'open';
  return 'dispatched';
}

/**
 * Hook for tracking GitHub Copilot agent dispatch and status.
 * @param {{ vscode: object }} options
 * @returns {object} Agent tracking state and actions
 */
export const useAgentTracking = ({ vscode }) => {
  const [agentTracking, setAgentTracking] = useState(initialMap);

  const trackDispatch = useCallback((beadsItemId, url, number, assignee) => {
    setAgentTracking((prev) => ({
      ...prev,
      [beadsItemId]: {
        url: url || '',
        number: number || null,
        assignee: assignee || '',
        issueState: 'OPEN',
        pr: null,
        lastChecked: null
      }
    }));
  }, []);

  const trackBatchDispatch = useCallback((results) => {
    if (!Array.isArray(results)) return;
    setAgentTracking((prev) => {
      const next = { ...prev };
      for (const r of results) {
        if (r.success && r.issueId) {
          next[r.issueId] = {
            url: r.url || '',
            number: r.number || null,
            assignee: r.assignee || '',
            issueState: 'OPEN',
            pr: null,
            lastChecked: null
          };
        }
      }
      return next;
    });
  }, []);

  const updateAgentStatus = useCallback((beadsItemId, statusData) => {
    setAgentTracking((prev) => {
      const existing = prev[beadsItemId];
      if (!existing) return prev;
      return {
        ...prev,
        [beadsItemId]: {
          ...existing,
          issueState: statusData.issueState || existing.issueState,
          pr: statusData.pr || existing.pr,
          lastChecked: new Date().toISOString()
        }
      };
    });
  }, []);

  const refreshAgentStatus = useCallback((beadsItemId) => {
    const entry = agentTracking[beadsItemId];
    if (!entry || !entry.number || !vscode) return;
    vscode.postMessage({
      type: 'checkAgentStatus',
      beadsItemId,
      issueNumber: entry.number
    });
  }, [agentTracking, vscode]);

  const refreshAllAgentStatuses = useCallback(() => {
    const ids = Object.keys(agentTracking);
    for (const id of ids) {
      const entry = agentTracking[id];
      if (entry && entry.number && vscode) {
        vscode.postMessage({
          type: 'checkAgentStatus',
          beadsItemId: id,
          issueNumber: entry.number
        });
      }
    }
  }, [agentTracking, vscode]);

  return {
    agentTracking,
    trackDispatch,
    trackBatchDispatch,
    updateAgentStatus,
    refreshAgentStatus,
    refreshAllAgentStatuses
  };
};
