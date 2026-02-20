import { useState } from 'react';

/**
 * Hook for managing bulk unblock epic functionality
 * Extracted from App.jsx to reduce file length.
 */
export function useBulkUnblockEpics({ graphData, vscode, setOutput, setIsError, setIsSuccess, requestBlockingData }) {
  const [bulkUnblockDialog, setBulkUnblockDialog] = useState(null);

  const handleBulkUnblockEpics = async (fromId, toId) => {
    // Find all children of both epics and their blocking relationships
    if (!graphData || !graphData[0]) {
      setOutput('Error: Graph data not available');
      setIsError(true);
      return;
    }
    
    const allDeps = graphData[0].Dependencies || [];
    
    // Find children of both epics
    const fromChildren = allDeps
      .filter(d => d.depends_on_id === fromId && d.type === 'parent')
      .map(d => d.issue_id);
    
    const toChildren = allDeps
      .filter(d => d.depends_on_id === toId && d.type === 'parent')
      .map(d => d.issue_id);
    
    // Find all blocking relationships between children
    const cascadedBlocks = allDeps.filter(d => {
      if (d.type !== 'blocked-by' && d.type !== 'blocks') return false;
      const isFromChild = fromChildren.includes(d.depends_on_id);
      const isToChild = toChildren.includes(d.issue_id);
      return isFromChild && isToChild;
    });
    
    // Also check for the epic-to-epic block itself
    const epicBlock = allDeps.find(d => 
      d.depends_on_id === fromId && 
      d.issue_id === toId && 
      (d.type === 'blocked-by' || d.type === 'blocks')
    );
    
    const totalCount = cascadedBlocks.length + (epicBlock ? 1 : 0);
    
    if (totalCount === 0) {
      setOutput(`No blocking relationships found between ${fromId} and ${toId}`);
      setIsError(false);
      setIsSuccess(true);
      return;
    }
    
    // Prepare preview data
    const preview = cascadedBlocks.map(d => ({
      from: d.depends_on_id,
      to: d.issue_id
    }));
    
    // Show confirmation dialog
    setBulkUnblockDialog({
      fromId,
      toId,
      cascadedCount: totalCount,
      childrenPreview: preview,
      cascadedBlocks,
      epicBlock
    });
  };

  const confirmBulkUnblock = async () => {
    if (!bulkUnblockDialog) return;
    
    const { fromId, toId, cascadedBlocks, epicBlock, cascadedCount } = bulkUnblockDialog;
    setBulkUnblockDialog(null);
    
    // Show progress
    setOutput(`🔄 Removing ${cascadedCount} blocking relationships...`);
    setIsError(false);
    setIsSuccess(false);
    
    // Remove all cascaded blocks
    for (const dep of cascadedBlocks) {
      const cmd = `dep remove ${dep.issue_id} ${dep.depends_on_id}`;
      vscode.postMessage({
        type: 'executeCommand',
        command: cmd,
        useJSON: false,
        isInlineAction: true,
        successMessage: `Removed ${dep.depends_on_id} → ${dep.issue_id}`,
        isBackgroundSync: true
      });
    }
    
    // Remove epic-to-epic block
    if (epicBlock) {
      const cmd = `dep remove ${epicBlock.issue_id} ${epicBlock.depends_on_id}`;
      vscode.postMessage({
        type: 'executeCommand',
        command: cmd,
        useJSON: false,
        isInlineAction: true,
        successMessage: `Removed ${fromId} → ${toId}`,
        isBackgroundSync: false
      });
    }
    
    setOutput(`✅ Removed ${cascadedCount} blocking relationships between ${fromId} and ${toId}`);
    setIsSuccess(true);
    
    // Refresh blocking view
    setTimeout(() => requestBlockingData(), 500);
  };

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
