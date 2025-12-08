import React from 'react';
import IssueCard from './IssueCard';
import StatsDisplay from './StatsDisplay';

const OutputDisplay = ({ output, isError, isSuccess, onShowIssue, onCloseIssue, onReopenIssue }) => {
  const className = isError ? 'error' : isSuccess ? 'success' : '';
  
  if (typeof output === 'object' && output.type === 'stats') {
    return <StatsDisplay stats={output.stats} header={output.header} command={output.command} />;
  }
  
  if (typeof output === 'object' && output.type === 'list') {
    return (
      <div className={`output ${className} output-display`}>
        <div className="output-display__command">
          $ bd {output.command}
        </div>
        {output.header && (
          <div className="output-display__header">
            {output.header}
          </div>
        )}
        {output.openIssues.map((issue, idx) => (
          <IssueCard 
            key={idx} 
            issue={issue} 
            onClick={() => onShowIssue(issue.id)}
            onClose={() => onCloseIssue(issue.id)}
            onReopen={() => onReopenIssue(issue.id)}
          />
        ))}
        {output.closedIssues.length > 0 && (
          <details className="output-display__closed-section">
            <summary className="output-display__closed-summary">
              ✓ Closed ({output.closedIssues.length})
            </summary>
            <div className="output-display__closed-items">
              {output.closedIssues.map((issue, idx) => (
                <IssueCard 
                  key={idx} 
                  issue={issue} 
                  onClick={() => onShowIssue(issue.id)}
                  onClose={() => onCloseIssue(issue.id)}
                  onReopen={() => onReopenIssue(issue.id)}
                />
              ))}
            </div>
          </details>
        )}
      </div>
    );
  }

  return (
    <pre className={`output ${className}`}>
      {output}
    </pre>
  );
};

export default OutputDisplay;
