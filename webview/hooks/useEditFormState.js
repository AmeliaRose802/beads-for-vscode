import { useState } from 'react';

/**
 * Custom hook for edit panel form state management.
 * @returns {object} Edit form state and setters
 */
export function useEditFormState() {
  const [editIssueId, setEditIssueId] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState('task');
  const [editPriority, setEditPriority] = useState('2');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState('open');

  const resetEditForm = () => {
    setEditIssueId('');
    setEditTitle('');
    setEditDescription('');
    setEditType('task');
    setEditPriority('2');
    setEditStatus('open');
  };

  return {
    editIssueId,
    setEditIssueId,
    editTitle,
    setEditTitle,
    editType,
    setEditType,
    editPriority,
    setEditPriority,
    editDescription,
    setEditDescription,
    editStatus,
    setEditStatus,
    resetEditForm
  };
}
