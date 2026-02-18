import React, { useEffect, useRef, useState } from 'react';
const { copyTextToClipboard } = require('../clipboard-utils');

const COPY_FEEDBACK_DURATION_MS = 1500;

const CopyableIssueId = ({ id, className = '', tooltip = 'Click to copy ID', allowPropagation = false, onClick }) => {
  const normalizedId = id === undefined || id === null ? '' : String(id);
  const [copyState, setCopyState] = useState('idle');
  const timeoutRef = useRef(null);

  useEffect(() => () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  const handleClick = async (event) => {
    if (!allowPropagation) {
      event.stopPropagation();
    }

    if (!normalizedId) {
      if (onClick) {
        onClick(event);
      }
      return;
    }

    try {
      setCopyState('copying');
      await copyTextToClipboard(normalizedId);
      setCopyState('copied');
    } catch (error) {
      console.error('Failed to copy ID:', error);
      setCopyState('error');
    } finally {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setCopyState('idle'), COPY_FEEDBACK_DURATION_MS);
      if (onClick) {
        onClick(event);
      }
    }
  };

  const tooltipText = copyState === 'copied'
    ? 'Copied!'
    : copyState === 'error'
      ? 'Copy failed'
      : tooltip;

  return (
    <button
      type="button"
      className={`copyable-issue-id ${className}`.trim()}
      data-tooltip={tooltipText}
      onClick={handleClick}
      aria-label={`Copy ${normalizedId} to clipboard`}
    >
      {normalizedId}
    </button>
  );
};

export default CopyableIssueId;
