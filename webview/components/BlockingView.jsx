import React, { useState, useMemo, useEffect } from 'react';
import BlockingOrderTab from './BlockingOrderTab';
import BlockingGraphTab from './BlockingGraphTab';
import BlockingPlanView from './BlockingPlanView';
import DependencyGraph from './DependencyGraph';
import EdgeMenu from './EdgeMenu';
import { filterGraphDataEpicLevel, filterGraphDataTaskLevel } from './dependency-graph-utils';
import LabelDropdown from './LabelDropdown';
import IssueCard from './IssueCard';
const { copyTextToClipboard, formatIssuesForClipboard, buildPhasedClipboardText, buildPlanClipboardText } = require('../clipboard-utils');
const { isClosedStatus } = require('../field-utils');
const COPY_FEEDBACK_DURATION_MS = 2200;
const PHASE_ITEM_PREVIEW_LIMIT = 5;
/** BlockingView - Visualizes blocking relationships and suggests completion order. */
const BlockingView = ({
  blockingModel,
  graphData = null,
  onIssueClick,
  onClose,
  onDepAction,
  activeTab: controlledTab,
  onTabChange,
  issueDetails = {},
  loadingDetails = {},
  onCloseIssue,
  onReopenIssue,
  onEditIssue,
  onTypeChange,
  onPriorityChange,
  onAssigneeChange,
  onShowHierarchy,
  onPokePoke,
  pokepokeInstances,
  vscode
}) => {
  const [internalTab, setInternalTab] = useState(controlledTab || 'list');
  useEffect(() => {
    if (typeof controlledTab === 'string') {
      setInternalTab(controlledTab);
    }
  }, [controlledTab]);
  const activeTab = controlledTab || internalTab;
  const handleTabChange = (tab) => (onTabChange ? onTabChange(tab) : setInternalTab(tab));
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterLabel, setFilterLabel] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [activeEdgeMenu, setActiveEdgeMenu] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(null);
  const [expandedPhases, setExpandedPhases] = useState(() => new Set());
  useEffect(() => {
    if (!copyFeedback) return undefined;
    const timeout = setTimeout(() => setCopyFeedback(null), COPY_FEEDBACK_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [copyFeedback]);
  const showCopyFeedback = (target, message, isError = false) => setCopyFeedback({ target, message, isError });
  const readyIds = useMemo(() => {
    if (!blockingModel?.readyItems) return new Set();
    return new Set(blockingModel.readyItems.map(i => i.id));
  }, [blockingModel]);
  if (!blockingModel) {
    return (
      <div className="blocking-view blocking-view--empty">
        <div className="blocking-view__header">
          <h3 className="blocking-view__title">� Dependencies</h3>
          <button className="blocking-view__close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="blocking-view__empty-message">
          <p>Loading dependency data...</p>
        </div>
      </div>
    );
  }
  const { issues, edges, completionOrder, criticalPaths, readyItems, parallelGroups, blocksCount, blockedByCount } = blockingModel;
  const existingAssignees = useMemo(() => {
    if (!Array.isArray(issues)) return [];
    return [...new Set(issues.map(issue => issue.assignee).filter(Boolean))];
  }, [issues]);
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
  const filteredReadyItems = filterList(readyItems);
  const normalizedParallelGroups = Array.isArray(parallelGroups) ? parallelGroups : [];
  const filteredParallelGroups = (filteredIds
    ? normalizedParallelGroups.map(g => g.filter(i => filteredIds.has(i.id))).filter(g => g.length > 0)
    : normalizedParallelGroups
  );
  const formatPriority = (priority) => {
    if (priority === undefined || priority === null) return 'p2';
    const raw = String(priority).trim();
    if (!raw) return 'p2';
    return raw.toLowerCase().startsWith('p') ? raw.toLowerCase() : `p${raw}`;
  };
  const normalizeIssueForCard = (issue) => {
    if (!issue) return null;
    return {
      ...issue,
      type: issue.type || issue.issue_type || 'task',
      priority: formatPriority(issue.priority)
    };
  };
  const selectedCardIssue = useMemo(() => normalizeIssueForCard(selectedIssue), [selectedIssue]);
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
  const copyPlanToClipboard = async (plan) => {
    const formatted = buildPlanClipboardText(plan);
    if (!formatted.trim()) {
      showCopyFeedback('plan', 'Nothing to copy', true);
      return;
    }
    try {
      await copyTextToClipboard(formatted);
      showCopyFeedback('plan', 'Copied!');
    } catch (error) {
      console.error('BlockingView plan clipboard copy failed', error);
      showCopyFeedback('plan', 'Copy failed', true);
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
  const togglePhaseExpanded = (phaseIndex) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseIndex)) {
        next.delete(phaseIndex);
      } else {
        next.add(phaseIndex);
      }
      return next;
    });
  };
  const getPhasePreview = (group, phaseIndex) => {
    const isExpanded = expandedPhases.has(phaseIndex);
    const shouldToggle = group.length > PHASE_ITEM_PREVIEW_LIMIT;
    const hiddenCount = Math.max(0, group.length - PHASE_ITEM_PREVIEW_LIMIT);
    const visibleItems = !shouldToggle || isExpanded
      ? group
      : group.slice(0, PHASE_ITEM_PREVIEW_LIMIT);
    return {
      isExpanded,
      shouldToggle,
      hiddenCount,
      visibleItems
    };
  };
  const isIssueClosed = (issue) => issue && isClosedStatus(issue.status);
  const hasGraphIssues = useMemo(() => {
    if (!Array.isArray(graphData)) return false;
    return graphData.some(group => Array.isArray(group?.Issues) && group.Issues.length > 0);
  }, [graphData]);
  const epicGraphData = useMemo(() => filterGraphDataEpicLevel(graphData), [graphData]);
  const taskGraphData = useMemo(() => filterGraphDataTaskLevel(graphData), [graphData]);
  if (filteredIssues.length === 0 && !hasGraphIssues) {
    return (
      <div className="blocking-view blocking-view--empty">
        <div className="blocking-view__header">
          <h3 className="blocking-view__title">� Dependencies</h3>
          <button className="blocking-view__close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="blocking-view__empty-message">
          <p>No dependency relationships found.</p>
          <p>Link issues with dependencies to see them here.</p>
        </div>
      </div>
    );
  }
  const handleNodeClick = (issue) => {
    setSelectedNode(issue.id);
    setSelectedIssue(issue);
    if (onIssueClick) onIssueClick(issue);
  };
  const handleEdgeClick = (fromId, toId, event) => {
    event.stopPropagation();
    setActiveEdgeMenu({ fromId, toId });
  };
  const closeEdgeMenu = () => { setActiveEdgeMenu(null); };
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
      <EdgeMenu
        fromId={fromId}
        toId={toId}
        onRemove={handleRemoveLink}
        onRetarget={handleRetarget}
        onAddLink={handleAddLink}
        onClose={closeEdgeMenu}
      />
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
  return (
    <div className="blocking-view">
      <div className="blocking-view__header">
        <h3 className="blocking-view__title">� Dependencies</h3>
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
          className={`blocking-view__tab ${activeTab === 'list' ? 'blocking-view__tab--active' : ''}`}
          onClick={() => handleTabChange('list')}
        >📋 List</button>
        <button
          className={`blocking-view__tab ${activeTab === 'hierarchy' ? 'blocking-view__tab--active' : ''}`}
          onClick={() => handleTabChange('hierarchy')}
        >📐 Hierarchy</button>
        <button
          className={`blocking-view__tab ${activeTab === 'epic-graph' ? 'blocking-view__tab--active' : ''}`}
          onClick={() => handleTabChange('epic-graph')}
        >🏔 Epics</button>
        <button
          className={`blocking-view__tab ${activeTab === 'task-graph' ? 'blocking-view__tab--active' : ''}`}
          onClick={() => handleTabChange('task-graph')}
        >🔀 Tasks</button>
        <button
          className={`blocking-view__tab ${activeTab === 'plan' ? 'blocking-view__tab--active' : ''}`}
          onClick={() => handleTabChange('plan')}
        >📅 Plan</button>
      </div>
      <div className="blocking-view__content">
        {activeTab === 'list' && (
          <BlockingOrderTab
            issues={filteredCompletionOrder}
            readyIds={readyIds}
            onIssueClick={handleNodeClick}
            onCopy={copyOrderToClipboard}
            renderCopyFeedback={renderCopyFeedback}
          />
        )}
        {activeTab === 'hierarchy' && (
          <BlockingGraphTab
            parallelGroups={filteredParallelGroups}
            readyIds={readyIds}
            selectedNode={selectedNode}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onTogglePhase={togglePhaseExpanded}
            renderEdgeMenu={renderEdgeMenu}
            getPhasePreview={getPhasePreview}
            blocksCount={blocksCount}
            blockedByCount={blockedByCount}
          />
        )}
        {activeTab === 'epic-graph' && (
          <DependencyGraph
            graphData={epicGraphData}
            onIssueClick={handleNodeClick}
            showCloseButton={false}
          />
        )}
        {activeTab === 'task-graph' && (
          <DependencyGraph
            graphData={taskGraphData}
            onIssueClick={handleNodeClick}
            showCloseButton={false}
          />
        )}
        {activeTab === 'plan' && (
          <BlockingPlanView
            issues={filteredIssues}
            edges={edges}
            completionOrder={filteredCompletionOrder}
            readyIds={readyIds}
            onIssueClick={handleNodeClick}
            onCopy={copyPlanToClipboard}
            renderCopyFeedback={renderCopyFeedback}
          />
        )}
      </div>
      {selectedCardIssue && (
        <div className="blocking-view__details">
          <div className="blocking-view__details-header">
            <span className="blocking-view__details-title">Issue details</span>
            <button
              className="blocking-view__details-close"
              type="button"
              onClick={() => setSelectedIssue(null)}
            >
              ✕
            </button>
          </div>
          <div className="blocking-view__details-card">
            <IssueCard
              issue={selectedCardIssue}
              onClose={onCloseIssue ? () => onCloseIssue(selectedCardIssue.id) : undefined}
              onReopen={onReopenIssue ? () => onReopenIssue(selectedCardIssue.id) : undefined}
              onEdit={onEditIssue ? () => onEditIssue(selectedCardIssue.id) : undefined}
              onTypeChange={onTypeChange}
              onPriorityChange={onPriorityChange}
              onAssigneeChange={onAssigneeChange}
              onShowHierarchy={onShowHierarchy}
              onPokePoke={onPokePoke}
              pokepokeRunning={pokepokeInstances?.some(
                (instance) =>
                  instance.itemId === selectedCardIssue.id &&
                  (instance.state === 'running' || instance.state === 'starting')
              )}
              existingAssignees={existingAssignees}
              detailedData={issueDetails[selectedCardIssue.id]}
              isLoadingDetails={loadingDetails[selectedCardIssue.id]}
              defaultExpanded
              vscode={vscode}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default BlockingView;

