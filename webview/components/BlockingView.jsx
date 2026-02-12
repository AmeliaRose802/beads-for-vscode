import React, { useState, useMemo } from 'react';

/**
 * BlockingView - Visualizes blocking relationships and suggests completion order.
 *
 * @param {{ blockingModel: object, onIssueClick: Function, onClose: Function }} props
 */
const BlockingView = ({ blockingModel, onIssueClick, onClose }) => {
  const [activeTab, setActiveTab] = useState('graph');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterLabel, setFilterLabel] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);

  const criticalPathIds = useMemo(() => {
    if (!blockingModel?.criticalPath) return new Set();
    return new Set(blockingModel.criticalPath.map(i => i.id));
  }, [blockingModel]);

  const readyIds = useMemo(() => {
    if (!blockingModel?.readyItems) return new Set();
    return new Set(blockingModel.readyItems.map(i => i.id));
  }, [blockingModel]);

  if (!blockingModel) {
    return (
      <div className="blocking-view blocking-view--empty">
        <div className="blocking-view__header">
          <h3 className="blocking-view__title">🚧 Blocking View</h3>
          <button className="blocking-view__close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="blocking-view__empty-message">
          <p>Loading blocking data...</p>
        </div>
      </div>
    );
  }

  const { issues, edges, completionOrder, criticalPath, readyItems, parallelGroups } = blockingModel;

  if (issues.length === 0) {
    return (
      <div className="blocking-view blocking-view--empty">
        <div className="blocking-view__header">
          <h3 className="blocking-view__title">🚧 Blocking View</h3>
          <button className="blocking-view__close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="blocking-view__empty-message">
          <p>No blocking relationships found.</p>
          <p>Link issues with blocking dependencies to see them here.</p>
        </div>
      </div>
    );
  }

  const handleNodeClick = (issue) => {
    setSelectedNode(issue.id);
    if (onIssueClick) onIssueClick(issue);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open': return '○';
      case 'in_progress': return '◐';
      case 'blocked': return '●';
      case 'closed': return '✓';
      default: return '○';
    }
  };

  const renderFilters = () => (
    <div className="blocking-view__filters">
      <select
        className="blocking-view__filter-select"
        value={filterPriority}
        onChange={(e) => setFilterPriority(e.target.value)}
        aria-label="Filter by priority"
      >
        <option value="">All Priorities</option>
        <option value="0">P0 - Critical</option>
        <option value="1">P1 - High</option>
        <option value="2">P2 - Medium</option>
        <option value="3">P3 - Low</option>
        <option value="4">P4 - Backlog</option>
      </select>
      <input
        className="blocking-view__filter-input"
        placeholder="Filter assignee..."
        value={filterAssignee}
        onChange={(e) => setFilterAssignee(e.target.value)}
        aria-label="Filter by assignee"
      />
      <input
        className="blocking-view__filter-input"
        placeholder="Filter label..."
        value={filterLabel}
        onChange={(e) => setFilterLabel(e.target.value)}
        aria-label="Filter by label"
      />
    </div>
  );

  const renderGraphTab = () => {
    const issueMap = {};
    issues.forEach(i => { issueMap[i.id] = i; });

    // Build adjacency for layout
    const edgeTargets = {};
    edges.forEach(({ from, to }) => {
      if (!edgeTargets[from]) edgeTargets[from] = [];
      edgeTargets[from].push(to);
    });

    return (
      <div className="blocking-view__graph">
        <div className="blocking-view__graph-legend">
          <span className="blocking-view__legend-item">
            <span className="blocking-view__legend-swatch blocking-view__legend-swatch--critical" /> Critical Path
          </span>
          <span className="blocking-view__legend-item">
            <span className="blocking-view__legend-swatch blocking-view__legend-swatch--ready" /> Ready
          </span>
          <span className="blocking-view__legend-item">
            <span className="blocking-view__legend-swatch blocking-view__legend-swatch--blocked" /> Blocked
          </span>
        </div>
        <div className="blocking-view__graph-container">
          {parallelGroups.map((group, depth) => (
            <div key={depth} className="blocking-view__graph-layer">
              <div className="blocking-view__layer-label">Phase {depth + 1}</div>
              <div className="blocking-view__layer-items">
                {group.map(issue => {
                  const isCritical = criticalPathIds.has(issue.id);
                  const isReady = readyIds.has(issue.id);
                  const isSelected = selectedNode === issue.id;
                  const nodeClass = [
                    'blocking-view__node',
                    isCritical ? 'blocking-view__node--critical' : '',
                    isReady ? 'blocking-view__node--ready' : '',
                    isSelected ? 'blocking-view__node--selected' : '',
                    `blocking-view__node--${issue.status || 'open'}`
                  ].filter(Boolean).join(' ');

                  return (
                    <div
                      key={issue.id}
                      className={nodeClass}
                      onClick={() => handleNodeClick(issue)}
                      title={`${issue.id}: ${issue.title}`}
                    >
                      <div className="blocking-view__node-header">
                        <span className="blocking-view__node-status">
                          {getStatusIcon(issue.status)}
                        </span>
                        <span className="blocking-view__node-id">{issue.id}</span>
                        <span className="blocking-view__node-priority">P{issue.priority}</span>
                      </div>
                      <div className="blocking-view__node-title">{issue.title}</div>
                      {isCritical && <div className="blocking-view__node-badge">Critical</div>}
                      {isReady && <div className="blocking-view__node-badge blocking-view__node-badge--ready">Ready</div>}
                    </div>
                  );
                })}
              </div>
              {depth < parallelGroups.length - 1 && (
                <div className="blocking-view__arrow-down">↓</div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderOrderTab = () => (
    <div className="blocking-view__order">
      <div className="blocking-view__order-header">
        <span className="blocking-view__order-label">Suggested completion order (dependencies first):</span>
      </div>
      <ol className="blocking-view__order-list">
        {completionOrder.map((issue, idx) => {
          const isCritical = criticalPathIds.has(issue.id);
          const isReady = readyIds.has(issue.id);
          const itemClass = [
            'blocking-view__order-item',
            isCritical ? 'blocking-view__order-item--critical' : '',
            isReady ? 'blocking-view__order-item--ready' : '',
            issue.status === 'closed' ? 'blocking-view__order-item--done' : ''
          ].filter(Boolean).join(' ');

          return (
            <li
              key={issue.id}
              className={itemClass}
              onClick={() => handleNodeClick(issue)}
            >
              <span className="blocking-view__order-step">{idx + 1}</span>
              <span className="blocking-view__order-status">{getStatusIcon(issue.status)}</span>
              <span className="blocking-view__order-id">{issue.id}</span>
              <span className="blocking-view__order-title">{issue.title}</span>
              {isCritical && <span className="blocking-view__tag blocking-view__tag--critical">Critical</span>}
              {isReady && <span className="blocking-view__tag blocking-view__tag--ready">Ready</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );

  const renderCriticalTab = () => (
    <div className="blocking-view__critical">
      <div className="blocking-view__critical-header">
        <span className="blocking-view__critical-label">
          Critical path ({criticalPath.length} items, longest dependency chain):
        </span>
      </div>
      <div className="blocking-view__critical-chain">
        {criticalPath.map((issue, idx) => (
          <div key={issue.id} className="blocking-view__critical-item">
            <div
              className="blocking-view__critical-node"
              onClick={() => handleNodeClick(issue)}
            >
              <span className="blocking-view__critical-status">{getStatusIcon(issue.status)}</span>
              <span className="blocking-view__critical-id">{issue.id}</span>
              <span className="blocking-view__critical-title">{issue.title}</span>
              <span className="blocking-view__critical-priority">P{issue.priority}</span>
            </div>
            {idx < criticalPath.length - 1 && (
              <div className="blocking-view__critical-arrow">↓ blocks</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderParallelTab = () => (
    <div className="blocking-view__parallel">
      <div className="blocking-view__parallel-header">
        <span className="blocking-view__parallel-label">
          Work can be parallelized into {parallelGroups.length} phases:
        </span>
      </div>
      {parallelGroups.map((group, idx) => (
        <div key={idx} className="blocking-view__parallel-group">
          <div className="blocking-view__parallel-phase">
            Phase {idx + 1} ({group.length} item{group.length !== 1 ? 's' : ''})
          </div>
          <div className="blocking-view__parallel-items">
            {group.map(issue => (
              <div
                key={issue.id}
                className={`blocking-view__parallel-item ${readyIds.has(issue.id) ? 'blocking-view__parallel-item--ready' : ''}`}
                onClick={() => handleNodeClick(issue)}
              >
                <span className="blocking-view__parallel-status">{getStatusIcon(issue.status)}</span>
                <span className="blocking-view__parallel-id">{issue.id}</span>
                <span className="blocking-view__parallel-title">{issue.title}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="blocking-view">
      <div className="blocking-view__header">
        <h3 className="blocking-view__title">🚧 Blocking View</h3>
        <div className="blocking-view__summary">
          <span className="blocking-view__stat">{issues.length} items</span>
          <span className="blocking-view__stat">{edges.length} blocking links</span>
          <span className="blocking-view__stat">{readyItems.length} ready</span>
        </div>
        <button className="blocking-view__close-btn" onClick={onClose}>✕</button>
      </div>

      {renderFilters()}

      <div className="blocking-view__tabs">
        <button
          className={`blocking-view__tab ${activeTab === 'graph' ? 'blocking-view__tab--active' : ''}`}
          onClick={() => setActiveTab('graph')}
        >📊 Graph</button>
        <button
          className={`blocking-view__tab ${activeTab === 'order' ? 'blocking-view__tab--active' : ''}`}
          onClick={() => setActiveTab('order')}
        >📋 Order</button>
        <button
          className={`blocking-view__tab ${activeTab === 'critical' ? 'blocking-view__tab--active' : ''}`}
          onClick={() => setActiveTab('critical')}
        >🔥 Critical</button>
        <button
          className={`blocking-view__tab ${activeTab === 'parallel' ? 'blocking-view__tab--active' : ''}`}
          onClick={() => setActiveTab('parallel')}
        >⚡ Parallel</button>
      </div>

      <div className="blocking-view__content">
        {activeTab === 'graph' && renderGraphTab()}
        {activeTab === 'order' && renderOrderTab()}
        {activeTab === 'critical' && renderCriticalTab()}
        {activeTab === 'parallel' && renderParallelTab()}
      </div>
    </div>
  );
};

export default BlockingView;
