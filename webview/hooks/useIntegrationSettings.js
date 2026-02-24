import { useCallback, useState } from 'react';

export function useIntegrationSettings({
  vscode,
  beginCommandProgress,
  setOutput,
  setIsError,
  setIsSuccess
}) {
  const [integrationSettings, setIntegrationSettings] = useState({
    backend: 'github',
    ado: { projectUrl: '', areaPath: '', iterationPath: '', importLimit: '200', tokenSet: false }
  });
  const [adoTokenInput, setAdoTokenInput] = useState('');

  const applyIntegrationSettings = useCallback((settings) => {
    if (!settings) return;
    setIntegrationSettings(settings);
    setAdoTokenInput('');
  }, []);

  const handleSaveIntegrationSettings = useCallback(() => {
    const commandKey = 'saveIntegrationSettings';
    beginCommandProgress(commandKey, 'inline');
    setOutput('💾 Saving integration settings...');
    setIsError(false);
    setIsSuccess(false);
    const rawLimit = parseInt(integrationSettings.ado.importLimit, 10);
    const importLimit = Number.isFinite(rawLimit) ? rawLimit : 200;
    const settingsPayload = {
      backend: integrationSettings.backend,
      ado: {
        projectUrl: integrationSettings.ado.projectUrl,
        areaPath: integrationSettings.ado.areaPath,
        iterationPath: integrationSettings.ado.iterationPath,
        importLimit
      }
    };
    if (adoTokenInput.trim()) {
      settingsPayload.ado.pat = adoTokenInput.trim();
    }
    vscode.postMessage({ type: 'updateIntegrationSettings', settings: settingsPayload, commandKey });
  }, [
    adoTokenInput,
    beginCommandProgress,
    integrationSettings,
    setIsError,
    setIsSuccess,
    setOutput,
    vscode
  ]);

  const handleAdoImport = useCallback(() => {
    const commandKey = 'adoImport';
    beginCommandProgress(commandKey, 'inline');
    setOutput('⬇️ Importing from Azure DevOps...');
    setIsError(false);
    setIsSuccess(false);
    vscode.postMessage({ type: 'adoImport', commandKey });
  }, [beginCommandProgress, setIsError, setIsSuccess, setOutput, vscode]);

  const handleAdoExport = useCallback(() => {
    const commandKey = 'adoExport';
    beginCommandProgress(commandKey, 'inline');
    setOutput('⬆️ Exporting to Azure DevOps...');
    setIsError(false);
    setIsSuccess(false);
    vscode.postMessage({ type: 'adoExport', commandKey });
  }, [beginCommandProgress, setIsError, setIsSuccess, setOutput, vscode]);

  return {
    integrationSettings,
    adoTokenInput,
    setAdoTokenInput,
    setIntegrationSettings,
    applyIntegrationSettings,
    handleSaveIntegrationSettings,
    handleAdoImport,
    handleAdoExport
  };
}
