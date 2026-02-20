import React from 'react';

/**
 * BulkUnblockConfirmDialog - Confirmation dialog for bulk epic unblock operation
 * Shows count of cascaded blocks to be removed and requires user confirmation.
 */
const BulkUnblockConfirmDialog = ({ 
  fromId, 
  toId, 
  cascadedCount,
  childrenPreview,
  onConfirm, 
  onCancel 
}) => {
  return (
    <div className="bulk-unblock-dialog-overlay" onClick={onCancel}>
      <div 
        className="bulk-unblock-dialog" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bulk-unblock-dialog__header">
          <h3 className="bulk-unblock-dialog__title">
            Bulk Unblock Epic Children
          </h3>
          <button 
            className="bulk-unblock-dialog__close"
            type="button"
            onClick={onCancel}
          >✕</button>
        </div>
        
        <div className="bulk-unblock-dialog__content">
          <p className="bulk-unblock-dialog__message">
            This will remove the epic-level blocking relationship and all cascaded blocks between children:
          </p>
          
          <div className="bulk-unblock-dialog__epic-info">
            <div className="bulk-unblock-dialog__epic">
              <strong>From:</strong> {fromId}
            </div>
            <div className="bulk-unblock-dialog__epic">
              <strong>To:</strong> {toId}
            </div>
          </div>
          
          <div className="bulk-unblock-dialog__stats">
            <p>
              <strong>{cascadedCount}</strong> cascaded blocking relationships will be removed.
            </p>
          </div>
          
          {childrenPreview && childrenPreview.length > 0 && (
            <div className="bulk-unblock-dialog__preview">
              <p className="bulk-unblock-dialog__preview-label">
                Affected relationships (showing first {Math.min(5, childrenPreview.length)} of {cascadedCount}):
              </p>
              <ul className="bulk-unblock-dialog__preview-list">
                {childrenPreview.slice(0, 5).map((rel, idx) => (
                  <li key={idx} className="bulk-unblock-dialog__preview-item">
                    {rel.from} → {rel.to}
                  </li>
                ))}
              </ul>
              {cascadedCount > 5 && (
                <p className="bulk-unblock-dialog__preview-more">
                  ...and {cascadedCount - 5} more
                </p>
              )}
            </div>
          )}
          
          <div className="bulk-unblock-dialog__warning">
            <strong>⚠️ Warning:</strong> This operation cannot be undone.
            Manually-created blocks between the same children will be preserved.
          </div>
        </div>
        
        <div className="bulk-unblock-dialog__actions">
          <button
            className="bulk-unblock-dialog__btn bulk-unblock-dialog__btn--cancel"
            type="button"
            onClick={onCancel}
          >Cancel</button>
          <button
            className="bulk-unblock-dialog__btn bulk-unblock-dialog__btn--confirm"
            type="button"
            onClick={onConfirm}
          >Remove {cascadedCount} Blocks</button>
        </div>
      </div>
    </div>
  );
};

export default BulkUnblockConfirmDialog;
