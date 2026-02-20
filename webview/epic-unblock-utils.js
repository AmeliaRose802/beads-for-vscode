/**
 * Utilities for bulk epic-to-epic unblocking.
 *
 * When an epic-to-epic blocking relationship is created, cascading
 * blocking deps are generated between the children of the two epics.
 * These deps carry a `cascaded_from` metadata field so they can be
 * distinguished from manually-created relationships.
 *
 * This module provides helpers to discover and enumerate those
 * cascaded deps so the UI can confirm and remove them in bulk.
 */

const { getField, DEP_FROM_KEYS, DEP_TO_KEYS, DEP_TYPE_KEYS } = require('./field-utils');

/**
 * Normalise a raw dependency type string.
 * @param {string|undefined} raw - Raw type value.
 * @returns {string}
 */
function normalizeType(raw) {
  const value = String(raw || 'related').toLowerCase();
  if (value === 'parent') return 'parent-child';
  if (value === 'relates-to') return 'related';
  return value;
}

/**
 * Return the set of direct child issue IDs for a given epic.
 *
 * @param {Array} graphData - Graph components from `bd graph --all --json`.
 * @param {string} epicId - The epic issue ID.
 * @returns {Set<string>} Child issue IDs (does not include the epic itself).
 */
function findEpicChildren(graphData, epicId) {
  const children = new Set();
  if (!Array.isArray(graphData)) return children;

  graphData.forEach(component => {
    const deps = component.Dependencies || [];
    deps.forEach(dep => {
      const type = normalizeType(getField(dep, DEP_TYPE_KEYS));
      if (type !== 'parent-child') return;

      // In beads graph data: issue_id = child, depends_on_id = parent
      const childId = getField(dep, DEP_FROM_KEYS);
      const parentId = getField(dep, DEP_TO_KEYS);
      if (parentId === epicId && childId && childId !== epicId) {
        children.add(childId);
      }
    });
  });

  return children;
}

/**
 * Find all cascaded blocking deps between children of two epics.
 *
 * A dep is considered "cascaded" if it has a truthy `cascaded_from`
 * field (set during epic-to-epic block creation). Deps without that
 * field are manual and are preserved.
 *
 * @param {Array} graphData - Graph components from `bd graph --all --json`.
 * @param {string} epicA - First (blocker) epic ID.
 * @param {string} epicB - Second (blocked) epic ID.
 * @returns {{ cascadedDeps: Array<{from: string, to: string}>, manualDeps: Array<{from: string, to: string}>, childrenA: Set<string>, childrenB: Set<string> }}
 */
function findCascadedBlocks(graphData, epicA, epicB) {
  const childrenA = findEpicChildren(graphData, epicA);
  const childrenB = findEpicChildren(graphData, epicB);

  const cascadedDeps = [];
  const manualDeps = [];

  if (!Array.isArray(graphData)) {
    return { cascadedDeps, manualDeps, childrenA, childrenB };
  }

  graphData.forEach(component => {
    const deps = component.Dependencies || [];
    deps.forEach(dep => {
      const type = normalizeType(getField(dep, DEP_TYPE_KEYS));
      if (type !== 'blocks' && type !== 'blocked-by') return;

      const fromId = getField(dep, DEP_FROM_KEYS);
      const toId = getField(dep, DEP_TO_KEYS);
      if (!fromId || !toId) return;

      // Check if this dep connects children of the two epics
      const isAtoB = childrenA.has(fromId) && childrenB.has(toId);
      const isBtoA = childrenB.has(fromId) && childrenA.has(toId);
      if (!isAtoB && !isBtoA) return;

      // fromId = issue_id (blocked), toId = depends_on_id (blocker)
      // CLI expects: dep remove <blocker> --blocks <blocked>
      // So swap: from should be blocker (toId), to should be blocked (fromId)
      const entry = { from: toId, to: fromId };
      if (dep.cascaded_from) {
        cascadedDeps.push(entry);
      } else {
        manualDeps.push(entry);
      }
    });
  });

  return { cascadedDeps, manualDeps, childrenA, childrenB };
}

/**
 * Check whether a direct blocking dep exists between two epics.
 *
 * @param {Array} graphData - Graph components.
 * @param {string} epicA - Blocker epic.
 * @param {string} epicB - Blocked epic.
 * @returns {boolean}
 */
function hasDirectEpicBlock(graphData, epicA, epicB) {
  if (!Array.isArray(graphData)) return false;

  return graphData.some(component => {
    const deps = component.Dependencies || [];
    return deps.some(dep => {
      const type = normalizeType(getField(dep, DEP_TYPE_KEYS));
      if (type !== 'blocks' && type !== 'blocked-by') return false;

      const fromId = getField(dep, DEP_FROM_KEYS);
      const toId = getField(dep, DEP_TO_KEYS);
      return (fromId === epicA && toId === epicB) ||
             (fromId === epicB && toId === epicA);
    });
  });
}

module.exports = {
  findEpicChildren,
  findCascadedBlocks,
  hasDirectEpicBlock
};
