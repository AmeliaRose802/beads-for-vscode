import React, { useMemo, useRef, useState, useEffect } from 'react';

/**
 * Extracts unique labels from all issues.
 * @param {Array} issues - Array of issue objects
 * @returns {string[]} Sorted unique labels
 */
function extractLabels(issues) {
  const labelSet = new Set();
  issues.forEach((issue) => {
    if (Array.isArray(issue.labels)) {
      issue.labels.forEach((label) => labelSet.add(label));
    }
  });
  return Array.from(labelSet).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
}

/**
 * Extracts unique assignees from all issues.
 * @param {Array} issues - Array of issue objects
 * @returns {string[]} Sorted unique assignees
 */
function extractAssignees(issues) {
  const assigneeSet = new Set();
  issues.forEach((issue) => {
    if (issue.assignee) {
      assigneeSet.add(issue.assignee);
    }
  });
  return Array.from(assigneeSet).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
}

/**
 * FilterDropdown provides a reusable combobox for filtering.
 */
const FilterDropdown = ({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  icon
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const filteredOptions = useMemo(() => {
    if (!inputValue.trim()) return options;
    const lower = inputValue.toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(lower));
  }, [options, inputValue]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('.filter-dropdown__option');
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    setIsOpen(true);
    setHighlightedIndex(-1);
    onChange(val);
  };

  const selectOption = (opt) => {
    setInputValue(opt);
    onChange(opt);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleClear = () => {
    setInputValue('');
    onChange('');
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        selectOption(filteredOptions[highlightedIndex]);
      } else {
        setIsOpen(false);
        setHighlightedIndex(-1);
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
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    }
  };

  const handleFocus = () => {
    if (filteredOptions.length > 0) setIsOpen(true);
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }, 0);
  };

  return (
    <div className="filter-dropdown" ref={containerRef}>
      <div className="filter-dropdown__input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="filter-dropdown__input"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          aria-label={ariaLabel}
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-haspopup="listbox"
        />
        {inputValue && (
          <button
            type="button"
            className="filter-dropdown__clear"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
            aria-label={`Clear ${ariaLabel}`}
          >
            ✕
          </button>
        )}
      </div>
      {isOpen && filteredOptions.length > 0 && (
        <ul className="filter-dropdown__list" ref={listRef} role="listbox">
          {filteredOptions.map((opt, idx) => (
            <li
              key={opt}
              className={
                'filter-dropdown__option' +
                (idx === highlightedIndex ? ' filter-dropdown__option--highlighted' : '')
              }
              role="option"
              aria-selected={idx === highlightedIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                selectOption(opt);
              }}
              onMouseEnter={() => setHighlightedIndex(idx)}
            >
              {icon} {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * ListFilterControls provides filtering UI for the list view.
 * Supports filtering by assignee, label, status, priority, and search term.
 *
 * @param {object} props - Component props.
 * @param {string} props.searchFilter - Current search filter value.
 * @param {string} props.assigneeFilter - Current assignee filter value.
 * @param {string} props.labelFilter - Current label filter value.
 * @param {string} props.statusFilter - Current status filter value.
 * @param {string} props.priorityFilter - Current priority filter value.
 * @param {Function} props.onSearchChange - Called when search changes.
 * @param {Function} props.onAssigneeChange - Called when assignee filter changes.
 * @param {Function} props.onLabelChange - Called when label filter changes.
 * @param {Function} props.onStatusChange - Called when status filter changes.
 * @param {Function} props.onPriorityChange - Called when priority filter changes.
 * @param {Function} props.onClearAll - Called when clearing all filters.
 * @param {Array} props.allIssues - All issues for extracting filter options.
 * @returns {React.ReactElement}
 */
const ListFilterControls = ({
  searchFilter,
  assigneeFilter,
  labelFilter,
  statusFilter,
  priorityFilter,
  onSearchChange,
  onAssigneeChange,
  onLabelChange,
  onStatusChange,
  onPriorityChange,
  onClearAll,
  allIssues = []
}) => {
  const availableLabels = useMemo(() => extractLabels(allIssues), [allIssues]);
  const availableAssignees = useMemo(() => extractAssignees(allIssues), [allIssues]);
  const statusOptions = ['In progress', 'Not in progress'];
  const priorityOptions = ['P0 - Critical', 'P1 - High', 'P2 - Medium', 'P3 - Low', 'P4 - Backlog'];

  const hasActiveFilters = searchFilter || assigneeFilter || labelFilter || statusFilter || priorityFilter;

  return (
    <div className="list-filter-controls">
      <div className="list-filter-controls__search">
        <input
          type="text"
          className="list-filter-controls__search-input"
          value={searchFilter}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search ID, title, description..."
          aria-label="Search issues"
        />
        {searchFilter && (
          <button
            type="button"
            className="list-filter-controls__clear-btn"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      <div className="list-filter-controls__filter">
        <FilterDropdown
          value={assigneeFilter}
          onChange={onAssigneeChange}
          options={availableAssignees}
          placeholder="Assignee"
          ariaLabel="Filter by assignee"
          icon="👤"
        />
      </div>

      <div className="list-filter-controls__filter">
        <FilterDropdown
          value={statusFilter}
          onChange={onStatusChange}
          options={statusOptions}
          placeholder="Status"
          ariaLabel="Filter by status"
          icon="⏳"
        />
      </div>

      <div className="list-filter-controls__filter">
        <FilterDropdown
          value={labelFilter}
          onChange={onLabelChange}
          options={availableLabels}
          placeholder="Label"
          ariaLabel="Filter by label"
          icon="🏷️"
        />
      </div>

      <div className="list-filter-controls__filter">
        <FilterDropdown
          value={priorityFilter}
          onChange={onPriorityChange}
          options={priorityOptions}
          placeholder="Priority"
          ariaLabel="Filter by priority"
          icon="🎯"
        />
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          className="list-filter-controls__clear-all"
          onClick={onClearAll}
          title="Clear all filters"
        >
          Clear filters
        </button>
      )}
    </div>
  );
};

export default ListFilterControls;
