import { useState } from 'react';
const { findCascadedBlocks, hasDirectEpicBlock } = require('../epic-unblock-utils');

/**
 * Hook for managing bulk unblock epic functionality.
 * Uses cascaded_from metadata to distinguish auto-generated from manual blocks.
 * Extracted from App.jsx to reduce file length.
 *
 * @param {object} opts - Hook options.
 * @param {Array|null} opts.graphData - Full graph data from bd.
 * @param {object} opts.vscode - VS Code API handle.
 * @param {Function} opts.setOutput - Set output message.
 * @param {Function} opts.setIsError - Set error flag.
 * @param {Function} opts.setIsSuccess - Set success flag.
 * @param {Function} opts.requestBlockingData - Refresh blocking view.
 * @returns {{ bulkUnblockDialog: object|null, handleBulkUnblockEpics: Function, confirmBulkUnblock: Function, cancelBulkUnblock: Function }}
 */
export function useBulkUnblockEpics({ graphData, vscode, setOutput, setIsError, setIsSuccess, requestBlockingData: _requestBlockingData }) {
  const [bulkUnblockDialog, setBulkUnblockDialog] = useState(null);

  /**
   * Analyse cascaded blocks between two epics and show the confirmation dialog.
   * @param {string} fromId - Blocker epic ID.
   * @param {string} toId - Blocked epic ID.
   */
  const handleBulkUnblockEpics = (fromId, toId) => {
    if (!Array.isArray(graphData) || graphData.length === 0) {
      setOutput('Error: Graph data not available');
      setIsError(true);
      return;
    }

    const { cascadedDeps, manualDeps } = findCascadedBlocks(graphData, fromId, toId);
    const hasDirectBlock = hasDirectEpicBlock(graphData, fromId, toId);
    const totalCount = cascadedDeps.length + (hasDirectBlock ? 1 : 0);

    if (totalCount === 0) {
      setOutput(`No blocking relationships found between ${fromId} and ${toId}`);
      setIsError(false);
      setIsSuccess(true);
      return;
    }

    setBulkUnblockDialog({
      fromId,
      toId,
      cascadedCount: totalCount,
      childrenPreview: cascadedDeps.slice(0, 10),
      cascadedDeps,
      manualCount: manualDeps.length
    });
  };

  /**
   * Execute the bulk unblock via a single backend message.
   */
  const confirmBulkUnblock = () => {
    if (!bulkUnblockDialog) return;

    const { fromId, toId, cascadedDeps, cascadedCount } = bulkUnblockDialog;
    setBulkUnblockDialog(null);

    setOutput(`Removing ${cascadedCount} blocking relationship${cascadedCount !== 1 ? 's' : ''}...`);
    setIsError(false);
    setIsSuccess(false);

    vscode.postMessage({
      type: 'epicUnblock',
      epicA: fromId,
      epicB: toId,
      cascadedDeps
    });
  };

  /** Cancel the bulk unblock operation. */
  const cancelBulkUnblock = () => {
    setBulkUnblockDialog(null);
  };

  return {
    bulkUnblockDialog,
    handleBulkUnblockEpics,
    confirmBulkUnblock,
    cancelBulkUnblock
  };
}

