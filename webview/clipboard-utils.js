/**
 * Produces a user-friendly title for clipboard output.
 * @param {string | undefined | null} title
 * @returns {string}
 */
function sanitizeTitle(title) {
  if (typeof title === 'string') {
    const trimmed = title.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return '(untitled)';
}

/**
 * Filters out invalid issue entries and ensures an array response.
 * @param {Array<{id?: string}> | null | undefined} issues
 * @returns {Array<{id: string}>}
 */
function normalizeIssues(issues) {
  if (!Array.isArray(issues)) {
    return [];
  }
  return issues.filter((issue) => issue && issue.id);
}

/**
 * Copies text to the clipboard with a DOM fallback.
 * @param {string} text
 * @returns {Promise<void>}
 */
async function copyTextToClipboard(text) {
  if (!text || !text.length) {
    throw new Error('No text to copy');
  }
  const root = typeof globalThis !== 'undefined' ? globalThis : {};
  if (root.navigator?.clipboard?.writeText) {
    await root.navigator.clipboard.writeText(text);
    return;
  }
  const doc = root.document;
  if (!doc) {
    throw new Error('Clipboard API unavailable');
  }
  const textarea = doc.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  doc.body.appendChild(textarea);
  textarea.select();
  try {
    const succeeded = doc.execCommand && doc.execCommand('copy');
    if (!succeeded) {
      throw new Error('Copy command rejected');
    }
  } finally {
    doc.body.removeChild(textarea);
  }
}

/**
 * Formats a list of issues into a numbered clipboard-friendly string.
 * @param {Array<{id: string, title?: string}>} issues
 * @param {{ header?: string, startIndex?: number }} options
 * @returns {string}
 */
function formatIssuesForClipboard(issues, options = {}) {
  const normalized = normalizeIssues(issues);
  const startIndex = typeof options.startIndex === 'number' ? options.startIndex : 1;
  const lines = [];

  if (options.header && normalized.length > 0) {
    lines.push(options.header);
  }

  normalized.forEach((issue, index) => {
    const title = sanitizeTitle(issue.title);
    lines.push(`${startIndex + index}. ${issue.id} - ${title}`);
  });

  return lines.join('\n');
}

/**
 * Formats multiple parallel groups/phases into clipboard text with section headers.
 * @param {Array<Array<{id: string, title?: string}>>} groups
 * @returns {string}
 */
function buildPhasedClipboardText(groups) {
  if (!Array.isArray(groups) || groups.length === 0) {
    return '';
  }

  const sections = groups
    .map((group, index) => {
      const formatted = formatIssuesForClipboard(group, { header: `Phase ${index + 1}` });
      return formatted.trim().length > 0 ? formatted : null;
    })
    .filter(Boolean);

  return sections.join('\n\n');
}

/**
 * Formats a plan schedule into clipboard text with wave information and stats.
 * @param {object} plan - Plan object with waves, totalWaves, totalItems, averageThroughput, capacity
 * @returns {string}
 */
function buildPlanClipboardText(plan) {
  if (!plan || !Array.isArray(plan.waves) || plan.waves.length === 0) {
    return 'No execution plan available - no open items to schedule.';
  }

  const { waves, totalWaves, totalItems, averageThroughput, capacity } = plan;
  
  // Header with summary stats
  const throughputLabel = totalWaves === 0 ? '0' : averageThroughput.toFixed(1);
  const lines = [
    `Execution Plan (${totalWaves} wave${totalWaves !== 1 ? 's' : ''}, ${throughputLabel} items/wave average)`,
    ''
  ];

  // Format each wave
  waves.forEach((wave, index) => {
    if (wave.length > 0) {
      lines.push(`Wave ${index + 1} (${wave.length}/${capacity} capacity)`);
      
      wave.forEach((issue, itemIndex) => {
        const title = sanitizeTitle(issue.title);
        lines.push(`${itemIndex + 1}. ${issue.id} - ${title}`);
      });
      
      // Add blank line between waves (except after the last wave)
      if (index < waves.length - 1) {
        lines.push('');
      }
    }
  });

  // Footer with total count
  lines.push('');
  lines.push(`Total: ${totalItems} item${totalItems !== 1 ? 's' : ''} scheduled`);

  return lines.join('\n');
}

/**
 * Escapes a string for safe inclusion in a Mermaid node label.
 * @param {string} text
 * @returns {string}
 */
function escapeMermaidLabel(text) {
  return String(text).replace(/"/g, '#quot;');
}

/**
 * Converts graph data into a Mermaid flowchart string.
 * @param {Array<{Issues?: Array<{id: string, title?: string, status?: string, issue_type?: string}>, Dependencies?: Array}>} graphData
 * @returns {string}
 */
function buildMermaidChartText(graphData) {
  if (!Array.isArray(graphData) || graphData.length === 0) {
    return '';
  }

  const lines = ['graph LR'];
  const seenNodes = new Set();
  const seenEdges = new Set();

  graphData.forEach(component => {
    const issues = component.Issues || [];
    const deps = component.Dependencies || [];

    issues.forEach(issue => {
      if (!issue || !issue.id || seenNodes.has(issue.id)) return;
      seenNodes.add(issue.id);
      const title = sanitizeTitle(issue.title);
      const safeId = issue.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const label = escapeMermaidLabel(`${issue.id}: ${title}`);
      lines.push(`  ${safeId}["${label}"]`);
    });

    deps.forEach(dep => {
      const fromId = dep.depends_on_id || dep.from_id || dep.FromID;
      const toId = dep.issue_id || dep.to_id || dep.ToID;
      if (!fromId || !toId) return;

      const depType = dep.type || dep.dependency_type || dep.relationship || dep.relation_type || 'related';
      const edgeKey = `${fromId}|${toId}|${depType}`;
      if (seenEdges.has(edgeKey)) return;
      seenEdges.add(edgeKey);

      const safeFrom = fromId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeTo = toId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const label = escapeMermaidLabel(String(depType).toLowerCase());
      lines.push(`  ${safeFrom} -->|"${label}"| ${safeTo}`);
    });
  });

  return lines.join('\n');
}

module.exports = {
  copyTextToClipboard,
  formatIssuesForClipboard,
  buildPhasedClipboardText,
  buildPlanClipboardText,
  buildMermaidChartText
};
