import React, { useState, useMemo } from 'react';
import BlockingPlanView from './BlockingPlanView';
import LabelDropdown from './LabelDropdown';
const { getStatusIcon } = require('../field-utils');

/** BlockingView - Visualizes blocking relationships and suggests completion order. */
const BlockingView = ({ blockingModel, onIssueClick, onClose, onDepAction }) => {
  const [activeTab, setActiveTab] = useState('graph');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterLabel, setFilterLabel] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [activeEdgeMenu, setActiveEdgeMenu] = useState(null);
  const [retargetState, setRetargetState] = useState(null);
  const [addLinkState, setAddLinkState] = useState(null);
  
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
  const { issues, edges, completionOrder, criticalPath, readyItems, parallelGroups, fanOutCounts } = blockingModel;
  const availableLabels = useMemo(() => {
    if (!Array.isArray(issues)) return [];
    const labelSet = new Set();
    issues.forEach(issue => {
      if (Array.isArray(issue.labels)) {
        issue.labels.filter(Boolean).forEach(label => labelSet.add(label));
      }
    });
    return Array.from(labelSet).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  }, [issues]);
  
  const matchesFilters = useMemo(() => {
    const hasPriority = filterPriority !== '';
    const hasAssignee = filterAssignee.trim() !== '';
    const hasLabel = filterLabel.trim() !== '';
    if (!hasPriority && !hasAssignee && !hasLabel) return null;
    return (issue) => {
      if (hasPriority && String(issue.priority) !== filterPriority) return false;
      if (hasAssignee && !(issue.assignee || '').toLowerCase().includes(filterAssignee.toLowerCase())) return false;
      if (hasLabel && !Array.isArray(issue.labels)?.some(l => l.toLowerCase().includes(filterLabel.toLowerCase()))) return false;
      return true;
    };
  }, [filterPriority, filterAssignee, filterLabel]);
  
  const filteredIds = useMemo(() => {
    return matchesFilters ? new Set(issues.filter(matchesFilters).map(i => i.id)) : null;
  }, [issues, matchesFilters]);
  
  const filterList = (list) => filteredIds ? list.filter(i => filteredIds.has(i.id)) : list;
  const filteredIssues = filterList(issues);
  const filteredCompletionOrder = filterList(completionOrder);
  const filteredCriticalPath = filterList(criticalPath);
  const filteredReadyItems = filterList(readyItems);
  const filteredParallelGroups = (filteredIds
    ? parallelGroups.map(g => g.filter(i => filteredIds.has(i.id))).filter(g => g.length > 0)
    : parallelGroups
  );
  const isClosedStatus = (issue) => issue && (issue.status === 'closed' || issue.status === 'done');
  if (filteredIssues.length === 0) {
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
  
  const handleEdgeClick = (fromId, toId, event) => {
    event.stopPropagation();
    setActiveEdgeMenu({ fromId, toId });
    setRetargetState(null);
    setAddLinkState(null);
  };
  
  const closeEdgeMenu = () => {
    setActiveEdgeMenu(null);
    setRetargetState(null);
    setAddLinkState(null);
  };
  
  const handleRemoveLink = (fromId, toId) => {
    if (onDepAction) onDepAction('remove', fromId, toId);
    closeEdgeMenu();
  };
  
  const handleRetarget = (fromId, oldToId, newToId) => {
    if (onDepAction && newToId.trim()) {
      onDepAction('remove', fromId, oldToId);
      onDepAction('add', fromId, newToId.trim());
    }
    closeEdgeMenu();
  };
  
  const handleAddLink = (fromId, toId) => {
    if (onDepAction && toId.trim()) onDepAction('add', fromId, toId.trim());
    closeEdgeMenu();
  };
  
  const renderEdgeMenu = (fromId, toId) => {
    if (!activeEdgeMenu || activeEdgeMenu.fromId !== fromId || activeEdgeMenu.toId !== toId) {
      return null;
    }
    return (
      <div className="blocking-view__edge-menu">
        <div className="blocking-view__edge-menu-header">
          <span className="blocking-view__edge-menu-label">
            {fromId} → {toId}
          </span>
          <button
            className="blocking-view__edge-menu-close"
            onClick={closeEdgeMenu}
          >✕</button>
        </div>
        <div className="blocking-view__edge-menu-actions">
          <button
            className="blocking-view__edge-menu-btn blocking-view__edge-menu-btn--remove"
            onClick={() => handleRemoveLink(fromId, toId)}
          >🗑 Remove link</button>
          {retargetState ? (
            <div className="blocking-view__edge-menu-input-row">
              <input
                className="blocking-view__edge-menu-input"
                placeholder="New target ID..."
                value={retargetState.newTarget}
                onChange={(e) => setRetargetState({ ...retargetState, newTarget: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRetarget(fromId, toId, retargetState.newTarget);
                  if (e.key === 'Escape') setRetargetState(null);
                }}
                autoFocus
              />
              <button
                className="blocking-view__edge-menu-btn"
                onClick={() => handleRetarget(fromId, toId, retargetState.newTarget)}
              >✓</button>
            </div>
          ) : (
            <button
              className="blocking-view__edge-menu-btn"
              onClick={() => setRetargetState({ newTarget: '' })}
            >🔄 Re-target</button>
          )}
          {addLinkState ? (
            <div className="blocking-view__edge-menu-input-row">
              <input
                className="blocking-view__edge-menu-input"
                placeholder="Target ID..."
                value={addLinkState.targetId}
                onChange={(e) => setAddLinkState({ ...addLinkState, targetId: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddLink(fromId, addLinkState.targetId);
                  if (e.key === 'Escape') setAddLinkState(null);
                }}
                autoFocus
              />
              <button
                className="blocking-view__edge-menu-btn"
                onClick={() => handleAddLink(fromId, addLinkState.targetId)}
              >✓</button>
            </div>
          ) : (
            <button
              className="blocking-view__edge-menu-btn"
              onClick={() => setAddLinkState({ targetId: '' })}
            >➕ Add link from {fromId}</button>
          )}
        </div>
      </div>
    );
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
      <div className="blocking-view__filter-dropdown">
        <LabelDropdown
          value={filterLabel}
          onChange={setFilterLabel}
          labels={availableLabels}
          placeholder="Filter label..."
          ariaLabel="Filter by label"
        />
      </div>
    </div>
  );
  
  const renderGraphTab = () => {
    const issueMap = {};
    filteredIssues.forEach(i => { issueMap[i.id] = i; });
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
          {filteredParallelGroups.map((group, depth) => (
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
                    <div key={issue.id} className={nodeClass} onClick={() => handleNodeClick(issue)} title={`${issue.id}: ${issue.title}`}>
                      <div className="blocking-view__node-header">
                        <span className="blocking-view__node-status">{getStatusIcon(issue.status)}</span>
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
              {depth < filteredParallelGroups.length - 1 && (
                <div className="blocking-view__arrow-down blocking-view__arrow-down--interactive"
                  onClick={(e) => {
                    const fromIds = group.map(i => i.id);
                    const nextGroup = filteredParallelGroups[depth + 1];
                    if (fromIds.length === 1 && nextGroup && nextGroup.length === 1) {
                      handleEdgeClick(fromIds[0], nextGroup[0].id, e);
                    }
                  }}
                  title="Click to edit dependency"
                >
                  ↓
                  {group.length === 1 && filteredParallelGroups[depth + 1]?.length === 1 &&
                    renderEdgeMenu(group[0].id, filteredParallelGroups[depth + 1][0].id)}
                </div>
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
        {filteredCompletionOrder.map((issue, idx) => {
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

  const renderCriticalTab = () => {
    const actionableCritical = filteredCriticalPath.find(issue => !isClosedStatus(issue));
    const actionableIndex = actionableCritical ? filteredCriticalPath.indexOf(actionableCritical) : -1;
    const actionableRemainingCount = actionableIndex >= 0 ? filteredCriticalPath.slice(actionableIndex + 1).filter(issue => !isClosedStatus(issue)).length : 0;
    const actionableMessage = actionableCritical ? (actionableRemainingCount > 0 ? `Unblock ${actionableRemainingCount} item${actionableRemainingCount !== 1 ? 's' : ''} by completing ${actionableCritical.id} first.` : `Complete ${actionableCritical.id} to finish the critical path.`) : null;

    return (
      <div className="blocking-view__critical">
        <div className="blocking-view__critical-header">
          <span className="blocking-view__critical-label">
            Critical path ({filteredCriticalPath.length} items, longest dependency chain):
          </span>
          <div className="blocking-view__critical-subtitle">
            Flow: blockers start at the top, most-blocked work lands at the bottom.
          </div>
        </div>
        {actionableMessage && (
          <div className="blocking-view__critical-callout">
            <div className="blocking-view__critical-callout-text">{actionableMessage}</div>
            <div className="blocking-view__critical-callout-title">{actionableCritical.title}</div>
          </div>
        )}
        <div className="blocking-view__critical-chain">
          {filteredCriticalPath.map((issue, idx) => {
            const fanOutCount = fanOutCounts?.[issue.id] || 0;
            const fanOutLabel = fanOutCount > 0 ? `Unblocks ${fanOutCount} item${fanOutCount !== 1 ? 's' : ''}` : 'No downstream items';
            return (
              <div key={issue.id} className="blocking-view__critical-item">
                <div
                  className={`blocking-view__critical-node${actionableCritical && issue.id === actionableCritical.id ? ' blocking-view__critical-node--actionable' : ''}`}
                  onClick={() => handleNodeClick(issue)}
                >
                  <span className="blocking-view__critical-status">{getStatusIcon(issue.status)}</span>
                  <span className="blocking-view__critical-id">{issue.id}</span>
                  <span className="blocking-view__critical-title">{issue.title}</span>
                  <span className="blocking-view__critical-priority">P{issue.priority}</span>
                  {fanOutCount > 0 && (
                    <span className="blocking-view__critical-fanout" title={fanOutLabel}>🔓 {fanOutCount}</span>
                  )}
                </div>
                {idx < filteredCriticalPath.length - 1 && (
                  <div
                    className="blocking-view__critical-arrow blocking-view__critical-arrow--interactive"
                    onClick={(e) => handleEdgeClick(issue.id, filteredCriticalPath[idx + 1].id, e)}
                    title={`Edit: ${issue.id} blocks ${filteredCriticalPath[idx + 1].id}`}
                  >
                    ↓ blocks
                    {renderEdgeMenu(issue.id, filteredCriticalPath[idx + 1].id)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderParallelTab = () => (
    <div className="blocking-view__parallel">
      <div className="blocking-view__parallel-header">
        <span className="blocking-view__parallel-label">
          Work can be parallelized into {filteredParallelGroups.length} phases:
        </span>
      </div>
      {filteredParallelGroups.map((group, idx) => (
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
          <span className="blocking-view__stat">{filteredIssues.length} items</span>
          <span className="blocking-view__stat">{edges.length} blocking links</span>
          <span className="blocking-view__stat">{filteredReadyItems.length} ready</span>
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
        <button
          className={`blocking-view__tab ${activeTab === 'plan' ? 'blocking-view__tab--active' : ''}`}
          onClick={() => setActiveTab('plan')}
        >Plan</button>
      </div>

      <div className="blocking-view__content">
        {activeTab === 'graph' && renderGraphTab()}
        {activeTab === 'order' && renderOrderTab()}
        {activeTab === 'critical' && renderCriticalTab()}
        {activeTab === 'parallel' && renderParallelTab()}
        {activeTab === 'plan' && (
          <BlockingPlanView
            issues={filteredIssues}
            edges={edges}
            completionOrder={filteredCompletionOrder}
            readyIds={readyIds}
            onIssueClick={handleNodeClick}
          />
        )}
      </div>
    </div>
  );
};

export default BlockingView;

