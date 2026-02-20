import React, { useState, useRef, useEffect, useCallback } from 'react';
import DependencyGraphFilters from './DependencyGraphFilters';
import DependencyGraphLegend from './DependencyGraphLegend';
import DependencyGraphBackgrounds from './DependencyGraphBackgrounds';
import DependencyGraphNode from './DependencyGraphNode';
import DependencyGraphDetails from './DependencyGraphDetails';
import { shouldShowNode, shouldShowEdge, calculateBlockingCounts } from './dependency-graph-utils';
import { calculateLayout } from './dependency-graph-layout';
import usePanZoom from '../hooks/usePanZoom';
const { getField, normalizeRelationshipType, DEP_TYPE_KEYS, DEP_ISSUE_KEYS, DEP_TARGET_KEYS } = require('../field-utils');

/**
 * Calculate a smooth bezier curve path for edges.
 * Uses cubic bezier curves to create visually distinct paths that help reduce visual clutter.
 */
const calculateBezierPath = (fromX, fromY, toX, toY) => {
  const horizontalGap = toX - fromX;
  const verticalOffset = toY - fromY;
  
  if (Math.abs(verticalOffset) < 10) {
    // Nodes on same level - simple horizontal bezier
    const controlOffset = Math.abs(horizontalGap) * 0.5;
    return `M ${fromX} ${fromY} C ${fromX + controlOffset} ${fromY}, ${toX - controlOffset} ${toY}, ${toX} ${toY}`;
  }
  
  if (horizontalGap > 60) {
    // Standard case: enough horizontal space - smooth S-curve
    const midX = fromX + Math.max(40, horizontalGap / 2);
    const controlOffset = Math.min(40, Math.abs(horizontalGap) * 0.3);
    
    return `M ${fromX} ${fromY} ` +
           `C ${fromX + controlOffset} ${fromY}, ${midX - controlOffset} ${fromY}, ${midX} ${fromY} ` +
           `S ${midX + controlOffset} ${toY}, ${toX} ${toY}`;
  } else {
    // Tight space or reverse direction - route around with smooth curves
    const routeX = fromX + 25;
    const clearanceY = verticalOffset > 0 ? toY + 45 : toY - 45;
    const controlOffset = 15;
    
    return `M ${fromX} ${fromY} ` +
           `L ${routeX} ${fromY} ` +
           `C ${routeX} ${fromY + controlOffset * Math.sign(verticalOffset)}, ${routeX} ${clearanceY - controlOffset * Math.sign(verticalOffset)}, ${routeX} ${clearanceY} ` +
           `L ${toX - 25} ${clearanceY} ` +
           `C ${toX - 25} ${clearanceY + controlOffset * Math.sign(verticalOffset)}, ${toX - 25} ${toY - controlOffset * Math.sign(verticalOffset)}, ${toX - 25} ${toY} ` +
           `L ${toX} ${toY}`;
  }
};

/**
 * DependencyGraph - Interactive visualization of issue dependencies
 * 
 * Renders a graph showing issues as nodes and dependencies as edges.
 * Supports pan/zoom, node selection, and displays dependency flow.
 */
const DependencyGraph = ({ graphData, onIssueClick, onClose, showCloseButton = true, onEdgeClick }) => {
  const containerRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [nodePositions, setNodePositions] = useState({});
  const [filters, setFilters] = useState({
    showCompleted: true,
    showBlocked: true,
    showHighPriorityOnly: false,
    focusMode: false
  });

  // Calculate SVG dimensions based on node positions
  const positionValues = Object.values(nodePositions);
  const maxX = positionValues.length > 0 
    ? Math.max(...positionValues.map(p => p.x)) + 250 
    : 1000;
  const maxY = positionValues.length > 0 
    ? Math.max(...positionValues.map(p => p.y)) + 100 
    : 1000;

  // Use pan/zoom hook
  const {
    transform,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    resetView,
    zoomIn,
    zoomOut
  } = usePanZoom(containerRef, { maxX, maxY });

  const renderCloseButton = () => {
    if (!showCloseButton || typeof onClose !== 'function') {
      return null;
    }
    return (
      <button className="dependency-graph__close-btn" onClick={onClose}>✕</button>
    );
  };
  // Calculate node positions using a layered layout algorithm
  const calculateLayoutCallback = useCallback(calculateLayout, []);

  useEffect(() => {
    if (graphData) {
      const positions = calculateLayoutCallback(graphData);
      setNodePositions(positions);
    }
  }, [graphData, calculateLayoutCallback]);

  const handleNodeClick = (issue) => {
    setSelectedNode(issue.id);
    if (onIssueClick) {
      onIssueClick(issue);
    }
  };

  if (!graphData) {
    return (
      <div className="dependency-graph dependency-graph--empty">
        <div className="dependency-graph__header">
          <h3 className="dependency-graph__title">📊 Dependency Graph</h3>
          {renderCloseButton()}
        </div>
        <div className="dependency-graph__empty-message">
          <p>Loading graph data...</p>
        </div>
      </div>
    );
  }

  if (!Array.isArray(graphData)) {
    return (
      <div className="dependency-graph dependency-graph--empty">
        <div className="dependency-graph__header">
          <h3 className="dependency-graph__title">📊 Dependency Graph</h3>
          {renderCloseButton()}
        </div>
        <div className="dependency-graph__empty-message">
          <p>Error: Invalid graph data format.</p>
          <p>Expected an array but got: {typeof graphData}</p>
        </div>
      </div>
    );
  }

  if (graphData.length === 0) {
    return (
      <div className="dependency-graph dependency-graph--empty">
        <div className="dependency-graph__header">
          <h3 className="dependency-graph__title">📊 Dependency Graph</h3>
          {renderCloseButton()}
        </div>
        <div className="dependency-graph__empty-message">
          <p>No dependency data available.</p>
          <p>Create some issues and link them to see the graph.</p>
        </div>
      </div>
    );
  }

  // Collect all issues and dependencies
  const allIssues = [];
  const allDeps = [];
  const issueMap = {};

  graphData.forEach(component => {
    (component.Issues || []).forEach(issue => {
      allIssues.push(issue);
      issueMap[issue.id] = issue;
    });
    (component.Dependencies || []).forEach(dep => {
      allDeps.push(dep);
    });
  });

  // Calculate blocking counts for each issue
  const { blocksCount, blockedByCount } = calculateBlockingCounts(allIssues, allDeps);

  // Filter nodes and edges based on current filters
  const nodeFilter = (issue) => shouldShowNode(issue, filters, selectedNode, allDeps);
  const visibleIssues = allIssues.filter(nodeFilter);
  const visibleIssueIds = new Set(visibleIssues.map(issue => issue.id));

  const parentLookup = {};
  allDeps.forEach(dep => {
    const type = normalizeRelationshipType(getField(dep, DEP_TYPE_KEYS));
    if (type !== 'parent-child') return;

    const childId = getField(dep, DEP_ISSUE_KEYS);
    const parentId = getField(dep, DEP_TARGET_KEYS);
    if (childId && parentId) {
      parentLookup[childId] = parentId;
    }
  });

  const rootEpicMemo = {};
  const rootEpicFor = (id) => {
    if (Object.prototype.hasOwnProperty.call(rootEpicMemo, id)) {
      return rootEpicMemo[id];
    }

    const visited = new Set();
    let currentId = id;
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const issue = issueMap[currentId];
      if (issue && issue.issue_type === 'epic') {
        rootEpicMemo[id] = currentId;
        return currentId;
      }
      currentId = parentLookup[currentId];
    }

    rootEpicMemo[id] = null;
    return null;
  };

  const blockingTypes = new Set(['blocks', 'blocked-by']);
  const visibleDeps = [];
  const edgeKeySet = new Set();

  allDeps.forEach(dep => {
    if (!shouldShowEdge(dep, issueMap, nodeFilter)) return;

    const originalFromId = dep.depends_on_id || dep.from_id || dep.FromID;
    const originalToId = dep.issue_id || dep.to_id || dep.ToID;
    if (!originalFromId || !originalToId) return;

    const depType = normalizeRelationshipType(getField(dep, DEP_TYPE_KEYS));

    // Hide internal parent-child edges; they are implied by epic grouping containers.
    if (depType === 'parent-child') {
      const fromEpic = rootEpicFor(originalFromId);
      const toEpic = rootEpicFor(originalToId);
      if (fromEpic && fromEpic === toEpic) {
        return;
      }
    }

    let fromId = originalFromId;
    let toId = originalToId;

    // Collapse outgoing blocking edges from epic descendants into a single epic edge.
    if (blockingTypes.has(depType)) {
      const fromEpic = rootEpicFor(originalFromId);
      const toEpic = rootEpicFor(originalToId);

      if (fromEpic && fromEpic !== originalFromId && toEpic !== fromEpic && visibleIssueIds.has(fromEpic)) {
        fromId = fromEpic;
      }
    }

    const cascadedFrom = dep.cascaded_from || dep.cascadedFrom || dep.CascadedFrom;
    const cascadedKey = blockingTypes.has(depType) ? (cascadedFrom ? 'cascaded' : 'manual') : '';

    const key = blockingTypes.has(depType)
      ? `${fromId}|${toId}|${depType}|${cascadedKey}`
      : `${fromId}|${toId}|${depType}`;

    if (edgeKeySet.has(key)) return;
    edgeKeySet.add(key);

    visibleDeps.push({ ...dep, __fromId: fromId, __toId: toId, __type: depType, __cascadedFrom: cascadedFrom });
  });

  if (visibleIssues.length === 0) {
    return (
      <div className="dependency-graph dependency-graph--empty">
        <div className="dependency-graph__header">
          <h3 className="dependency-graph__title">📊 Dependency Graph</h3>
          <button className="dependency-graph__close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="dependency-graph__empty-message">
          <p>No issues found in graph data.</p>
        </div>
      </div>
    );
  }

  // Calculate SVG dimensions based on node positions (for rendering)
  const renderMaxX = positionValues.length > 0 
    ? Math.max(...positionValues.map(p => p.x)) + 250 
    : 1000;
  const renderMaxY = positionValues.length > 0 
    ? Math.max(...positionValues.map(p => p.y)) + 100 
    : 1000;

  return (
    <div className="dependency-graph">
      <div className="dependency-graph__header">
        <h3 className="dependency-graph__title">📊 Dependency Graph</h3>
        
        <DependencyGraphFilters 
          filters={filters} 
          onFiltersChange={setFilters}
        />
        
        <div className="dependency-graph__controls">
          <button className="dependency-graph__control-btn" onClick={zoomIn} title="Zoom in">+</button>
          <button className="dependency-graph__control-btn" onClick={zoomOut} title="Zoom out">−</button>
          <button className="dependency-graph__control-btn" onClick={resetView} title="Reset view">⟲</button>
          <span className="dependency-graph__zoom-level">{Math.round(transform.scale * 100)}%</span>
        </div>
        {renderCloseButton()}
      </div>

      <DependencyGraphLegend />

      <div
        ref={containerRef}
        className="dependency-graph__container"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          className="dependency-graph__canvas"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            width: renderMaxX,
            height: renderMaxY
          }}
        >
          <DependencyGraphBackgrounds
            nodePositions={nodePositions}
            visibleIssues={visibleIssues}
          />

          {/* Render edges first (behind nodes) */}
          <svg className="dependency-graph__edges" width={renderMaxX} height={renderMaxY}>
            <defs>
              <marker
                id="arrowhead"
                markerWidth="14"
                markerHeight="11"
                refX="13"
                refY="5.5"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <polygon points="0 0, 14 5.5, 0 11" fill="currentColor" />
              </marker>
              <marker
                id="arrowhead-high-priority"
                markerWidth="14"
                markerHeight="11"
                refX="13"
                refY="5.5"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <polygon points="0 0, 14 5.5, 0 11" fill="var(--vscode-errorForeground)" />
              </marker>
            </defs>
            {visibleDeps.map((dep, idx) => {
              const fromId = dep.__fromId || dep.depends_on_id || dep.from_id || dep.FromID;
              const toId = dep.__toId || dep.issue_id || dep.to_id || dep.ToID;
              const fromPos = nodePositions[fromId];
              const toPos = nodePositions[toId];
              
              if (!fromPos || !toPos) return null;

              const fromX = fromPos.x + 200; // Right edge of node
              const fromY = fromPos.y + 30;  // Center of node
              const toX = toPos.x;           // Left edge of target
              const toY = toPos.y + 30;

              // Check if this edge is connected to the hovered or selected node
              const isConnectedToSelected = selectedNode === fromId || selectedNode === toId;
              const isConnectedToHovered = hoveredNode === fromId || hoveredNode === toId;
              const isHighlighted = isConnectedToSelected || isConnectedToHovered;
              const isDimmed = (hoveredNode && !isConnectedToHovered) || (selectedNode && !isConnectedToSelected && !hoveredNode);

              // Determine edge priority for styling
              const fromIssue = issueMap[fromId];
              const toIssue = issueMap[toId];
              const edgePriority = fromIssue && toIssue ? Math.min(fromIssue.priority || 4, toIssue.priority || 4) : 4;
              const priorityClass = edgePriority <= 1 ? 'dependency-graph__edge--high-priority' : '';
              
              // Check if edge involves completed items
              const isFromCompleted = fromIssue && (fromIssue.status === 'closed' || fromIssue.status === 'done');
              const isToCompleted = toIssue && (toIssue.status === 'closed' || toIssue.status === 'done');
              const isCompletedEdge = isFromCompleted || isToCompleted;
              const completedClass = isCompletedEdge ? 'dependency-graph__edge--completed' : '';

              const depType = dep.__type || normalizeRelationshipType(getField(dep, DEP_TYPE_KEYS));
              const typeClass = depType ? `dependency-graph__edge--${depType}` : '';
              const dimmedClass = isDimmed ? 'dependency-graph__edge--dimmed' : '';

              const cascadedFrom = dep.__cascadedFrom || dep.cascaded_from || dep.cascadedFrom || dep.CascadedFrom;
              const cascadedClass = cascadedFrom && (depType === 'blocks' || depType === 'blocked-by')
                ? 'dependency-graph__edge--cascaded'
                : '';

              // Use bezier curves for smoother, more distinguishable paths
              const pathData = calculateBezierPath(fromX, fromY, toX, toY);

              const edgeClickable = typeof onEdgeClick === 'function';
              const edgeTitle = cascadedFrom
                ? `${depType || 'related'} (cascaded)\nCascaded from ${cascadedFrom}`
                : (depType || 'related');

              return (
                <path
                  key={idx}
                  className={`dependency-graph__edge ${isHighlighted ? 'dependency-graph__edge--highlighted' : ''} ${priorityClass} ${completedClass} ${typeClass} ${cascadedClass} ${dimmedClass} ${edgeClickable ? 'dependency-graph__edge--clickable' : ''}`}
                  d={pathData}
                  markerEnd={edgePriority <= 1 ? "url(#arrowhead-high-priority)" : "url(#arrowhead)"}
                  onClick={edgeClickable ? (e) => onEdgeClick(fromId, toId, e) : undefined}
                >
                  <title>{edgeTitle}</title>
                </path>
              );
            })}
          </svg>

          {/* Render nodes */}
          {visibleIssues.map(issue => {
            const pos = nodePositions[issue.id];
            if (!pos) return null;

            const isSelected = selectedNode === issue.id;
            const isHovered = hoveredNode === issue.id;
            const isCompleted = issue.status === 'closed' || issue.status === 'done';
            const isEpicChild = pos.epicRoot && pos.epicRoot !== issue.id;

            return (
              <DependencyGraphNode
                key={issue.id}
                issue={issue}
                position={pos}
                isSelected={isSelected}
                isHovered={isHovered}
                isCompleted={isCompleted}
                isEpicChild={isEpicChild}
                blockedByCount={blockedByCount[issue.id] || 0}
                blocksCount={blocksCount[issue.id] || 0}
                onClick={handleNodeClick}
                onMouseEnter={setHoveredNode}
                onMouseLeave={setHoveredNode}
              />
            );
          })}
        </div>
      </div>

      {selectedNode && (
        <DependencyGraphDetails
          issue={issueMap[selectedNode]}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
};

export default DependencyGraph;
