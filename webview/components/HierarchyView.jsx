import React, { useState, useMemo } from 'react';

const relationLabels = {
  'parent-child': 'Parent',
  blocks: 'Blocks',
  'blocked-by': 'Blocked by',
  related: 'Related',
  'relates-to': 'Related'
};

const relationIcons = {
  'parent-child': '🪜',
  blocks: '⛔',
  'blocked-by': '🚧',
  related: '🔗',
  'relates-to': '🔗'
};

/**
 * Render a single hierarchy tree node.
 * @param {{node: any, onSelect: Function}} props - Tree node data and selection handler.
 */
function HierarchyNode({ node, onSelect }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const label = relationLabels[node.relationType] || (node.direction === 'incoming' ? 'Dependent' : 'Dependency');
  const icon = relationIcons[node.relationType] || (node.direction === 'incoming' ? '⬆️' : '⬇️');

  const getNodeClassName = () => {
    let className = `hierarchy-node__content hierarchy-node__content--${node.direction || 'outgoing'}`;
    if (node.isCycle) {
      className += ' hierarchy-node__content--cycle';
    } else if (node.isBackReference) {
      className += ' hierarchy-node__content--back-reference';
    }
    return className;
  };

  return (
    <div className="hierarchy-node">
      <div className="hierarchy-node__header">
        {hasChildren && (
          <button
            className="hierarchy-node__toggle"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            aria-label={expanded ? 'Collapse' : 'Expand'}>
            {expanded ? '▾' : '▸'}
          </button>
        )}
        {!hasChildren && <span className="hierarchy-node__spacer" />}
        <div
          className={getNodeClassName()}
          onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}>
          <span className="hierarchy-node__icon" title={label}>{icon}</span>
          <span className="hierarchy-node__id">{node.id}</span>
          <span className={`hierarchy-node__status hierarchy-node__status--${node.status || 'unknown'}`}>
            {node.status || 'unknown'}
          </span>
          <span className={`hierarchy-node__type hierarchy-node__type--${node.issue_type || 'task'}`}>
            {node.issue_type || 'task'}
          </span>
          {node.priority !== undefined && (
            <span className="hierarchy-node__priority">P{node.priority}</span>
          )}
          {node.isCycle && <span className="hierarchy-node__cycle">Cycle</span>}
          {node.isBackReference && <span className="hierarchy-node__visited">↩</span>}
        </div>
      </div>
      {expanded && hasChildren && (
        <div className="hierarchy-node__children">
          {node.children.map((child) => (
            <HierarchyNode key={`${node.id}-${child.id}-${child.direction}-${child.relationType}`} node={child} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

const HierarchyView = ({ hierarchy, onSelectIssue, onClose }) => {
  const parentChain = hierarchy?.parentChain || [];
  const tree = hierarchy?.tree;
  const rootIssue = hierarchy?.issue;
  const hasRelationships = Boolean(tree && Array.isArray(tree.children) && tree.children.length > 0);

  const ancestorLabels = useMemo(() => {
    if (!parentChain.length) return null;
    return parentChain.map((item, idx) => (
      <React.Fragment key={item.id}>
        <button className="hierarchy-view__crumb" onClick={() => onSelectIssue(item.id)}>
          {item.id}
        </button>
        {idx < parentChain.length - 1 && <span className="hierarchy-view__crumb-separator">/</span>}
      </React.Fragment>
    ));
  }, [parentChain, onSelectIssue]);

  return (
    <div className="hierarchy-view">
      <div className="hierarchy-view__header">
        <div>
          <div className="hierarchy-view__title">📐 Hierarchy</div>
          {rootIssue && (
            <div className="hierarchy-view__root">
              <span className="hierarchy-view__root-id">{rootIssue.id}</span>
              <span className="hierarchy-view__root-title">{rootIssue.title}</span>
            </div>
          )}
          {ancestorLabels && (
            <div className="hierarchy-view__breadcrumbs">
              {ancestorLabels}
            </div>
          )}
        </div>
        <div className="hierarchy-view__legend">
          <span className="hierarchy-view__legend-item"><span className="hierarchy-view__legend-icon">🪜</span> Parent</span>
          <span className="hierarchy-view__legend-item"><span className="hierarchy-view__legend-icon">⛔</span> Blocks</span>
          <span className="hierarchy-view__legend-item"><span className="hierarchy-view__legend-icon">🚧</span> Blocked by</span>
          <span className="hierarchy-view__legend-item"><span className="hierarchy-view__legend-icon">🔗</span> Related</span>
        </div>
        {onClose && (
          <button className="hierarchy-view__close-btn" onClick={onClose}>✕</button>
        )}
      </div>

      {tree && hasRelationships ? (
        <div className="hierarchy-view__tree">
          <HierarchyNode node={tree} onSelect={onSelectIssue} />
        </div>
      ) : (
        <div className="hierarchy-view__empty" role="status">
          <div>No relationships found for this item.</div>
          <div>Link parents, children, blockers, or related issues to populate the hierarchy.</div>
        </div>
      )}
    </div>
  );
};

export default HierarchyView;
