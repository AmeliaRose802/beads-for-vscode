/**
 * Layout calculation utilities for the dependency graph
 */

import fieldUtils from '../field-utils.js';

const {
  getField,
  DEP_TYPE_KEYS,
  DEP_ISSUE_KEYS,
  DEP_TARGET_KEYS,
  DEP_FROM_KEYS,
  DEP_TO_KEYS
} = fieldUtils;

const normalizeRelationshipType = (rawType) => {
  const value = String(rawType || 'related').toLowerCase();
  if (value === 'parent') return 'parent-child';
  if (value === 'relates-to') return 'related';
  return value;
};

/**
 * Calculates node positions using a layered layout algorithm.
 *
 * Epics act as grouping containers: all descendants of an epic are stacked
 * underneath it (within the same visual box), while the layered layout is computed
 * at the epic level to reduce visual clutter.
 */
export const calculateLayout = (data) => {
  if (!Array.isArray(data) || data.length === 0) return {};

  const positions = {};
  const NODE_WIDTH = 200;
  const NODE_HEIGHT = 60;
  const GROUP_GAP = 12;
  const INDENT_PER_LEVEL = 16;
  const MAX_INDENT_LEVEL = 2;
  const HORIZONTAL_GAP = 140;
  const VERTICAL_GAP = 60;
  const COMPONENT_GAP = 150;
  const LAYER_WIDTH = NODE_WIDTH + INDENT_PER_LEVEL * MAX_INDENT_LEVEL;

  let globalOffsetY = 50;

  data.forEach((component, componentIdx) => {
    const issues = component.Issues || [];
    const deps = component.Dependencies || [];

    const issueById = {};
    issues.forEach(issue => {
      if (issue && issue.id) {
        issueById[issue.id] = issue;
      }
    });

    const parentLookup = {};
    deps.forEach(dep => {
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
        const currentIssue = issueById[currentId];
        if (currentIssue && currentIssue.issue_type === 'epic') {
          rootEpicMemo[id] = currentId;
          return currentId;
        }
        currentId = parentLookup[currentId];
      }

      rootEpicMemo[id] = null;
      return null;
    };

    const epicMembers = {};
    Object.keys(issueById).forEach(id => {
      const epicId = rootEpicFor(id);
      if (!epicId) return;
      if (!epicMembers[epicId]) epicMembers[epicId] = [];
      epicMembers[epicId].push(id);
    });

    const repForId = (id) => rootEpicFor(id) || id;

    const repIds = Array.from(new Set(Object.keys(issueById).map(repForId)));
    const inDegree = {};
    const outEdges = {};
    repIds.forEach(id => {
      inDegree[id] = 0;
      outEdges[id] = [];
    });

    const repEdgeSet = new Set();
    deps.forEach(dep => {
      const rawFrom = getField(dep, DEP_FROM_KEYS);
      const rawTo = getField(dep, DEP_TO_KEYS);
      if (!rawFrom || !rawTo) return;
      if (!issueById[rawFrom] || !issueById[rawTo]) return;

      const from = repForId(rawFrom);
      const to = repForId(rawTo);
      if (from === to) return;

      const key = `${from}=>${to}`;
      if (repEdgeSet.has(key)) return;
      repEdgeSet.add(key);

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

    const componentStartY = globalOffsetY;

    const depthMemo = {};
    const depthWithinEpic = (nodeId, epicId) => {
      const key = `${epicId}:${nodeId}`;
      if (Object.prototype.hasOwnProperty.call(depthMemo, key)) {
        return depthMemo[key];
      }

      if (nodeId === epicId) {
        depthMemo[key] = 0;
        return 0;
      }

      let depth = 1;
      const visited = new Set([nodeId]);
      let current = parentLookup[nodeId];
      while (current && !visited.has(current) && current !== epicId) {
        visited.add(current);
        depth++;
        current = parentLookup[current];
      }

      depthMemo[key] = depth;
      return depth;
    };

    const repMembers = {};
    const repHeights = {};

    repIds.forEach(repId => {
      const repIssue = issueById[repId];
      const isEpicGroup = repIssue && repIssue.issue_type === 'epic' && Array.isArray(epicMembers[repId]) && epicMembers[repId].length > 1;

      if (!isEpicGroup) {
        repMembers[repId] = [repId];
        repHeights[repId] = NODE_HEIGHT;
        return;
      }

      const members = epicMembers[repId].slice();
      members.sort((a, b) => {
        if (a === repId) return -1;
        if (b === repId) return 1;

        const depthA = depthWithinEpic(a, repId);
        const depthB = depthWithinEpic(b, repId);
        if (depthA !== depthB) return depthA - depthB;

        const issueA = issueById[a];
        const issueB = issueById[b];
        const rank = (issue) => {
          switch (issue?.issue_type) {
            case 'feature': return 1;
            case 'task': return 2;
            case 'bug': return 2;
            case 'chore': return 3;
            default: return 4;
          }
        };

        const rankA = rank(issueA);
        const rankB = rank(issueB);
        if (rankA !== rankB) return rankA - rankB;

        const prioA = issueA?.priority ?? 4;
        const prioB = issueB?.priority ?? 4;
        if (prioA !== prioB) return prioA - prioB;

        return String(a).localeCompare(String(b));
      });

      repMembers[repId] = members;
      repHeights[repId] = members.length * NODE_HEIGHT + Math.max(0, members.length - 1) * GROUP_GAP;
    });

    const layerHeights = layers.map(layerNodes => {
      const contentHeight = layerNodes.reduce((sum, repId) => sum + (repHeights[repId] || NODE_HEIGHT), 0);
      const gapHeight = layerNodes.length > 1 ? (layerNodes.length - 1) * VERTICAL_GAP : 0;
      return contentHeight + gapHeight;
    });

    const maxHeightInComponent = layerHeights.length > 0 ? Math.max(...layerHeights) : NODE_HEIGHT;

    const componentLayers = [];
    layers.forEach((layerNodes, layerIdx) => {
      const layerHeight = layerHeights[layerIdx] || NODE_HEIGHT;

      componentLayers.push({
        x: 50 + layerIdx * (LAYER_WIDTH + HORIZONTAL_GAP),
        width: LAYER_WIDTH,
        height: Math.max(layerHeight, NODE_HEIGHT + VERTICAL_GAP),
        startY: componentStartY,
        nodeCount: layerNodes.length
      });

      const verticalOffset = (maxHeightInComponent - layerHeight) / 2;
      let cursorY = componentStartY + verticalOffset;

      layerNodes.forEach(repId => {
        const baseX = 50 + layerIdx * (LAYER_WIDTH + HORIZONTAL_GAP);
        const members = repMembers[repId] || [repId];
        const isEpicGroup = members.length > 1 && repId === members[0];
        const groupHeight = repHeights[repId] || NODE_HEIGHT;

        members.forEach((memberId, memberIdx) => {
          const depth = isEpicGroup ? depthWithinEpic(memberId, repId) : 0;
          const indentLevel = Math.min(depth, MAX_INDENT_LEVEL);
          const indent = indentLevel * INDENT_PER_LEVEL;

          positions[memberId] = {
            x: baseX + indent,
            y: cursorY + memberIdx * (NODE_HEIGHT + GROUP_GAP),
            layer: layerIdx,
            component: componentIdx,
            epicRoot: isEpicGroup ? repId : null,
            groupDepth: depth,
            layerInfo: componentLayers[layerIdx]
          };
        });

        if (isEpicGroup) {
          positions[repId] = {
            ...positions[repId],
            groupInfo: {
              members,
              height: groupHeight
            }
          };
        }

        cursorY += groupHeight + VERTICAL_GAP;
      });
    });

    globalOffsetY += maxHeightInComponent + COMPONENT_GAP;
  });

  return positions;
};
