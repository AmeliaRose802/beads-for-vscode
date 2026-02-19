import { useState, useRef } from 'react';

/**
 * Custom hook for panel visibility state management.
 * @returns {object} Panel visibility state, setters, and refs
 */
export function usePanelVisibility() {
  const [showRelationshipPanel, setShowRelationshipPanel] = useState(false);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showHierarchyView, setShowHierarchyView] = useState(false);
  const [showBlockingView, setShowBlockingView] = useState(false);
  const [activeBlockingTab, setActiveBlockingTab] = useState('list');

  const graphPurposeRef = useRef(null);
  const hierarchyIssueRef = useRef(null);

  const updateGraphPurpose = (purpose) => {
    graphPurposeRef.current = purpose;
  };

  const updateHierarchyIssue = (issueId) => {
    hierarchyIssueRef.current = issueId;
  };

  const closeAllPanels = () => {
    setShowRelationshipPanel(false);
    setShowCreatePanel(false);
    setShowEditPanel(false);
    setShowHierarchyView(false);
    setShowBlockingView(false);
  };

  return {
    showRelationshipPanel,
    setShowRelationshipPanel,
    showCreatePanel,
    setShowCreatePanel,
    showEditPanel,
    setShowEditPanel,
    showHierarchyView,
    setShowHierarchyView,
    showBlockingView,
    setShowBlockingView,
    activeBlockingTab,
    setActiveBlockingTab,
    graphPurposeRef,
    hierarchyIssueRef,
    updateGraphPurpose,
    updateHierarchyIssue,
    closeAllPanels
  };
}
