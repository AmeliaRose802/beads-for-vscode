const { ISSUE_ID_PATTERN } = require('./validate-issue-id');

const ADO_LABEL_PREFIX = 'ado:';

/**
 * Extract an ADO work item ID label from a beads label list.
 * @param {string[]|null|undefined} labels - Beads labels array
 * @returns {string|null} ADO ID if found
 */
function extractAdoIdLabel(labels) {
  if (!Array.isArray(labels)) return null;
  for (const label of labels) {
    if (typeof label !== 'string') continue;
    const match = label.trim().match(/^ado:(\d+)$/i);
    if (match) {
      return match[1];
    }
  }
  return null;
}

/**
 * Extract a beads issue ID from CLI output.
 * @param {string} output - bd command output
 * @returns {string|null} Issue ID if found
 */
function extractBeadsIdFromOutput(output) {
  if (!output || typeof output !== 'string') return null;

  try {
    const parsed = JSON.parse(output);
    if (parsed && typeof parsed === 'object') {
      if (parsed.id && ISSUE_ID_PATTERN.test(parsed.id)) {
        return parsed.id;
      }
      if (Array.isArray(parsed) && parsed[0]?.id && ISSUE_ID_PATTERN.test(parsed[0].id)) {
        return parsed[0].id;
      }
    }
  } catch {
    // Non-JSON output; fall through to regex extraction.
  }

  const matches = output.match(/[A-Za-z0-9_]+-[A-Za-z0-9]+/g);
  if (!matches) return null;
  return matches.find((candidate) => ISSUE_ID_PATTERN.test(candidate)) || null;
}

/**
 * Map beads issue type to an ADO work item type.
 * @param {string} type - Beads issue type
 * @returns {string} ADO work item type
 */
function mapBeadsTypeToAdoType(type) {
  const normalized = (type || '').toLowerCase();
  const map = {
    bug: 'Bug',
    feature: 'User Story',
    epic: 'Epic',
    task: 'Task',
    chore: 'Task'
  };
  return map[normalized] || 'Task';
}

/**
 * Map ADO work item type to a beads issue type.
 * @param {string} type - ADO work item type
 * @returns {string} Beads issue type
 */
function mapAdoTypeToBeadsType(type) {
  const normalized = (type || '').toLowerCase();
  const map = {
    bug: 'bug',
    'user story': 'feature',
    feature: 'feature',
    epic: 'epic',
    task: 'task'
  };
  return map[normalized] || 'task';
}

/**
 * Map beads priority (0-4) to an ADO priority (1-4).
 * @param {number|string|null|undefined} priority - Beads priority
 * @returns {number} ADO priority
 */
function mapBeadsPriorityToAdoPriority(priority) {
  const raw = typeof priority === 'string' ? priority.replace(/^p/i, '') : priority;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return 2;
  return Math.min(4, Math.max(1, parsed + 1));
}

/**
 * Map ADO priority (1-4) to beads priority (0-4).
 * @param {number|string|null|undefined} priority - ADO priority
 * @returns {number} Beads priority
 */
function mapAdoPriorityToBeadsPriority(priority) {
  const parsed = Number.parseInt(priority, 10);
  if (!Number.isFinite(parsed)) return 2;
  return Math.min(4, Math.max(0, parsed - 1));
}

/**
 * Map beads status to ADO state string.
 * @param {string} status - Beads status
 * @returns {string} ADO state
 */
function mapBeadsStatusToAdoState(status) {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'closed' || normalized === 'done') return 'Closed';
  if (normalized === 'in_progress') return 'Active';
  if (normalized === 'blocked') return 'Active';
  return 'New';
}

/**
 * Map ADO work item state to beads status.
 * @param {string} state - ADO state
 * @returns {string} Beads status
 */
function mapAdoStateToBeadsStatus(state) {
  const normalized = (state || '').toLowerCase();
  if (normalized.includes('closed') || normalized.includes('done') || normalized.includes('resolved')) {
    return 'closed';
  }
  if (normalized.includes('active') || normalized.includes('in progress')) {
    return 'in_progress';
  }
  return 'open';
}

/**
 * Build ADO tag list from beads labels.
 * @param {object} item - Beads issue item
 * @returns {string[]} Tag list for ADO
 */
function buildAdoTagsFromBeads(item) {
  const labels = Array.isArray(item?.labels) ? item.labels : [];
  const cleaned = labels
    .filter((label) => typeof label === 'string')
    .map((label) => label.trim())
    .filter((label) => label && !label.toLowerCase().startsWith(ADO_LABEL_PREFIX));

  const tags = new Set(cleaned);
  tags.add('beads');
  if (item?.id) {
    tags.add(`beads-id:${item.id}`);
  }

  return [...tags];
}

/**
 * Build a JSON Patch document for ADO work item create/update.
 * @param {object} item - Beads issue item
 * @param {{ operation?: 'add'|'replace', includeTags?: boolean }} [options] - Patch options
 * @returns {Array} JSON Patch operations
 */
function buildAdoPatchFromBeads(item, options = {}) {
  const { operation = 'add', includeTags = false } = options;
  const ops = [];

  if (!item?.title) {
    throw new Error('Beads item title is required for ADO export.');
  }

  ops.push({ op: operation, path: '/fields/System.Title', value: item.title });

  if (item.description) {
    ops.push({ op: operation, path: '/fields/System.Description', value: item.description });
  }

  if (item.priority != null) {
    ops.push({
      op: operation,
      path: '/fields/Microsoft.VSTS.Common.Priority',
      value: mapBeadsPriorityToAdoPriority(item.priority)
    });
  }

  if (item.assignee) {
    ops.push({ op: operation, path: '/fields/System.AssignedTo', value: item.assignee });
  }

  if (includeTags) {
    const tags = buildAdoTagsFromBeads(item);
    if (tags.length > 0) {
      ops.push({
        op: operation,
        path: '/fields/System.Tags',
        value: tags.join('; ')
      });
    }
  }

  ops.push({
    op: operation,
    path: '/fields/System.State',
    value: mapBeadsStatusToAdoState(item.status)
  });

  return ops;
}

/**
 * Build a beads update payload from an ADO work item.
 * @param {object} adoItem - ADO work item payload
 * @returns {{ title: string, description: string, type: string, priority: string, status: string }}
 */
function buildBeadsUpdateFromAdoItem(adoItem) {
  const fields = adoItem?.fields || {};
  const title = fields['System.Title'] || `ADO ${adoItem?.id || ''}`.trim();
  const description = fields['System.Description'] || '';
  const type = mapAdoTypeToBeadsType(fields['System.WorkItemType']);
  const priority = String(mapAdoPriorityToBeadsPriority(fields['Microsoft.VSTS.Common.Priority']));
  const status = mapAdoStateToBeadsStatus(fields['System.State']);

  return { title, description, type, priority, status };
}

module.exports = {
  extractAdoIdLabel,
  extractBeadsIdFromOutput,
  mapBeadsTypeToAdoType,
  mapAdoTypeToBeadsType,
  mapBeadsPriorityToAdoPriority,
  mapAdoPriorityToBeadsPriority,
  mapBeadsStatusToAdoState,
  mapAdoStateToBeadsStatus,
  buildAdoTagsFromBeads,
  buildAdoPatchFromBeads,
  buildBeadsUpdateFromAdoItem
};
