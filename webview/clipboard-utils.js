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

module.exports = {
  formatIssuesForClipboard,
  buildPhasedClipboardText,
  buildPlanClipboardText
};
