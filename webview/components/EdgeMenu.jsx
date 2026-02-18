import React, { useState } from 'react';

/**
 * EdgeMenu - Interactive menu for managing dependency edges
 * Extracted from BlockingView.jsx to reduce file length.
 * 
 * Provides actions for removing, retargeting, and adding dependency links.
 */
const EdgeMenu = ({ fromId, toId, onRemove, onRetarget, onAddLink, onClose }) => {
  const [retargetState, setRetargetState] = useState(null);
  const [addLinkState, setAddLinkState] = useState(null);

  const handleRemoveClick = () => {
    if (onRemove) {
      onRemove(fromId, toId);
    }
  };

  const handleRetargetSubmit = () => {
    if (onRetarget && retargetState && retargetState.newTarget.trim()) {
      onRetarget(fromId, toId, retargetState.newTarget.trim());
    }
  };

  const handleAddLinkSubmit = () => {
    if (onAddLink && addLinkState && addLinkState.targetId.trim()) {
      onAddLink(fromId, addLinkState.targetId.trim());
    }
  };

  return (
    <div
      className="blocking-view__edge-menu"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="blocking-view__edge-menu-header">
        <span className="blocking-view__edge-menu-label">
          {fromId} → {toId}
        </span>
        <button
          className="blocking-view__edge-menu-close"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onClose) onClose();
          }}
        >✕</button>
      </div>
      <div className="blocking-view__edge-menu-actions">
        <button
          className="blocking-view__edge-menu-btn blocking-view__edge-menu-btn--remove"
          type="button"
          onClick={handleRemoveClick}
        >🗑 Remove link</button>
        
        {retargetState ? (
          <div className="blocking-view__edge-menu-input-row">
            <input
              className="blocking-view__edge-menu-input"
              placeholder="New target ID..."
              value={retargetState.newTarget}
              onChange={(e) => setRetargetState({ ...retargetState, newTarget: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRetargetSubmit();
                if (e.key === 'Escape') setRetargetState(null);
              }}
              autoFocus
            />
            <button
              className="blocking-view__edge-menu-btn"
              type="button"
              onClick={handleRetargetSubmit}
            >✓</button>
          </div>
        ) : (
          <button
            className="blocking-view__edge-menu-btn"
            type="button"
            onClick={() => setRetargetState({ newTarget: '' })}
          >🔄 Re-target</button>
        )}
        
        {addLinkState ? (
          <div className="blocking-view__edge-menu-input-row">
            <input
              className="blocking-view__edge-menu-input"
              placeholder="Target ID..."
              value={addLinkState.targetId}
              onChange={(e) => setAddLinkState({ ...addLinkState, targetId: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddLinkSubmit();
                if (e.key === 'Escape') setAddLinkState(null);
              }}
              autoFocus
            />
            <button
              className="blocking-view__edge-menu-btn"
              type="button"
              onClick={handleAddLinkSubmit}
            >✓</button>
          </div>
        ) : (
          <button
            className="blocking-view__edge-menu-btn"
            type="button"
            onClick={() => setAddLinkState({ targetId: '' })}
          >➕ Add link from {fromId}</button>
        )}
      </div>
    </div>
  );
};

export default EdgeMenu;
