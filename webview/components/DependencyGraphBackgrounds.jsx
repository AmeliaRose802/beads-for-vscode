import React from 'react';

const collectLayers = (nodePositions) => {
  return Object.values(nodePositions).reduce((layers, pos) => {
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
  }, []);
};

const DependencyGraphBackgrounds = ({ nodePositions, visibleIssues }) => {
  const layers = collectLayers(nodePositions);

  return (
    <>
      {/* Render layer backgrounds first (behind edges and nodes) */}
      {layers.map(layer => (
        <div
          key={`layer-${layer.component}-${layer.layer}`}
          className={`dependency-graph__layer-background ${layer.layer % 2 === 0 ? 'dependency-graph__layer-background--even' : 'dependency-graph__layer-background--odd'}`}
          style={{
            left: layer.x,
            top: layer.startY,
            width: layer.width,
            height: layer.height
          }}
        />
      ))}

      {/* Render epic grouping containers (behind edges and nodes) */}
      {visibleIssues
        .filter(issue => issue.issue_type === 'epic' && nodePositions[issue.id]?.groupInfo)
        .map(issue => {
          const groupInfo = nodePositions[issue.id].groupInfo;
          const members = Array.isArray(groupInfo?.members) ? groupInfo.members : [issue.id];
          const memberPositions = members.map(id => nodePositions[id]).filter(Boolean);
          if (memberPositions.length === 0) return null;

          const minX = Math.min(...memberPositions.map(p => p.x));
          const maxXInGroup = Math.max(...memberPositions.map(p => p.x));
          const left = minX - 12;
          const top = nodePositions[issue.id].y - 12;
          const width = (maxXInGroup - minX) + 200 + 24;
          const height = (groupInfo?.height || 60) + 24;

          return (
            <div
              key={`epic-group-${issue.id}`}
              className="dependency-graph__epic-group"
              style={{ left, top, width, height }}
            />
          );
        })}
    </>
  );
};

export default DependencyGraphBackgrounds;
