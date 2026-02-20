import { useCallback } from 'react';

export function useCopilotActions({
  vscode,
  gitHubInfo,
  beginCommandProgress,
  setOutput,
  setIsError,
  setIsSuccess
}) {
  const handleConvertToGitHub = useCallback((issueId) => {
    if (!issueId) {
      return;
    }
    const commandId = `convertToGitHub:${issueId}`;
    beginCommandProgress(commandId, 'inline');
    setOutput(`🐙 Converting ${issueId} to a GitHub issue...`);
    setIsError(false);
    setIsSuccess(false);
    vscode.postMessage({ type: 'convertToGitHub', issueId, commandKey: commandId });
  }, [beginCommandProgress, setOutput, setIsError, setIsSuccess, vscode]);

  const handleAssignToCopilot = useCallback((issueId) => {
    if (!issueId) {
      return;
    }
    if (!gitHubInfo || !gitHubInfo.authenticated || !gitHubInfo.repo) {
      setOutput('❌ GitHub authentication and repository detection are required to assign Copilot.');
      setIsError(true);
      setIsSuccess(false);
      vscode.postMessage({ type: 'getGitHubInfo' });
      return;
    }
    const commandId = `assignCopilot:${issueId}`;
    beginCommandProgress(commandId, 'inline');
    setOutput(`🤖 Assigning ${issueId} to GitHub Copilot...`);
    setIsError(false);
    setIsSuccess(false);
    vscode.postMessage({ type: 'assignToCopilot', issueId, commandKey: commandId });
  }, [beginCommandProgress, gitHubInfo, setOutput, setIsError, setIsSuccess, vscode]);

  return { handleConvertToGitHub, handleAssignToCopilot };
}
