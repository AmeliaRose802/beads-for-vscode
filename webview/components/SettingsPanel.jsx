const React = require('react');

/**
 * SettingsPanel - Backend configuration panel for GitHub vs Azure DevOps
 */
const SettingsPanel = ({
  backendType,
  adoOrgUrl,
  adoIterationPath,
  adoAreaPath,
  onBackendTypeChange,
  onAdoOrgUrlChange,
  onAdoIterationPathChange,
  onAdoAreaPathChange,
  onSave,
  onCancel,
  onImportFromADO,
  onExportToADO
}) => {
  const isADO = backendType === 'ado';

  return (
    <div className="section settings-section">
      <div className="section-title">⚙️ Settings</div>
      <div className="settings-content">
        
        {/* Backend Selection */}
        <div className="settings-group">
          <label className="settings-label">Project Backend</label>
          <div className="settings-radio-group">
            <label className="settings-radio-label">
              <input
                type="radio"
                name="backend"
                value="github"
                checked={backendType === 'github'}
                onChange={(e) => onBackendTypeChange(e.target.value)}
                className="settings-radio"
              />
              <span className="settings-radio-text">GitHub</span>
            </label>
            <label className="settings-radio-label">
              <input
                type="radio"
                name="backend"
                value="ado"
                checked={backendType === 'ado'}
                onChange={(e) => onBackendTypeChange(e.target.value)}
                className="settings-radio"
              />
              <span className="settings-radio-text">Azure DevOps</span>
            </label>
          </div>
        </div>

        {/* GitHub Mode - No Additional Config */}
        {!isADO && (
          <div className="settings-info-box">
            <p className="settings-info-text">
              ℹ️ GitHub mode uses existing repository configuration. No additional settings required.
            </p>
          </div>
        )}

        {/* Azure DevOps Mode - Configuration Fields */}
        {isADO && (
          <>
            <div className="settings-group">
              <label className="settings-label">Organization/Project URL *</label>
              <input
                type="text"
                className="settings-input"
                placeholder="https://dev.azure.com/org/project"
                value={adoOrgUrl}
                onChange={(e) => onAdoOrgUrlChange(e.target.value)}
              />
              <span className="settings-help-text">
                Example: https://dev.azure.com/myorg/myproject
              </span>
            </div>

            <div className="settings-group">
              <label className="settings-label">Iteration Path</label>
              <input
                type="text"
                className="settings-input"
                placeholder="MyProject\\Sprint 1"
                value={adoIterationPath}
                onChange={(e) => onAdoIterationPathChange(e.target.value)}
              />
              <span className="settings-help-text">
                Optional: Iteration path for work items (e.g., Project\\Sprint 1)
              </span>
            </div>

            <div className="settings-group">
              <label className="settings-label">Area Path</label>
              <input
                type="text"
                className="settings-input"
                placeholder="MyProject\\Team"
                value={adoAreaPath}
                onChange={(e) => onAdoAreaPathChange(e.target.value)}
              />
              <span className="settings-help-text">
                Optional: Area path for work items (e.g., Project\\Team)
              </span>
            </div>

            {/* Import/Export Actions */}
            <div className="settings-ado-actions">
              <button 
                className="action-btn settings-ado-btn"
                onClick={onImportFromADO}
                disabled={!adoOrgUrl.trim()}
                title="Pull Azure DevOps work items into beads as issues"
              >
                ⬇️ Import from ADO
              </button>
              <button 
                className="action-btn settings-ado-btn"
                onClick={onExportToADO}
                disabled={!adoOrgUrl.trim()}
                title="Push beads issues to Azure DevOps as work items"
              >
                ⬆️ Export to ADO
              </button>
            </div>
          </>
        )}

        {/* Save/Cancel Actions */}
        <div className="settings-actions">
          <button className="action-btn" onClick={onSave}>
            💾 Save
          </button>
          <button className="action-btn secondary-btn" onClick={onCancel}>
            ❌ Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

module.exports = SettingsPanel;
