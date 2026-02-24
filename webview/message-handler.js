/**
 * Handle incoming messages from the VS Code extension.
 *
 * @param {any} message - Message payload from the extension.
 * @param {object} ctx - Context callbacks and helpers.
 */
function processMessage(message, ctx) {
  /** Flash the success indicator for 3 seconds. */
  const flashSuccess = () => {
    ctx.setIsSuccess(true);
    setTimeout(() => ctx.setIsSuccess(false), 3000);
  };

  switch (message.type) {
    case 'commandResultJSON': {
      const parsed = ctx.parseListJSON(message.output, message.command, message.graphData);
      if (message.graphError) {
        console.error('Graph data unavailable:', message.graphError);
      }
      if (parsed.type === 'error') {
        ctx.setOutput(parsed.message);
        ctx.setIsError(true);
      } else {
        ctx.setOutput(parsed);
        ctx.setIsError(false);
        if (ctx.cachePageResult) {
          ctx.cachePageResult(message.command, parsed);
        }
      }
      if (ctx.completeCommandProgress) {
        ctx.completeCommandProgress(message.command);
      }
      break;
    }
    case 'commandResult':
      ctx.displayResult(message.command, message.output, message.success, {
        requestId: message.requestId,
        isBackgroundSync: message.isBackgroundSync
      });
      break;
    case 'inlineActionResult':
      ctx.handleInlineActionResult(message);
      if (message.success && typeof message.command === 'string' && message.command.trim().startsWith('init') && ctx.vscode) {
        ctx.vscode.postMessage({ type: 'getBeadsStatus' });
      }
      break;
    case 'cwdResult':
      ctx.setCwd(message.cwd);
      break;
    case 'beadsStatus':
      if (ctx.setBeadsStatus) {
        ctx.setBeadsStatus(message);
      }
      break;
    case 'currentFileResult':
      ctx.setCurrentFile(message.file || '');
      break;
    case 'issueDetails':
      if (message.issue) {
        ctx.setEditTitle(message.issue.title || '');
        ctx.setEditType(message.issue.issue_type || 'task');
        ctx.setEditPriority(String(message.issue.priority || '2'));
        ctx.setEditDescription(message.issue.description || '');
        ctx.setEditStatus(message.issue.status || 'open');
      }
      break;
    case 'aiSuggestions':
      ctx.setIsAILoading(false);
      if (message.suggestions) {
        const { type, priority, description, links } = message.suggestions;
        if (type) ctx.setCreateType(type);
        if (priority !== undefined) ctx.setCreatePriority(String(priority));

        let parentId = '';
        let blocksId = '';
        let relatedId = '';

        if (links) {
          const parentMatch = links.match(/--parent\s+([\w-]+)/);
          const blocksMatch = links.match(/--blocks\s+([\w-]+)/);
          const relatedMatch = links.match(/--related\s+([\w-]+)/);

          if (parentMatch) parentId = parentMatch[1];
          if (blocksMatch) blocksId = blocksMatch[1];
          if (relatedMatch) relatedId = relatedMatch[1];
        }

        ctx.setCreateParentId(parentId);
        ctx.setCreateBlocksId(blocksId);
        ctx.setCreateRelatedId(relatedId);

        let suggestionMessage = `💡 AI Suggestion: ${description}`;
        const linkCount = [parentId, blocksId, relatedId].filter(Boolean).length;
        if (linkCount > 0) {
          suggestionMessage += ` (${linkCount} relationship${linkCount > 1 ? 's' : ''} suggested)`;
        }
        ctx.setOutput(suggestionMessage);
        flashSuccess();
      }
      if (message.error) {
        ctx.setOutput(`AI Suggestion Error: ${message.error}`);
        ctx.setIsError(true);
      }
      break;
    case 'inlineIssueDetails':
      if (message.issueId && message.details) {
        ctx.setIssueDetails((prev) => ({
          ...prev,
          [message.issueId]: message.details
        }));
        ctx.setLoadingDetails((prev) => ({
          ...prev,
          [message.issueId]: false
        }));
      }
      break;
    case 'graphData': {
      const purpose = ctx.graphPurposeRef.current;
      const targetId = ctx.hierarchyIssueRef.current;

      if (message.data) {
        ctx.setGraphData(message.data);
        if (purpose === 'hierarchy' && targetId) {
          try {
            const model = ctx.buildHierarchyModel(targetId, message.data);
            ctx.setHierarchyModel(model);
            ctx.setShowHierarchyView(true);
          } catch (error) {
            ctx.setOutput(`Graph Error: ${error.message}`);
            ctx.setIsError(true);
            ctx.setShowHierarchyView(false);
          }
        }
        if (purpose === 'blocking') {
          try {
            const model = ctx.buildBlockingModel(message.data);
            ctx.setBlockingModel(model);
            ctx.setShowBlockingView(true);
          } catch (error) {
            ctx.setOutput(`Dependencies View Error: ${error.message}`);
            ctx.setIsError(true);
            ctx.setShowBlockingView(false);
          }
        }
      }
      if (message.error) {
        ctx.setOutput(`Graph Error: ${message.error}`);
        ctx.setIsError(true);
      }
      ctx.updateGraphPurpose(null);
      break;
    }
    case 'pokepokeStateChange': {
      if (ctx.setPokepokeInstances && ctx.vscode) {
        ctx.vscode.postMessage({ type: 'pokepokeGetStatus' });
      }
      if (message.state === 'failed' && ctx.setOutput) {
        const detail =
          message.error ||
          (typeof message.code === 'number'
            ? `PokePoke exited with code ${message.code}`
            : 'PokePoke exited unexpectedly');
        ctx.setOutput(`❌ PokePoke failed for ${message.itemId}: ${detail}`);
        ctx.setIsError && ctx.setIsError(true);
      } else if (message.state === 'completed' && ctx.setOutput) {
        ctx.setOutput(`✅ PokePoke completed for ${message.itemId}`);
        if (ctx.setIsSuccess) {
          flashSuccess();
        }
      }
      break;
    }
    case 'pokepokeStatus':
      if (ctx.setPokepokeInstances) {
        ctx.setPokepokeInstances(message.instances || []);
      }
      break;
    case 'pokepokeLaunchResult':
      if (!message.success && ctx.setOutput) {
        ctx.setOutput(`❌ PokePoke: ${message.error || 'Failed to launch'}`);
        ctx.setIsError(true);
      } else if (message.success && ctx.setOutput) {
        ctx.setOutput(`🤖 PokePoke launched for ${message.itemId}`);
        flashSuccess();
      }
      break;
    case 'pokepokeStopResult': {
      if (ctx.setOutput) {
        if (message.success) {
          ctx.setOutput(`🛑 PokePoke stopping for ${message.itemId}`);
          flashSuccess();
        } else {
          ctx.setOutput(`❌ ${message.error || 'Failed to stop PokePoke'}`);
          ctx.setIsError(true);
        }
      }
      break;
    }
    case 'githubInfo':
      if (ctx.setGitHubInfo) {
        ctx.setGitHubInfo({
          authenticated: message.authenticated,
          account: message.account || null,
          repo: message.repo || null,
          copilotAssignees: Array.isArray(message.copilotAssignees) ? message.copilotAssignees : undefined
        });
      }
      break;
    case 'integrationSettings':
      if (ctx.setIntegrationSettings && message.settings) {
        ctx.setIntegrationSettings(message.settings);
      }
      break;
    case 'integrationSettingsSaved': {
      if (message.commandKey && ctx.completeCommandProgress) {
        ctx.completeCommandProgress(message.commandKey);
      }
      if (!ctx.setOutput) {
        break;
      }
      if (message.success) {
        ctx.setOutput('✅ Integration settings saved.');
        ctx.setIsError(false);
        if (ctx.setIntegrationSettings && message.settings) {
          ctx.setIntegrationSettings(message.settings);
        }
        flashSuccess();
      } else {
        ctx.setOutput(`❌ Integration settings save failed: ${message.error || 'Unknown error'}`);
        ctx.setIsError(true);
      }
      break;
    }
    case 'adoSyncResult': {
      if (message.commandKey && ctx.completeCommandProgress) {
        ctx.completeCommandProgress(message.commandKey);
      }
      if (!ctx.setOutput) {
        break;
      }
      if (message.success) {
        const summary = message.summary || {};
        const created = summary.created || 0;
        const updated = summary.updated || 0;
        const failed = summary.failed || 0;
        const warnings = Array.isArray(summary.warnings) ? summary.warnings : [];
        const errors = Array.isArray(summary.errors) ? summary.errors : [];
        const label = message.action === 'export' ? 'ADO export' : 'ADO import';
        const detailParts = [`${created} created`, `${updated} updated`, `${failed} failed`];
        let output = `✅ ${label} complete: ${detailParts.join(', ')}.`;
        const limitedWarnings = warnings.slice(0, 5);
        const limitedErrors = errors.slice(0, 5);
        if (limitedWarnings.length > 0) {
          output += `\nWarnings:\n- ${limitedWarnings.join('\n- ')}`;
        }
        if (limitedErrors.length > 0) {
          output += `\nErrors:\n- ${limitedErrors.join('\n- ')}`;
        }
        ctx.setOutput(output);
        ctx.setIsError(false);
        flashSuccess();
      } else {
        const label = message.action === 'export' ? 'ADO export' : 'ADO import';
        ctx.setOutput(`❌ ${label} failed: ${message.error || 'Unknown error'}`);
        ctx.setIsError(true);
      }
      break;
    }
    case 'parallelPhaseDispatchStarted':
    case 'parallelPhaseDispatchProgress':
    case 'parallelPhaseDispatchError':
      if (ctx.handleParallelPhaseDispatch) {
        ctx.handleParallelPhaseDispatch(message);
      }
      break;
    case 'parallelPhaseDispatchComplete':
      if (ctx.handleParallelPhaseDispatch) {
        ctx.handleParallelPhaseDispatch(message);
      }
      if (ctx.trackBatchDispatch && Array.isArray(message.results)) {
        ctx.trackBatchDispatch(message.results);
      }
      break;
    case 'copilotDispatchResult': {
      if (message.commandKey && ctx.completeCommandProgress) {
        ctx.completeCommandProgress(message.commandKey);
      }
      if (!ctx.setOutput) {
        break;
      }
      if (message.success) {
        const urlDetail = message.url ? ` ${message.url}` : '';
        ctx.setOutput(`✅ Assigned to ${message.assignedTo || 'GitHub Copilot'} for ${message.issueId}.${urlDetail}`);
        ctx.setIsError(false);
        flashSuccess();
      } else {
        ctx.setOutput(`❌ Copilot dispatch failed: ${message.error || 'Unknown error'}`);
        ctx.setIsError(true);
      }
      break;
    }
    case 'githubConversionResult': {
      if (message.commandKey && ctx.completeCommandProgress) {
        ctx.completeCommandProgress(message.commandKey);
      }
      if (message.success && ctx.trackDispatch) {
        ctx.trackDispatch(message.issueId, message.url, message.number, null);
      }
      if (!ctx.setOutput) {
        break;
      }
      if (message.success) {
        const issueDetails = message.url ? ` ${message.url}` : '';
        ctx.setOutput(`✅ GitHub issue created for ${message.issueId}.${issueDetails}`);
        ctx.setIsError(false);
        flashSuccess();
      } else {
        ctx.setOutput(`❌ GitHub conversion failed: ${message.error || 'Unknown error'}`);
        ctx.setIsError(true);
      }
      break;
    }
    case 'agentStatusResult':
      if (message.success && ctx.updateAgentStatus) {
        ctx.updateAgentStatus(message.beadsItemId, {
          issueState: message.issueState,
          pr: message.pr
        });
      }
      break;
    default:
      break;
  }
}

module.exports = { processMessage };
