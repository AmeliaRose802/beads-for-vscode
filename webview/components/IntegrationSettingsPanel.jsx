import React from 'react';

const IntegrationSettingsPanel = ({
  backend,
  projectUrl,
  areaPath,
  iterationPath,
  importLimit,
  tokenInput,
  tokenSet,
  onBackendChange,
  onProjectUrlChange,
  onAreaPathChange,
  onIterationPathChange,
  onImportLimitChange,
  onTokenInputChange,
  onSave,
  onImport,
  onExport,
  onClose
}) => {
  const isAdo = backend === 'ado';
  const adoReady = isAdo && projectUrl.trim() && tokenSet;

  return (
    <div className="section">
      <div className="section-title">Integration Settings</div>
      <div className="relationship-content integration-settings">
        <div className="relationship-group">
          <label className="relationship-label">Backend</label>
          <select
            className="relationship-select"
            value={backend}
            onChange={(e) => onBackendChange(e.target.value)}
          >
            <option value="github">GitHub</option>
            <option value="ado">Azure DevOps</option>
          </select>
        </div>

        {isAdo && (
          <>
            <div className="relationship-group">
              <label className="relationship-label">ADO organization/project URL</label>
              <input
                type="text"
                className="relationship-input"
                placeholder="https://dev.azure.com/org/project"
                value={projectUrl}
                onChange={(e) => onProjectUrlChange(e.target.value)}
              />
              <div className="integration-settings__hint">
                Example: https://dev.azure.com/my-org/my-project
              </div>
            </div>

            <div className="relationship-group">
              <label className="relationship-label">Area path (optional)</label>
              <input
                type="text"
                className="relationship-input"
                placeholder="Project\\Area"
                value={areaPath}
                onChange={(e) => onAreaPathChange(e.target.value)}
              />
            </div>

            <div className="relationship-group">
              <label className="relationship-label">Iteration path (optional)</label>
              <input
                type="text"
                className="relationship-input"
                placeholder="Project\\Iteration"
                value={iterationPath}
                onChange={(e) => onIterationPathChange(e.target.value)}
              />
            </div>

            <div className="relationship-group">
              <label className="relationship-label">Import limit</label>
              <input
                type="number"
                min="1"
                className="relationship-input"
                value={importLimit}
                onChange={(e) => onImportLimitChange(e.target.value)}
              />
            </div>

            <div className="relationship-group">
              <label className="relationship-label">Personal access token</label>
              <input
                type="password"
                className="relationship-input"
                placeholder={tokenSet ? 'Token already saved' : 'Enter token'}
                value={tokenInput}
                onChange={(e) => onTokenInputChange(e.target.value)}
              />
              <div className="integration-settings__status">
                {tokenSet ? 'Token is configured' : 'Token not set'}
              </div>
            </div>
          </>
        )}

        <div className="integration-settings__actions">
          <button className="action-btn" onClick={onSave}>
            💾 Save settings
          </button>
          {isAdo && (
            <>
              <button className="action-btn" onClick={onImport} disabled={!adoReady}>
                ⬇️ Import from ADO
              </button>
              <button className="action-btn" onClick={onExport} disabled={!adoReady}>
                ⬆️ Export to ADO
              </button>
            </>
          )}
          <button className="clear-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntegrationSettingsPanel;
