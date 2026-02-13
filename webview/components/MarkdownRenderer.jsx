import React, { useMemo } from 'react';
import { renderMarkdown } from '../markdown-utils';

/**
 * Renders a Markdown string as formatted HTML.
 * @param {object} props - Component props
 * @param {string} props.content - Markdown text to render
 * @param {string} [props.className] - Optional additional CSS class
 * @returns {React.ReactElement|null} Rendered component or null
 */
const MarkdownRenderer = ({ content, className }) => {
  const html = useMemo(() => renderMarkdown(content), [content]);

  if (!html) {
    return null;
  }

  return (
    <div
      className={`md-rendered ${className || ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MarkdownRenderer;
