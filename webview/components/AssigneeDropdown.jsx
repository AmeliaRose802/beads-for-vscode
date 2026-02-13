import React, { useState, useRef, useEffect, useMemo } from 'react';

/**
 * Reusable assignee dropdown with combobox functionality.
 * Shows existing assignees from the issue list and allows custom input.
 *
 * @param {object} props
 * @param {string} props.value - Current assignee value
 * @param {Function} [props.onChange] - Called with draft assignee string as the user types
 * @param {Function} [props.onCommit] - Called when the assignee should be saved (Enter/blur/selection)
 * @param {string[]} props.existingAssignees - Known assignee names from issues
 * @param {string} [props.placeholder] - Input placeholder text
 * @returns {React.ReactElement}
 */
const AssigneeDropdown = ({ value, onChange, onCommit, existingAssignees, placeholder }) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Deduplicate and filter assignees based on input
  const filteredAssignees = useMemo(() => {
    const unique = [...new Set(existingAssignees || [])].filter(Boolean);
    if (!inputValue.trim()) return unique;
    const lower = inputValue.toLowerCase();
    return unique.filter((a) => a.toLowerCase().includes(lower));
  }, [existingAssignees, inputValue]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('.assignee-dropdown__option');
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const selectAssignee = (assignee) => {
    setInputValue(assignee);
    if (onChange) onChange(assignee);
    if (onCommit) onCommit(assignee);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    setIsOpen(true);
    setHighlightedIndex(-1);
    if (onChange) onChange(val);
  };

  const handleClear = () => {
    setInputValue('');
    if (onChange) onChange('');
    if (onCommit) onCommit('');
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredAssignees.length) {
        selectAssignee(filteredAssignees[highlightedIndex]);
      } else {
        setIsOpen(false);
        setHighlightedIndex(-1);
        if (onCommit) onCommit(inputValue);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setHighlightedIndex(-1);
      return;
    }

    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      e.preventDefault();
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredAssignees.length - 1 ? prev + 1 : prev
      );
      break;
    case 'ArrowUp':
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      break;
    }
  };

  const handleFocus = () => {
    if (filteredAssignees.length > 0) {
      setIsOpen(true);
    }
  };

  const handleBlur = () => {
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (onCommit) onCommit(inputValue);
  };

  return (
    <div className="assignee-dropdown" ref={containerRef}>
      <div className="assignee-dropdown__input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="assignee-dropdown__input"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder || 'Type or select assignee'}
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-haspopup="listbox"
        />
        {inputValue && (
          <button
            className="assignee-dropdown__clear"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
            title="Clear assignee"
            type="button"
            aria-label="Clear assignee"
          >
            ✕
          </button>
        )}
      </div>
      {isOpen && filteredAssignees.length > 0 && (
        <ul
          className="assignee-dropdown__list"
          ref={listRef}
          role="listbox"
        >
          {filteredAssignees.map((assignee, idx) => (
            <li
              key={assignee}
              className={
                'assignee-dropdown__option' +
                (idx === highlightedIndex ? ' assignee-dropdown__option--highlighted' : '')
              }
              role="option"
              aria-selected={idx === highlightedIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                selectAssignee(assignee);
              }}
              onMouseEnter={() => setHighlightedIndex(idx)}
            >
              👤 {assignee}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AssigneeDropdown;
