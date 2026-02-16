import React from 'react';

/**
 * Visible warning shown when the workspace has not been initialized with beads.
 * @param {{ beadsStatus: { hasWorkspace: boolean, initialized: boolean, beadsDir?: string } | null, onInit: () => void }} props
 */
export default function BeadsInitWarning({ beadsStatus, onInit }) {
  if (!beadsStatus) return null;

  if (!beadsStatus.hasWorkspace) {
    return (
      <div className="init-warning">
        <div className="init-warning__title">Beads UI needs an open folder</div>
        <div className="init-warning__text">
          Open a workspace folder, then run <code>bd init</code> in that folder to get started.
        </div>
      </div>
    );
  }

  if (beadsStatus.initialized) return null;

  return (
    <div className="init-warning">
      <div className="init-warning__title">Beads is not initialized in this workspace</div>
      <div className="init-warning__text">
        This folder does not contain a <code>.beads</code> directory yet.
        Run <code>bd init</code> in the workspace root to set up beads.
      </div>
      {beadsStatus.beadsDir && (
        <div className="init-warning__path">Expected: <code>{beadsStatus.beadsDir}</code></div>
      )}
      <div className="init-warning__actions">
        <button className="run-btn" onClick={onInit} title="Run bd init in this workspace">
          Run bd init
        </button>
      </div>
    </div>
  );
}
