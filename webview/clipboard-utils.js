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

module.exports = {
  formatIssuesForClipboard,
  buildPhasedClipboardText
};
