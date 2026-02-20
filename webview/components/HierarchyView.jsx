import React, { useState, useMemo } from 'react';
import CopyableIssueId from './CopyableIssueId';
const { filterHierarchyTree, countDescendants } = require('../hierarchy-utils');

const FILTER_TYPES = [
  { key: 'parent-child', label: 'Parent' },
  { key: 'blocks', label: 'Blocks', icon: '⛔' },
  { key: 'blocked-by', label: 'Blocked by', icon: '🚧' },
  { key: 'related', label: 'Related', icon: '🔗' }
];

const relationLabels = {
  'parent-child': 'Parent',
  blocks: 'Blocks',
  'blocked-by': 'Blocked by',
  related: 'Related',
  'relates-to': 'Related'
};

const relationIcons = {
  blocks: '⛔',
  'blocked-by': '🚧',
  related: '🔗',
  'relates-to': '🔗'
};

const DEFAULT_MAX_DEPTH = 2;

/**
 * Render a single hierarchy tree node.
 * @param {{node: any, onSelect: Function, depth: number}} props - Tree node data, selection handler, and depth.
 */
function HierarchyNode({ node, onSelect, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < DEFAULT_MAX_DEPTH);
  const hasChildren = node.children && node.children.length > 0;
  const label = relationLabels[node.relationType] || (node.direction === 'incoming' ? 'Dependent' : 'Dependency');
  const icon = node.relationType === 'parent-child'
    ? null
    : relationIcons[node.relationType] || (node.direction === 'incoming' ? '⬆️' : '⬇️');

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
          {icon && <span className="hierarchy-node__icon" title={label}>{icon}</span>}
          {node.cascadedFrom && (node.relationType === 'blocks' || node.relationType === 'blocked-by') && (
            <span
              className="hierarchy-node__cascaded"
              title={`Cascaded from ${node.cascadedFrom}`}
              aria-label={`Cascaded from ${node.cascadedFrom}`}
            >
              C
            </span>
          )}
          <CopyableIssueId id={node.id} className="hierarchy-node__id" />
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
      {hasChildren && !expanded && (
        <button
          className="hierarchy-node__expand-more"
          onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
          aria-label={`Expand ${countDescendants(node)} more items`}>
          … +{countDescendants(node)} more
        </button>
      )}
      {expanded && hasChildren && (
        <div className="hierarchy-node__children">
          {node.children.map((child) => (
            <HierarchyNode key={`${node.id}-${child.id}-${child.direction}-${child.relationType}`} node={child} onSelect={onSelect} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

const HierarchyView = ({ hierarchy, onSelectIssue, onClose }) => {
  const [enabledTypes, setEnabledTypes] = useState(() =>
    new Set(FILTER_TYPES.map(t => t.key))
  );

  const toggleType = (key) => {
    setEnabledTypes(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const parentChain = hierarchy?.parentChain || [];
  const tree = hierarchy?.tree;
  const rootIssue = hierarchy?.issue;
  const hasRelationships = Boolean(tree && Array.isArray(tree.children) && tree.children.length > 0);

  const filteredTree = useMemo(() => {
    if (!tree) return tree;
    return filterHierarchyTree(tree, enabledTypes);
  }, [tree, enabledTypes]);

  const hasVisibleChildren = Boolean(
    filteredTree && Array.isArray(filteredTree.children) && filteredTree.children.length > 0
  );

  const ancestorLabels = useMemo(() => {
    if (!parentChain.length) return null;
    return parentChain.map((item, idx) => (
      <React.Fragment key={item.id}>
        <CopyableIssueId
          id={item.id}
          className="hierarchy-view__crumb"
          onClick={() => onSelectIssue(item.id)}
        />
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
              <CopyableIssueId id={rootIssue.id} className="hierarchy-view__root-id" />
              <span className="hierarchy-view__root-title">{rootIssue.title}</span>
            </div>
          )}
          {ancestorLabels && (
            <div className="hierarchy-view__breadcrumbs">
              {ancestorLabels}
            </div>
          )}
        </div>
        <div className="hierarchy-view__filter-bar" role="group" aria-label="Relationship type filters">
          {FILTER_TYPES.map(({ key, label, icon }) => (
            <label key={key} className={`hierarchy-view__filter-toggle${enabledTypes.has(key) ? ' hierarchy-view__filter-toggle--active' : ''}`}>
              <input
                type="checkbox"
                className="hierarchy-view__filter-checkbox"
                checked={enabledTypes.has(key)}
                onChange={() => toggleType(key)}
              />
              {icon && <span className="hierarchy-view__filter-icon">{icon}</span>}
              {label}
            </label>
          ))}
        </div>
        {onClose && (
          <button className="hierarchy-view__close-btn" onClick={onClose}>✕</button>
        )}
      </div>

      {tree && hasRelationships ? (
        hasVisibleChildren ? (
          <div className="hierarchy-view__tree">
            <HierarchyNode node={filteredTree} onSelect={onSelectIssue} />
          </div>
        ) : (
          <div className="hierarchy-view__empty" role="status">
            <div>No relationships match the active filters.</div>
            <div>Enable more relationship types above to see connections.</div>
          </div>
        )
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
