import React, { useState, useMemo, useEffect } from 'react';
import BlockingPlanView from './BlockingPlanView';
import BlockingOrderTab from './BlockingOrderTab';
import BlockingParallelTab from './BlockingParallelTab';
import CriticalPathView from './CriticalPathView';
import LabelDropdown from './LabelDropdown';
const { getStatusIcon } = require('../field-utils');
const { formatIssuesForClipboard, buildPhasedClipboardText } = require('../clipboard-utils');

const COPY_FEEDBACK_DURATION_MS = 2200;

async function copyTextToClipboard(text) {
  if (!text || !text.length) {
    throw new Error('No text to copy');
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard API unavailable');
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const succeeded = document.execCommand && document.execCommand('copy');
    if (!succeeded) {
      throw new Error('Copy command rejected');
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

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
  const [copyFeedback, setCopyFeedback] = useState(null);
  useEffect(() => {
    if (!copyFeedback) return undefined;
    const timeout = setTimeout(() => setCopyFeedback(null), COPY_FEEDBACK_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [copyFeedback]);
  const showCopyFeedback = (target, message, isError = false) => {
    setCopyFeedback({ target, message, isError });
  };
  
  const criticalPathIds = useMemo(() => {
    if (!blockingModel?.criticalPaths || !Array.isArray(blockingModel.criticalPaths)) return new Set();
    const allIds = new Set();
    blockingModel.criticalPaths.forEach(path => {
      if (Array.isArray(path)) {
        path.forEach(i => allIds.add(i.id));
      }
    });
    return allIds;
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
  const { issues, edges, completionOrder, criticalPath, criticalPaths, readyItems, parallelGroups, fanOutCounts } = blockingModel;
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
      if (hasLabel && (!Array.isArray(issue.labels) || !issue.labels.some(l => l.toLowerCase().includes(filterLabel.toLowerCase())))) return false;
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
  const filteredCriticalPaths = (filteredIds && criticalPaths)
    ? criticalPaths.map(path => path.filter(i => filteredIds.has(i.id))).filter(path => path.length > 0)
    : (criticalPaths || []);
  const filteredReadyItems = filterList(readyItems);
  const normalizedParallelGroups = Array.isArray(parallelGroups) ? parallelGroups : [];
  const filteredParallelGroups = (filteredIds
    ? normalizedParallelGroups.map(g => g.filter(i => filteredIds.has(i.id))).filter(g => g.length > 0)
    : normalizedParallelGroups
  );
  const copyIssuesToClipboard = async (issueList, target, header) => {
    const formatted = formatIssuesForClipboard(issueList || [], { header });
    if (!formatted.trim()) {
      showCopyFeedback(target, 'Nothing to copy', true);
      return;
    }
    try {
      await copyTextToClipboard(formatted);
      showCopyFeedback(target, 'Copied!');
    } catch (error) {
      console.error('BlockingView clipboard copy failed', error);
      showCopyFeedback(target, 'Copy failed', true);
    }
  };
  const copyOrderToClipboard = () => copyIssuesToClipboard(filteredCompletionOrder, 'order');
  const copyParallelGroupToClipboard = (group, index) => copyIssuesToClipboard(group, `phase-${index}`, `Phase ${index + 1}`);
  const copyAllParallelGroups = async () => {
    const text = buildPhasedClipboardText(filteredParallelGroups);
    if (!text.trim()) {
      showCopyFeedback('parallel-all', 'Nothing to copy', true);
      return;
    }
    try {
      await copyTextToClipboard(text);
      showCopyFeedback('parallel-all', 'Copied!');
    } catch (error) {
      console.error('BlockingView clipboard copy failed', error);
      showCopyFeedback('parallel-all', 'Copy failed', true);
    }
  };
  const renderCopyFeedback = (target) => {
    if (!copyFeedback || copyFeedback.target !== target) {
      return null;
    }
    const className = [
      'blocking-view__copy-feedback',
      copyFeedback.isError ? 'blocking-view__copy-feedback--error' : ''
    ].filter(Boolean).join(' ');
    return (
      <span className={className}>{copyFeedback.message}</span>
    );
  };
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

  const renderCriticalTab = () => {
    return (
      <CriticalPathView
        criticalPaths={filteredCriticalPaths}
        fanOutCounts={fanOutCounts}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        renderEdgeMenu={renderEdgeMenu}
        isClosedStatus={isClosedStatus}
      />
    );
  };
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
        {activeTab === 'order' && (
          <BlockingOrderTab
            issues={filteredCompletionOrder}
            criticalPathIds={criticalPathIds}
            readyIds={readyIds}
            onIssueClick={handleNodeClick}
            onCopy={copyOrderToClipboard}
            renderCopyFeedback={renderCopyFeedback}
          />
        )}
        {activeTab === 'critical' && renderCriticalTab()}
        {activeTab === 'parallel' && (
          <BlockingParallelTab
            parallelGroups={filteredParallelGroups}
            readyIds={readyIds}
            onIssueClick={handleNodeClick}
            onCopyGroup={copyParallelGroupToClipboard}
            onCopyAll={copyAllParallelGroups}
            renderCopyFeedback={renderCopyFeedback}
          />
        )}
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

