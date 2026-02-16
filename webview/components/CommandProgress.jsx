import React from 'react';

const CommandProgress = ({ entries }) => {
  if (!entries || entries.length === 0) {
    return null;
  }

  const summary = entries.length === 1
    ? 'Running 1 command'
    : `Running ${entries.length} commands`;

  return (
    <div className="command-progress" role="status" aria-live="polite">
      <div className="command-progress__spinner" aria-hidden="true" />
      <div className="command-progress__details">
        <div className="command-progress__title">{summary}</div>
        <ul className="command-progress__list">
          {entries.map((operation) => (
            <li
              key={operation.id}
              className={`command-progress__item command-progress__item--${operation.scope}`}
            >
              {operation.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default CommandProgress;
