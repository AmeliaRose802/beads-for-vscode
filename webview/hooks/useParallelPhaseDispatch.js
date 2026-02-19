import { useCallback, useState } from 'react';

const DEFAULT_COPILOT_ASSIGNEES = ['github-copilot'];

const computeRoundRobinAssignments = (items, assignees) => {
  const list = Array.isArray(assignees) && assignees.length > 0
    ? assignees
    : DEFAULT_COPILOT_ASSIGNEES;

  return (items || []).map((_, idx) => list[idx % list.length]);
};

const buildPendingProgressMap = (items) => (items || []).reduce((acc, item) => {
  acc[item.id] = { state: 'pending' };
  return acc;
}, {});

const initialState = {
  open: false,
  phaseIndex: null,
  items: [],
  assignments: [],
  progressById: {},
  running: false,
  completed: false,
  summary: null,
  error: null
};

export const useParallelPhaseDispatch = ({ vscode, gitHubInfo }) => {
  const [parallelPhaseDispatch, setParallelPhaseDispatch] = useState(initialState);

  const openParallelPhaseDispatch = useCallback((group, phaseIndex) => {
    const items = Array.isArray(group)
      ? group.map(({ id, title }) => ({ id, title }))
      : [];

    const assignees = gitHubInfo && Array.isArray(gitHubInfo.copilotAssignees) && gitHubInfo.copilotAssignees.length > 0
      ? gitHubInfo.copilotAssignees
      : DEFAULT_COPILOT_ASSIGNEES;

    const assignments = computeRoundRobinAssignments(items, assignees);
    const progressById = buildPendingProgressMap(items);

    if (vscode && vscode.postMessage) {
      vscode.postMessage({ type: 'getGitHubInfo', silent: true });
    }

    setParallelPhaseDispatch({
      open: true,
      phaseIndex,
      items,
      assignments,
      progressById,
      running: false,
      completed: false,
      summary: null,
      error: null
    });
  }, [gitHubInfo, vscode]);

  const startParallelPhaseDispatch = useCallback(() => {
    setParallelPhaseDispatch((prev) => {
      if (!prev.open || prev.running) return prev;

      const issueIds = prev.items.map(i => i.id);
      vscode.postMessage({
        type: 'dispatchParallelPhase',
        phaseIndex: prev.phaseIndex,
        issueIds
      });

      const progressById = issueIds.reduce((acc, id) => {
        acc[id] = { state: 'pending' };
        return acc;
      }, {});

      return {
        ...prev,
        running: true,
        completed: false,
        summary: null,
        error: null,
        progressById
      };
    });
  }, [vscode]);

  const cancelParallelPhaseDispatch = useCallback(() => {
    setParallelPhaseDispatch((prev) => {
      if (!prev.open || prev.running) return prev;
      return { ...prev, open: false };
    });
  }, []);

  const closeParallelPhaseDispatch = useCallback(() => {
    setParallelPhaseDispatch((prev) => ({ ...prev, open: false }));
  }, []);

  const handleParallelPhaseDispatchMessage = useCallback((message) => {
    if (!message || !message.type) {
      return;
    }

    setParallelPhaseDispatch((prev) => {
      if (!prev.open) {
        return prev;
      }

      if (message.type === 'parallelPhaseDispatchStarted') {
        const assignmentMap = new Map(
          (Array.isArray(message.assignments) ? message.assignments : []).map(a => [a.issueId, a.assignee])
        );

        const nextAssignments = prev.items.map((item, idx) =>
          assignmentMap.get(item.id) || prev.assignments[idx] || null
        );

        const nextProgressById = { ...prev.progressById };
        prev.items.forEach((item) => {
          if (!nextProgressById[item.id]) {
            nextProgressById[item.id] = { state: 'pending' };
          }
        });

        return {
          ...prev,
          assignments: nextAssignments,
          running: true,
          completed: false,
          summary: null,
          error: null,
          progressById: nextProgressById
        };
      }

      if (message.type === 'parallelPhaseDispatchProgress') {
        const issueId = message.issueId;
        if (!issueId) return prev;

        return {
          ...prev,
          progressById: {
            ...prev.progressById,
            [issueId]: {
              ...(prev.progressById[issueId] || {}),
              state: message.state,
              url: message.url,
              number: message.number,
              error: message.error,
              warning: message.warning,
              assigned: message.assigned
            }
          }
        };
      }

      if (message.type === 'parallelPhaseDispatchComplete') {
        return {
          ...prev,
          running: false,
          completed: true,
          summary: {
            successCount: message.successCount,
            failureCount: message.failureCount
          }
        };
      }

      if (message.type === 'parallelPhaseDispatchError') {
        return {
          ...prev,
          running: false,
          completed: true,
          error: message.error || 'Dispatch failed'
        };
      }

      return prev;
    });
  }, []);

  return {
    parallelPhaseDispatch,
    openParallelPhaseDispatch,
    startParallelPhaseDispatch,
    cancelParallelPhaseDispatch,
    closeParallelPhaseDispatch,
    handleParallelPhaseDispatchMessage
  };
};
