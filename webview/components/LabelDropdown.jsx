import React, { useState, useMemo, useEffect, useRef } from 'react';

/**
 * LabelDropdown provides an autocomplete combobox for selecting known labels.
 *
 * @param {object} props - Component props.
 * @param {string} [props.value] - Current label filter value.
 * @param {Function} [props.onChange] - Invoked whenever the value changes.
 * @param {string[]} [props.labels] - List of available labels to suggest.
 * @param {string} [props.placeholder] - Optional placeholder text.
 * @param {string} [props.ariaLabel] - Accessible label for the input element.
 * @returns {React.ReactElement}
 */
const LabelDropdown = ({
  value = '',
  onChange,
  labels = [],
  placeholder = 'Filter label...',
  ariaLabel = 'Filter by label'
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

  const normalizedLabels = useMemo(() => {
    const unique = new Set();
    (labels || []).forEach((label) => {
      if (label && typeof label === 'string') {
        unique.add(label);
      }
    });
    return Array.from(unique).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  }, [labels]);

  const filteredLabels = useMemo(() => {
    if (!inputValue.trim()) return normalizedLabels;
    const lower = inputValue.toLowerCase();
    return normalizedLabels.filter((label) => label.toLowerCase().includes(lower));
  }, [normalizedLabels, inputValue]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('.label-dropdown__option');
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const emitChange = (nextValue) => {
    setInputValue(nextValue);
    if (onChange) onChange(nextValue);
  };

  const selectLabel = (label) => {
    emitChange(label);
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  const handleInputChange = (event) => {
    const next = event.target.value;
    emitChange(next);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredLabels.length) {
        selectLabel(filteredLabels[highlightedIndex]);
      } else {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      setHighlightedIndex(-1);
      return;
    }

    if (!isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setIsOpen(true);
      event.preventDefault();
      return;
    }

    if (!isOpen) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredLabels.length - 1 ? prev + 1 : prev
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    }
  };

  const handleClear = () => {
    emitChange('');
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleFocus = () => {
    if (filteredLabels.length > 0) {
      setIsOpen(true);
    }
  };

  const handleBlur = () => {
    // Delay closing to allow option click events (which use onMouseDown) to complete.
    setTimeout(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }, 0);
  };

  return (
    <div className="label-dropdown" ref={containerRef}>
      <div className="label-dropdown__input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="label-dropdown__input"
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
            className="label-dropdown__clear"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleClear}
            aria-label="Clear label filter"
          >
            ✕
          </button>
        )}
      </div>
      {isOpen && filteredLabels.length > 0 && (
        <ul
          className="label-dropdown__list"
          ref={listRef}
          role="listbox"
        >
          {filteredLabels.map((label, idx) => (
            <li
              key={label}
              className={
                'label-dropdown__option' +
                (idx === highlightedIndex ? ' label-dropdown__option--highlighted' : '')
              }
              role="option"
              aria-selected={idx === highlightedIndex}
              onMouseDown={(event) => {
                event.preventDefault();
                selectLabel(label);
              }}
              onMouseEnter={() => setHighlightedIndex(idx)}
            >
              🏷️ {label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LabelDropdown;
