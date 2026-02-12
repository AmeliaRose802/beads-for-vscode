/**
 * Handle incoming messages from the VS Code extension.
 *
 * @param {any} message - Message payload from the extension.
 * @param {object} ctx - Context callbacks and helpers.
 */
function processMessage(message, ctx) {
  switch (message.type) {
    case 'commandResultJSON': {
      const parsed = ctx.parseListJSON(message.output, message.command);
      if (parsed.type === 'error') {
        ctx.setOutput(parsed.message);
        ctx.setIsError(true);
      } else {
        ctx.setOutput(parsed);
        ctx.setIsError(false);
      }
      break;
    }
    case 'commandResult':
      ctx.displayResult(message.command, message.output, message.success);
      break;
    case 'inlineActionResult':
      ctx.handleInlineActionResult(message);
      break;
    case 'cwdResult':
      ctx.setCwd(message.cwd);
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
        ctx.setIsSuccess(true);
        setTimeout(() => ctx.setIsSuccess(false), 3000);
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
        if (purpose === 'graph') {
          ctx.setShowDependencyGraph(true);
        }
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
      }
      if (message.error) {
        ctx.setOutput(`Graph Error: ${message.error}`);
        ctx.setIsError(true);
      }
      ctx.updateGraphPurpose(null);
      break;
    }
    default:
      break;
  }
}

module.exports = { processMessage };
