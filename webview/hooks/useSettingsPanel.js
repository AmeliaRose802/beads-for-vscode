const { useState } = require('react');

/**
 * Hook for managing settings panel state and handlers
 */
function useSettingsPanel(vscode) {
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [backendConfig, setBackendConfig] = useState({
    backendType: 'github',
    adoOrgUrl: '',
    adoIterationPath: '',
    adoAreaPath: ''
  });

  const handleSaveSettings = () => {
    vscode.postMessage({
      type: 'saveBackendConfig',
      config: backendConfig
    });
    setShowSettingsPanel(false);
    return {
      message: '✅ Settings saved successfully',
      isSuccess: true,
      isError: false
    };
  };

  const handleCancelSettings = () => {
    // Reload config from extension to discard changes
    vscode.postMessage({ type: 'getBackendConfig' });
    setShowSettingsPanel(false);
  };

  const handleImportFromADO = () => {
    vscode.postMessage({ type: 'importFromADO', config: backendConfig });
    return {
      message: '⏳ Importing from Azure DevOps...',
      isError: false
    };
  };

  const handleExportToADO = () => {
    vscode.postMessage({ type: 'exportToADO', config: backendConfig });
    return {
      message: '⏳ Exporting to Azure DevOps...',
      isError: false
    };
  };

  const toggleSettingsPanel = () => {
    setShowSettingsPanel(!showSettingsPanel);
  };

  return {
    showSettingsPanel,
    backendConfig,
    setShowSettingsPanel,
    setBackendConfig,
    handleSaveSettings,
    handleCancelSettings,
    handleImportFromADO,
    handleExportToADO,
    toggleSettingsPanel
  };
}

module.exports = { useSettingsPanel };
