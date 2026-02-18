/**
 * Layout calculation utilities for the dependency graph
 */

/**
 * Calculates node positions using a layered layout algorithm
 */
export const calculateLayout = (data) => {
  if (!Array.isArray(data) || data.length === 0) return {};

  const positions = {};
  const NODE_WIDTH = 200;
  const NODE_HEIGHT = 60;
  const HORIZONTAL_GAP = 120; // Increased from 80
  const VERTICAL_GAP = 60;    // Increased from 40
  const COMPONENT_GAP = 150;  // Increased from 100

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
    const componentLayers = []; // Track layer info for visual separation

    layers.forEach((layerNodes, layerIdx) => {
      const layerHeight = layerNodes.length * (NODE_HEIGHT + VERTICAL_GAP);
      maxHeightInComponent = Math.max(maxHeightInComponent, layerHeight);

      // Store layer info for visual styling
      componentLayers.push({
        x: 50 + layerIdx * (NODE_WIDTH + HORIZONTAL_GAP),
        width: NODE_WIDTH,
        height: Math.max(layerHeight, NODE_HEIGHT + VERTICAL_GAP),
        startY: componentStartY,
        nodeCount: layerNodes.length
      });

      layerNodes.forEach((nodeId, nodeIdx) => {
        // Center nodes vertically if layer has fewer nodes
        const totalLayerHeight = layerNodes.length * (NODE_HEIGHT + VERTICAL_GAP) - VERTICAL_GAP;
        const availableHeight = Math.max(totalLayerHeight, maxHeightInComponent);
        const verticalOffset = (availableHeight - totalLayerHeight) / 2;

        positions[nodeId] = {
          x: 50 + layerIdx * (NODE_WIDTH + HORIZONTAL_GAP),
          y: componentStartY + verticalOffset + nodeIdx * (NODE_HEIGHT + VERTICAL_GAP),
          layer: layerIdx,
          component: componentIdx,
          layerInfo: componentLayers[layerIdx] // Add layer info for styling
        };
      });
    });

    globalOffsetY += maxHeightInComponent + COMPONENT_GAP;
  });

  return positions;
};