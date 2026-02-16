const StatItem= ({ label, value, percentage, colorClass }) => (
  <div className="stat-item stat-item--compact">
    <div className="stat-item__header">
      <span className="stat-item__label">{label}</span>
      <span className={`stat-item__value ${colorClass}`}>{value}</span>
    </div>
    <div className="stat-item__bar">
      <div className={`stat-item__bar-fill ${colorClass}`} style={{ width: `${percentage}%` }} />
    </div>
  </div>
);

const StatsDisplay = ({ stats, header, command }) => {
  const total = parseInt(stats['Total Issues'] || '0');
  const inProgress = parseInt(stats['In Progress'] || '0');
  const closed = parseInt(stats['Closed'] || '0');
  const blocked = parseInt(stats['Blocked'] || '0');
  const ready = parseInt(stats['Ready'] || '0');
  
  // Calculate open as total - closed (all non-closed issues)
  const open = total - closed;

  const getPercentage = (value) => total > 0 ? (value / total * 100).toFixed(1) : 0;

  return (
    <div className="output success stats-display">
      <div className="stats-display__command">
        $ bd {command}
      </div>
      
      <div className="stats-display__header">
        {header}
      </div>

      {/* Total Issues */}
      <div className="stats-display__total">
        <span className="stats-display__total-label">Total Issues</span>
        <span className="stats-display__total-value">{total}</span>
      </div>

      {/* Status & Work in Grid */}
      <div className="stats-display__grid">
        <StatItem
          label="Open / Ready"
          value={`${open} / ${ready}`}
          percentage={getPercentage(open)}
          colorClass="stat-item--blue"
        />

        <StatItem
          label="In Progress"
          value={inProgress}
          percentage={getPercentage(inProgress)}
          colorClass="stat-item--yellow"
        />

        <StatItem
          label="Closed"
          value={closed}
          percentage={getPercentage(closed)}
          colorClass="stat-item--green"
        />

        <StatItem
          label="Blocked"
          value={blocked}
          percentage={getPercentage(blocked)}
          colorClass="stat-item--red"
        />
      </div>

      {/* Metrics */}
      {stats['Avg Lead Time'] && (
        <div className="stats-display__metric">
          <div className="stats-display__metric-label">
            Average Lead Time
          </div>
          <div className="stats-display__metric-value">
            {stats['Avg Lead Time']}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsDisplay;
