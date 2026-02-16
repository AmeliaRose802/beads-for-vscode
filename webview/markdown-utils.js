/**
 * Lightweight Markdown-to-HTML renderer for issue descriptions.
 * Supports headers, bold, italic, inline code, code blocks,
 * unordered/ordered lists, links, and paragraphs.
 * @param {string} text - Raw Markdown string
 * @returns {string} Sanitised HTML string
 */
export function renderMarkdown(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const lines = text.split(/\r?\n/);
  const htmlParts = [];
  let inCodeBlock = false;
  let codeBlockLines = [];
  let inList = false;
  let listType = null;

  const closeList = () => {
    if (inList) {
      htmlParts.push(listType === 'ol' ? '</ol>' : '</ul>');
      inList = false;
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block fences
    if (/^```/.test(line)) {
      if (!inCodeBlock) {
        closeList();
        inCodeBlock = true;
        codeBlockLines = [];
      } else {
        htmlParts.push(
          '<pre class="md-code-block"><code>' +
          escapeHtml(codeBlockLines.join('\n')) +
          '</code></pre>'
        );
        inCodeBlock = false;
        codeBlockLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      closeList();
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      closeList();
      const level = headerMatch[1].length;
      htmlParts.push(
        `<h${level} class="md-heading md-h${level}">${formatInline(headerMatch[2])}</h${level}>`
      );
      continue;
    }

    // Unordered list items
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        closeList();
        htmlParts.push('<ul class="md-list">');
        inList = true;
        listType = 'ul';
      }
      htmlParts.push(`<li>${formatInline(ulMatch[2])}</li>`);
      continue;
    }

    // Ordered list items
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        closeList();
        htmlParts.push('<ol class="md-list">');
        inList = true;
        listType = 'ol';
      }
      htmlParts.push(`<li>${formatInline(olMatch[2])}</li>`);
      continue;
    }

    // Normal paragraph line
    closeList();
    htmlParts.push(`<p class="md-paragraph">${formatInline(line)}</p>`);
  }

  // Close any open blocks
  if (inCodeBlock) {
    htmlParts.push(
      '<pre class="md-code-block"><code>' +
      escapeHtml(codeBlockLines.join('\n')) +
      '</code></pre>'
    );
  }
  closeList();

  return htmlParts.join('');
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - Raw string
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Check whether a URL uses a safe scheme (http, https, mailto, or relative).
 * Rejects dangerous schemes like javascript:, data:, vbscript:, etc.
 * @param {string} url - URL string to validate
 * @returns {boolean} true if the URL is safe to use in an href
 */
function isSafeUrl(url) {
  // eslint-disable-next-line no-control-regex -- Intentionally stripping control chars to prevent null byte bypass
  const trimmed = url.replace(/[\s\x00-\x1f]/g, '').toLowerCase();
  if (/^[a-z][a-z0-9+\-.]*:/i.test(trimmed)) {
    return /^https?:|^mailto:/i.test(trimmed);
  }
  // Relative URLs and fragment-only links are safe
  return true;
}

/**
 * Apply inline Markdown formatting (bold, italic, code, links)
 * @param {string} text - Single line of text
 * @returns {string} HTML with inline formatting
 */
function formatInline(text) {
  let result = escapeHtml(text);

  // Inline code (must come before bold/italic to avoid conflicts)
  result = result.replace(/`([^`]+?)`/g, '<code class="md-inline-code">$1</code>');

  // Bold + italic
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');

  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links [text](url) – only allow safe URL schemes
  result = result.replace(
    /\[([^\]]+?)\]\(([^)]+?)\)/g,
    (_match, text, url) => {
      if (isSafeUrl(url)) {
        return `<a class="md-link" href="${url}" title="${url}">${text}</a>`;
      }
      return text;
    }
  );

  return result;
}
