import React, { useState, useRef, useEffect, useCallback } from 'react';
const { getStatusIcon } = require('../field-utils');

/**
 * DependencyGraph - Interactive visualization of issue dependencies
 * 
 * Renders a graph showing issues as nodes and dependencies as edges.
 * Supports pan/zoom, node selection, and displays dependency flow.
 */
const DependencyGraph = ({ graphData, onIssueClick, onClose }) => {
  const containerRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [nodePositions, setNodePositions] = useState({});

  // Calculate node positions using a layered layout algorithm
  const calculateLayout = useCallback((data) => {
    if (!Array.isArray(data) || data.length === 0) return {};

    const positions = {};
    const NODE_WIDTH = 200;
    const NODE_HEIGHT = 60;
    const HORIZONTAL_GAP = 80;
    const VERTICAL_GAP = 40;
    const COMPONENT_GAP = 100;

    let globalOffsetY = 50;

    data.forEach((component, componentIdx) => {
      const issues = component.Issues || [];
      const deps = component.Dependencies || [];

      // Build dependency graph for this component
      const inDegree = {};
      const outEdges = {};
      
      issues.forEach(issue => {
        inDegree[issue.id] = 0;
        outEdges[issue.id] = [];
      });

      deps.forEach(dep => {
        const from = dep.depends_on_id || dep.from_id || dep.FromID;
        const to = dep.issue_id || dep.to_id || dep.ToID;
        if (inDegree[to] !== undefined) {
          inDegree[to]++;
        }
        if (outEdges[from]) {
          outEdges[from].push(to);
        }
      });

      // Assign layers using topological sort (Kahn's algorithm)
      const layers = [];
      const queue = [];
      const layerMap = {};

      Object.keys(inDegree).forEach(id => {
        if (inDegree[id] === 0) {
          queue.push(id);
          layerMap[id] = 0;
        }
      });

      while (queue.length > 0) {
        const nodeId = queue.shift();
        const layer = layerMap[nodeId];
        
        if (!layers[layer]) layers[layer] = [];
        layers[layer].push(nodeId);

        outEdges[nodeId]?.forEach(targetId => {
          inDegree[targetId]--;
          if (inDegree[targetId] === 0) {
            queue.push(targetId);
            layerMap[targetId] = layer + 1;
          }
        });
      }

      // Handle cycles - assign remaining nodes to their own layers
      Object.keys(inDegree).forEach(id => {
        if (layerMap[id] === undefined) {
          const maxLayer = layers.length;
          if (!layers[maxLayer]) layers[maxLayer] = [];
          layers[maxLayer].push(id);
          layerMap[id] = maxLayer;
        }
      });

      // Position nodes in layers
      const componentStartY = globalOffsetY;
      let maxHeightInComponent = 0;

      layers.forEach((layerNodes, layerIdx) => {
        const layerHeight = layerNodes.length * (NODE_HEIGHT + VERTICAL_GAP);
        maxHeightInComponent = Math.max(maxHeightInComponent, layerHeight);

        layerNodes.forEach((nodeId, nodeIdx) => {
          positions[nodeId] = {
            x: 50 + layerIdx * (NODE_WIDTH + HORIZONTAL_GAP),
            y: componentStartY + nodeIdx * (NODE_HEIGHT + VERTICAL_GAP),
            layer: layerIdx,
            component: componentIdx
          };
        });
      });

      globalOffsetY += maxHeightInComponent + COMPONENT_GAP;
    });

    return positions;
  }, []);

  useEffect(() => {
    if (graphData) {
      const positions = calculateLayout(graphData);
      setNodePositions(positions);
    }
  }, [graphData, calculateLayout]);

  // Pan handlers
  const handleMouseDown = (e) => {
    if (e.target === containerRef.current || e.target.classList.contains('dependency-graph__canvas')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      setTransform(prev => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      }));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Zoom handler
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(transform.scale * delta, 0.2), 3);
    setTransform(prev => ({ ...prev, scale: newScale }));
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
          <button className="dependency-graph__close-btn" onClick={onClose}>✕</button>
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
          <button className="dependency-graph__close-btn" onClick={onClose}>✕</button>
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
          <button className="dependency-graph__close-btn" onClick={onClose}>✕</button>
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

  if (allIssues.length === 0) {
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

  const getPriorityClass = (priority) => {
    if (priority === 0) return 'priority-p0';
    if (priority === 1) return 'priority-p1';
    return 'priority-default';
  };

  const getTypeClass = (type) => {
    switch (type) {
      case 'epic': return 'type-epic';
      case 'feature': return 'type-feature';
      case 'bug': return 'type-bug';
      default: return 'type-task';
    }
  };

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
        <div className="dependency-graph__controls">
          <button className="dependency-graph__control-btn" onClick={zoomIn} title="Zoom in">+</button>
          <button className="dependency-graph__control-btn" onClick={zoomOut} title="Zoom out">−</button>
          <button className="dependency-graph__control-btn" onClick={resetView} title="Reset view">⟲</button>
          <span className="dependency-graph__zoom-level">{Math.round(transform.scale * 100)}%</span>
        </div>
        <button className="dependency-graph__close-btn" onClick={onClose}>✕</button>
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
          Drag to pan • Scroll to zoom
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
          {/* Render edges first (behind nodes) */}
          <svg className="dependency-graph__edges" width={maxX} height={maxY}>
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="var(--vscode-textLink-foreground)" />
              </marker>
            </defs>
            {allDeps.map((dep, idx) => {
              const fromId = dep.depends_on_id || dep.from_id || dep.FromID;
              const toId = dep.issue_id || dep.to_id || dep.ToID;
              const fromPos = nodePositions[fromId];
              const toPos = nodePositions[toId];
              
              if (!fromPos || !toPos) return null;

              const fromX = fromPos.x + 200; // Right edge of node
              const fromY = fromPos.y + 30;  // Center of node
              const toX = toPos.x;           // Left edge of target
              const toY = toPos.y + 30;

              // Create a curved path
              const midX = (fromX + toX) / 2;
              const controlOffset = Math.abs(toY - fromY) / 2;
              
              const isHighlighted = selectedNode === fromId || selectedNode === toId ||
                                    hoveredNode === fromId || hoveredNode === toId;

              return (
                <path
                  key={idx}
                  className={`dependency-graph__edge ${isHighlighted ? 'dependency-graph__edge--highlighted' : ''}`}
                  d={`M ${fromX} ${fromY} C ${midX + controlOffset} ${fromY}, ${midX - controlOffset} ${toY}, ${toX} ${toY}`}
                  markerEnd="url(#arrowhead)"
                />
              );
            })}
          </svg>

          {/* Render nodes */}
          {allIssues.map(issue => {
            const pos = nodePositions[issue.id];
            if (!pos) return null;

            const isSelected = selectedNode === issue.id;
            const isHovered = hoveredNode === issue.id;

            return (
              <div
                key={issue.id}
                className={`dependency-graph__node ${getPriorityClass(issue.priority)} ${getTypeClass(issue.issue_type)} ${isSelected ? 'dependency-graph__node--selected' : ''} ${isHovered ? 'dependency-graph__node--hovered' : ''}`}
                style={{ left: pos.x, top: pos.y }}
                onClick={() => handleNodeClick(issue)}
                onMouseEnter={() => setHoveredNode(issue.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                <div className="dependency-graph__node-header">
                  <span className={`dependency-graph__node-status dependency-graph__node-status--${issue.status}`}>
                    {getStatusIcon(issue.status)}
                  </span>
                  <span className="dependency-graph__node-id">{issue.id}</span>
                  <span className={`dependency-graph__node-priority dependency-graph__node-priority--p${issue.priority}`}>
                    P{issue.priority}
                  </span>
                </div>
                <div className="dependency-graph__node-title" title={issue.title}>
                  {issue.title}
                </div>
                <div className="dependency-graph__node-type">
                  {issue.issue_type}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedNode && issueMap[selectedNode] && (
        <div className="dependency-graph__details">
          <div className="dependency-graph__details-header">
            <strong>{issueMap[selectedNode].id}</strong>
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
