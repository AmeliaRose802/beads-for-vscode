import React, { useState, useRef, useEffect, useCallback } from 'react';
import CopyableIssueId from './CopyableIssueId';
import DependencyGraphFilters from './DependencyGraphFilters';
import DependencyGraphNode from './DependencyGraphNode';
import { shouldShowNode, shouldShowEdge, calculateBlockingCounts } from './dependency-graph-utils';
import { calculateLayout } from './dependency-graph-layout';
const { classifyWheelGesture, clampScale } = require('../graph-gestures');

/**
 * DependencyGraph - Interactive visualization of issue dependencies
 * 
 * Renders a graph showing issues as nodes and dependencies as edges.
 * Supports pan/zoom, node selection, and displays dependency flow.
 */
const DependencyGraph = ({ graphData, onIssueClick, onClose, showCloseButton = true }) => {
  const containerRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [nodePositions, setNodePositions] = useState({});
  const [filters, setFilters] = useState({
    showCompleted: true,
    showBlocked: true,
    showHighPriorityOnly: false,
    focusMode: false
  });
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

  // Pan handlers
  const handleMouseDown = (e) => {
    if (e.target === containerRef.current || e.target.classList.contains('dependency-graph__canvas')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };
  const handleMouseMove = (e) => {
    if (isPanning) {
      const newX = e.clientX - panStart.x;
      const newY = e.clientY - panStart.y;
      
      // Get container bounds for constraint calculation
      const container = containerRef.current;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const canvasWidth = maxX * transform.scale;
        const canvasHeight = maxY * transform.scale;
        
        // Constrain panning to keep some content visible
        const minX = Math.min(0, containerRect.width - canvasWidth - 100);
        const maxXPos = Math.max(0, 100);
        const minY = Math.min(0, containerRect.height - canvasHeight - 100);
        const maxYPos = Math.max(0, 100);
        
        setTransform(prev => ({
          ...prev,
          x: Math.max(minX, Math.min(newX, maxXPos)),
          y: Math.max(minY, Math.min(newY, maxYPos))
        }));
      } else {
        setTransform(prev => ({
          ...prev,
          x: newX,
          y: newY
        }));
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Zoom handler
  const handleWheel = (e) => {
    const { deltaX, deltaY } = e;
    const intent = classifyWheelGesture(e);

    if (intent === 'zoom') {
      e.preventDefault();
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const multiplier = deltaY > 0 ? 0.9 : 1.1;
        const newScale = clampScale(transform.scale * multiplier);
        const scaleDelta = newScale / transform.scale;
        
        // Adjust position to zoom toward mouse cursor
        setTransform(prev => ({
          x: mouseX - (mouseX - prev.x) * scaleDelta,
          y: mouseY - (mouseY - prev.y) * scaleDelta,
          scale: newScale
        }));
      }
      return;
    }

    e.preventDefault();
    setTransform(prev => ({
      ...prev,
      x: prev.x - deltaX,
      y: prev.y - deltaY
    }));
  };

  const handleNodeClick = (issue) => {
    setSelectedNode(issue.id);
    if (onIssueClick) {
      onIssueClick(issue);
    }
  };

  const resetView = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
  };

  const zoomIn = () => {
    setTransform(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 3) }));
  };

  const zoomOut = () => {
    setTransform(prev => ({ ...prev, scale: Math.max(prev.scale / 1.2, 0.2) }));
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
  const visibleDeps = allDeps.filter(dep => shouldShowEdge(dep, issueMap, nodeFilter));

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

  // Calculate SVG dimensions based on node positions
  const positionValues = Object.values(nodePositions);
  const maxX = positionValues.length > 0 
    ? Math.max(...positionValues.map(p => p.x)) + 250 
    : 1000;
  const maxY = positionValues.length > 0 
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

      <div className="dependency-graph__legend">
        <span className="dependency-graph__legend-item">
          <span className="dependency-graph__legend-icon dependency-graph__legend-icon--open">○</span> Open
        </span>
        <span className="dependency-graph__legend-item">
          <span className="dependency-graph__legend-icon dependency-graph__legend-icon--in-progress">◐</span> In Progress
        </span>
        <span className="dependency-graph__legend-item">
          <span className="dependency-graph__legend-icon dependency-graph__legend-icon--blocked">●</span> Blocked
        </span>
        <span className="dependency-graph__legend-item">
          <span className="dependency-graph__legend-icon dependency-graph__legend-icon--closed">✓</span> Closed
        </span>
        <span className="dependency-graph__legend-separator">|</span>
        <span className="dependency-graph__legend-item dependency-graph__legend-item--hint">
          Drag or scroll to pan • Pinch/ctrl+scroll to zoom
        </span>
      </div>

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
            width: maxX,
            height: maxY
          }}
        >
          {/* Render layer backgrounds first (behind edges and nodes) */}
          {Object.values(nodePositions).reduce((layers, pos) => {
            if (pos.layerInfo && !layers.some(layer => layer.x === pos.layerInfo.x && layer.component === pos.component)) {
              layers.push({
                x: pos.layerInfo.x - 10,
                width: pos.layerInfo.width + 20,
                startY: pos.layerInfo.startY,
                height: pos.layerInfo.height,
                layer: pos.layer,
                component: pos.component
              });
            }
            return layers;
          }, []).map((layer, idx) => (
            <div
              key={`layer-${layer.component}-${layer.layer}`}
              className={`dependency-graph__layer-background ${layer.layer % 2 === 0 ? 'dependency-graph__layer-background--even' : 'dependency-graph__layer-background--odd'}`}
              style={{
                position: 'absolute',
                left: layer.x,
                top: layer.startY,
                width: layer.width,
                height: layer.height,
                zIndex: -2
              }}
            />
          ))}

          {/* Render edges first (behind nodes) */}
          <svg className="dependency-graph__edges" width={maxX} height={maxY}>
            <defs>
              <marker
                id="arrowhead"
                markerWidth="12"
                markerHeight="9"
                refX="11"
                refY="4.5"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <polygon points="0 0, 12 4.5, 0 9" fill="currentColor" />
              </marker>
              <marker
                id="arrowhead-high-priority"
                markerWidth="12"
                markerHeight="9"
                refX="11"
                refY="4.5"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <polygon points="0 0, 12 4.5, 0 9" fill="var(--vscode-errorForeground)" />
              </marker>
            </defs>
            {visibleDeps.map((dep, idx) => {
              const fromId = dep.depends_on_id || dep.from_id || dep.FromID;
              const toId = dep.issue_id || dep.to_id || dep.ToID;
              const fromPos = nodePositions[fromId];
              const toPos = nodePositions[toId];
              
              if (!fromPos || !toPos) return null;

              const fromX = fromPos.x + 200; // Right edge of node
              const fromY = fromPos.y + 30;  // Center of node
              const toX = toPos.x;           // Left edge of target
              const toY = toPos.y + 30;

              // Create orthogonal (right-angle) path to avoid overlaps
              const isHighlighted = selectedNode === fromId || selectedNode === toId ||
                                    hoveredNode === fromId || hoveredNode === toId;

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

              let pathData;
              if (Math.abs(fromY - toY) < 10) {
                // Nodes on same level - simple horizontal line
                pathData = `M ${fromX} ${fromY} L ${toX} ${toY}`;
              } else {
                // Nodes on different levels - orthogonal routing
                const horizontalGap = toX - fromX;
                const verticalOffset = toY - fromY;
                
                if (horizontalGap > 60) {
                  // Standard case: enough horizontal space
                  const midX = fromX + Math.max(40, horizontalGap / 2);
                  pathData = `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`;
                } else {
                  // Tight space or reverse direction - route around
                  const routeX = fromX + 25;
                  const clearanceY = verticalOffset > 0 ? toY + 45 : toY - 45;
                  pathData = `M ${fromX} ${fromY} L ${routeX} ${fromY} L ${routeX} ${clearanceY} L ${toX - 25} ${clearanceY} L ${toX - 25} ${toY} L ${toX} ${toY}`;
                }
              }

              return (
                <path
                  key={idx}
                  className={`dependency-graph__edge ${isHighlighted ? 'dependency-graph__edge--highlighted' : ''} ${priorityClass} ${completedClass}`}
                  d={pathData}
                  markerEnd={edgePriority <= 1 ? "url(#arrowhead-high-priority)" : "url(#arrowhead)"}
                />
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

            return (
              <DependencyGraphNode
                key={issue.id}
                issue={issue}
                position={pos}
                isSelected={isSelected}
                isHovered={isHovered}
                isCompleted={isCompleted}
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

      {selectedNode && issueMap[selectedNode] && (
        <div className="dependency-graph__details">
          <div className="dependency-graph__details-header">
            <CopyableIssueId id={issueMap[selectedNode].id} className="dependency-graph__details-id" />
            <button 
              className="dependency-graph__details-close" 
              onClick={() => setSelectedNode(null)}
            >
              ✕
            </button>
          </div>
          <div className="dependency-graph__details-title">
            {issueMap[selectedNode].title}
          </div>
          <div className="dependency-graph__details-meta">
            <span className={`dependency-graph__details-badge dependency-graph__details-badge--${issueMap[selectedNode].issue_type}`}>
              {issueMap[selectedNode].issue_type}
            </span>
            <span className={`dependency-graph__details-badge dependency-graph__details-badge--p${issueMap[selectedNode].priority}`}>
              P{issueMap[selectedNode].priority}
            </span>
            <span className={`dependency-graph__details-status dependency-graph__details-status--${issueMap[selectedNode].status}`}>
              {issueMap[selectedNode].status}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DependencyGraph;
