const { safeShellArg, buildCreateCommand, buildUpdateCommand } = require('./webview/form-handlers');
const { ISSUE_ID_PATTERN } = require('./validate-issue-id');
const {
  parseAdoProjectUrl,
  queryAdoWorkItemIds,
  fetchAdoWorkItems,
  createAdoWorkItem,
  updateAdoWorkItem
} = require('./ado-client');
const {
  extractAdoIdLabel,
  extractBeadsIdFromOutput,
  mapBeadsTypeToAdoType,
  mapAdoTypeToBeadsType,
  mapBeadsPriorityToAdoPriority,
  mapAdoPriorityToBeadsPriority,
  mapBeadsStatusToAdoState,
  mapAdoStateToBeadsStatus,
  buildAdoPatchFromBeads,
  buildBeadsUpdateFromAdoItem
} = require('./ado-mapping');

const DEFAULT_IMPORT_LIMIT = 200;
const ADO_LABEL_PREFIX = 'ado:';

/**
 * Validate ADO settings for sync.
 * @param {{ projectUrl?: string, pat?: string }} adoSettings
 */
function validateAdoSettings(adoSettings) {
  if (!adoSettings?.projectUrl) {
    throw new Error('ADO project URL is required.');
  }
  if (!adoSettings?.pat) {
    throw new Error('ADO personal access token is required.');
  }
}

/**
 * Find a beads issue ID by title using bd list.
 * @param {Function} executeBdCommand - Command executor
 * @param {string} title - Issue title to search
 * @returns {Promise<string|null>} Found issue ID or null
 */
async function findBeadsIdByTitle(executeBdCommand, title) {
  if (!title) return null;
  const command = `list --title ${safeShellArg(title)} --json --limit 1 --sort updated --reverse`;
  const result = await executeBdCommand(command);
  if (!result.success) return null;
  try {
    const parsed = JSON.parse(result.output);
    if (Array.isArray(parsed) && parsed[0]?.id && ISSUE_ID_PATTERN.test(parsed[0].id)) {
      return parsed[0].id;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Import ADO work items into beads.
 * @param {{ executeBdCommand: Function, settings: object }} context
 * @returns {Promise<{ created: number, updated: number, failed: number, warnings: string[], errors: string[] }>}
 */
async function importAdoToBeads(context) {
  const { executeBdCommand, settings } = context || {};
  const ado = settings?.ado || {};
  validateAdoSettings(ado);

  const { baseUrl, project } = parseAdoProjectUrl(ado.projectUrl);
  const workItemIds = await queryAdoWorkItemIds({
    baseUrl,
    project,
    pat: ado.pat,
    areaPath: ado.areaPath,
    iterationPath: ado.iterationPath,
    limit: ado.importLimit || DEFAULT_IMPORT_LIMIT
  });

  const workItems = await fetchAdoWorkItems({
    baseUrl,
    pat: ado.pat,
    ids: workItemIds
  });

  const listResult = await executeBdCommand('list --json --limit 0');
  if (!listResult.success) {
    throw new Error(`Failed to list beads issues: ${listResult.output || 'Unknown error'}`);
  }

  let beadsItems;
  try {
    beadsItems = JSON.parse(listResult.output) || [];
  } catch (error) {
    throw new Error(`Failed to parse beads issues: ${error.message}`);
  }

  const adoToBeads = new Map();
  beadsItems.forEach((item) => {
    const adoId = extractAdoIdLabel(item.labels);
    if (adoId) {
      adoToBeads.set(String(adoId), item.id);
    }
  });

  const summary = { created: 0, updated: 0, failed: 0, warnings: [], errors: [] };

  for (const workItem of workItems) {
    const adoId = String(workItem.id);
    try {
      const updateFields = buildBeadsUpdateFromAdoItem(workItem);
      if (!updateFields.title) {
        throw new Error(`ADO work item ${adoId} missing title`);
      }

      const existingBeadsId = adoToBeads.get(adoId);
      if (existingBeadsId) {
        const updateCmd = buildUpdateCommand({
          issueId: existingBeadsId,
          ...updateFields
        });
        const updateResult = await executeBdCommand(updateCmd);
        if (!updateResult.success) {
          throw new Error(updateResult.output || 'bd update failed');
        }
        summary.updated += 1;
      } else {
        const createCmd = buildCreateCommand({
          title: updateFields.title,
          type: updateFields.type,
          priority: updateFields.priority,
          description: updateFields.description,
          parentId: '',
          blocksId: '',
          relatedId: '',
          currentFile: ''
        });
        if (!createCmd) {
          throw new Error(`Failed to build create command for ADO ${adoId}`);
        }
        const createResult = await executeBdCommand(createCmd);
        if (!createResult.success) {
          throw new Error(createResult.output || 'bd create failed');
        }
        summary.created += 1;

        const newBeadsId =
          extractBeadsIdFromOutput(createResult.output) ||
          await findBeadsIdByTitle(executeBdCommand, updateFields.title);
        if (newBeadsId) {
          const labelCmd = `label add ${newBeadsId} ${safeShellArg(`${ADO_LABEL_PREFIX}${adoId}`)}`;
          const labelResult = await executeBdCommand(labelCmd);
          if (!labelResult.success) {
            summary.warnings.push(`Failed to label ${newBeadsId} with ADO ID ${adoId}`);
          }
        } else {
          summary.warnings.push(`Created issue for ADO ${adoId} but could not detect beads ID.`);
        }
      }
    } catch (error) {
      summary.failed += 1;
      summary.errors.push(`${adoId}: ${error.message}`);
    }
  }

  return summary;
}

/**
 * Export beads issues to Azure DevOps.
 * @param {{ executeBdCommand: Function, settings: object }} context
 * @returns {Promise<{ created: number, updated: number, failed: number, warnings: string[], errors: string[] }>}
 */
async function exportBeadsToAdo(context) {
  const { executeBdCommand, settings } = context || {};
  const ado = settings?.ado || {};
  validateAdoSettings(ado);

  const { baseUrl } = parseAdoProjectUrl(ado.projectUrl);
  const listResult = await executeBdCommand('list --json --limit 0');
  if (!listResult.success) {
    throw new Error(`Failed to list beads issues: ${listResult.output || 'Unknown error'}`);
  }

  let beadsItems;
  try {
    beadsItems = JSON.parse(listResult.output) || [];
  } catch (error) {
    throw new Error(`Failed to parse beads issues: ${error.message}`);
  }

  const summary = { created: 0, updated: 0, failed: 0, warnings: [], errors: [] };

  for (const item of beadsItems) {
    if (!item?.id) continue;
    try {
      const adoId = extractAdoIdLabel(item.labels);
      if (adoId) {
        const patch = buildAdoPatchFromBeads(item, { operation: 'replace', includeTags: false });
        await updateAdoWorkItem({ baseUrl, pat: ado.pat, id: adoId, patch });
        summary.updated += 1;
      } else {
        const workItemType = mapBeadsTypeToAdoType(item.issue_type || item.type);
        const patch = buildAdoPatchFromBeads(item, { operation: 'add', includeTags: true });
        const created = await createAdoWorkItem({
          baseUrl,
          pat: ado.pat,
          type: workItemType,
          patch
        });
        summary.created += 1;

        const labelCmd = `label add ${item.id} ${safeShellArg(`${ADO_LABEL_PREFIX}${created.id}`)}`;
        const labelResult = await executeBdCommand(labelCmd);
        if (!labelResult.success) {
          summary.warnings.push(`Failed to label ${item.id} with ADO ID ${created.id}`);
        }
      }
    } catch (error) {
      summary.failed += 1;
      summary.errors.push(`${item.id}: ${error.message}`);
    }
  }

  return summary;
}

module.exports = {
  parseAdoProjectUrl,
  extractAdoIdLabel,
  extractBeadsIdFromOutput,
  mapBeadsTypeToAdoType,
  mapAdoTypeToBeadsType,
  mapBeadsPriorityToAdoPriority,
  mapAdoPriorityToBeadsPriority,
  mapBeadsStatusToAdoState,
  mapAdoStateToBeadsStatus,
  buildAdoPatchFromBeads,
  buildBeadsUpdateFromAdoItem,
  importAdoToBeads,
  exportBeadsToAdo
};
