const ADO_API_VERSION = '7.1';
const ADO_API_PREVIEW_VERSION = '7.1-preview.3';

/**
 * Parse an Azure DevOps organization/project URL into identifiers and base API URL.
 * @param {string} input - ADO project URL (dev.azure.com or visualstudio.com format)
 * @returns {{ organization: string, project: string, baseUrl: string }}
 */
function parseAdoProjectUrl(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('ADO project URL is required.');
  }

  let parsed;
  try {
    parsed = new URL(input.includes('://') ? input : `https://${input}`);
  } catch {
    throw new Error('ADO project URL is invalid.');
  }

  const host = parsed.hostname.toLowerCase();
  const parts = parsed.pathname.split('/').filter(Boolean);
  let organization = '';
  let project = '';

  if (host.endsWith('dev.azure.com')) {
    organization = parts[0] || '';
    project = parts[1] || '';
  } else if (host.endsWith('.visualstudio.com')) {
    organization = host.split('.')[0] || '';
    if (parts[0] === 'DefaultCollection') {
      project = parts[1] || '';
    } else {
      project = parts[0] || '';
    }
  }

  if (!organization || !project) {
    throw new Error('ADO project URL must include organization and project.');
  }

  return {
    organization,
    project,
    baseUrl: `https://dev.azure.com/${organization}/${project}`
  };
}

/**
 * Escape a WIQL string literal by doubling single quotes.
 * @param {string} value - Raw WIQL literal value
 * @returns {string} Escaped WIQL literal
 */
function escapeWiqlLiteral(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/'/g, "''");
}

/**
 * Build the ADO auth header for a personal access token.
 * @param {string} pat - Personal access token
 * @returns {string} Authorization header value
 */
function buildAdoAuthHeader(pat) {
  if (!pat || typeof pat !== 'string') {
    throw new Error('ADO personal access token is required.');
  }
  const token = Buffer.from(`:${pat}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

/**
 * Make a request to the Azure DevOps REST API.
 * @param {string} url - Full request URL
 * @param {{ method?: string, pat: string, headers?: Record<string, string>, body?: any }} options - Request options
 * @returns {Promise<any>} Parsed JSON response
 */
async function adoApiRequest(url, options) {
  const { method = 'GET', pat, headers = {}, body } = options || {};
  const authHeader = buildAdoAuthHeader(pat);

  const requestHeaders = {
    Accept: 'application/json',
    Authorization: authHeader,
    ...headers
  };

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  if (!response.ok) {
    let message = text || response.statusText;
    try {
      const parsed = text ? JSON.parse(text) : null;
      message = parsed?.message || parsed?.error?.message || message;
    } catch {
      // Keep raw text if JSON parsing fails
    }
    if (response.status === 401) {
      throw new Error('ADO authentication failed. Check your personal access token.');
    }
    throw new Error(`ADO API error (${response.status}): ${message}`);
  }

  return text ? JSON.parse(text) : {};
}

/**
 * Query ADO for work item IDs.
 * @param {{ baseUrl: string, project: string, pat: string, areaPath?: string, iterationPath?: string, limit?: number }} settings
 * @returns {Promise<number[]>} Work item IDs
 */
async function queryAdoWorkItemIds(settings) {
  const {
    baseUrl,
    project,
    pat,
    areaPath = '',
    iterationPath = '',
    limit
  } = settings;

  const clauses = [`[System.TeamProject] = '${escapeWiqlLiteral(project)}'`];
  if (areaPath) {
    clauses.push(`[System.AreaPath] UNDER '${escapeWiqlLiteral(areaPath)}'`);
  }
  if (iterationPath) {
    clauses.push(`[System.IterationPath] UNDER '${escapeWiqlLiteral(iterationPath)}'`);
  }

  const topClause = limit ? `TOP ${limit}` : '';
  const query = `SELECT ${topClause} [System.Id] FROM WorkItems WHERE ${clauses.join(' AND ')} ORDER BY [System.ChangedDate] DESC`;
  const url = `${baseUrl}/_apis/wit/wiql?api-version=${ADO_API_VERSION}`;
  const result = await adoApiRequest(url, { method: 'POST', pat, body: { query } });

  return Array.isArray(result?.workItems) ? result.workItems.map((item) => item.id) : [];
}

/**
 * Fetch ADO work item details by ID list.
 * @param {{ baseUrl: string, pat: string, ids: number[] }} settings
 * @returns {Promise<object[]>} Work items
 */
async function fetchAdoWorkItems(settings) {
  const { baseUrl, pat, ids } = settings;
  if (!Array.isArray(ids) || ids.length === 0) return [];

  const fields = [
    'System.Id',
    'System.Title',
    'System.Description',
    'System.State',
    'System.WorkItemType',
    'System.AssignedTo',
    'System.Tags',
    'Microsoft.VSTS.Common.Priority'
  ];

  const batchSize = 200;
  const results = [];

  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    const url = `${baseUrl}/_apis/wit/workitems?ids=${chunk.join(',')}&fields=${encodeURIComponent(fields.join(','))}&api-version=${ADO_API_VERSION}`;
    const response = await adoApiRequest(url, { pat });
    if (Array.isArray(response?.value)) {
      results.push(...response.value);
    }
  }

  return results;
}

/**
 * Create an ADO work item.
 * @param {{ baseUrl: string, pat: string, type: string, patch: Array }} options
 * @returns {Promise<{ id: number, url: string }>}
 */
async function createAdoWorkItem(options) {
  const { baseUrl, pat, type, patch } = options;
  const url = `${baseUrl}/_apis/wit/workitems/$${encodeURIComponent(type)}?api-version=${ADO_API_PREVIEW_VERSION}`;
  const response = await adoApiRequest(url, {
    method: 'POST',
    pat,
    headers: { 'Content-Type': 'application/json-patch+json' },
    body: patch
  });

  return { id: response.id, url: response.url };
}

/**
 * Update an existing ADO work item.
 * @param {{ baseUrl: string, pat: string, id: string|number, patch: Array }} options
 * @returns {Promise<void>}
 */
async function updateAdoWorkItem(options) {
  const { baseUrl, pat, id, patch } = options;
  const url = `${baseUrl}/_apis/wit/workitems/${encodeURIComponent(id)}?api-version=${ADO_API_PREVIEW_VERSION}`;
  await adoApiRequest(url, {
    method: 'PATCH',
    pat,
    headers: { 'Content-Type': 'application/json-patch+json' },
    body: patch
  });
}

module.exports = {
  parseAdoProjectUrl,
  escapeWiqlLiteral,
  buildAdoAuthHeader,
  adoApiRequest,
  queryAdoWorkItemIds,
  fetchAdoWorkItems,
  createAdoWorkItem,
  updateAdoWorkItem
};
