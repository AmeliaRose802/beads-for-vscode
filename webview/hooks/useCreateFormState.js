import { useState } from 'react';

/**
 * Custom hook for create panel form state management.
 * @returns {object} Create form state and setters
 */
export function useCreateFormState() {
  const [createTitle, setCreateTitle] = useState('');
  const [createType, setCreateType] = useState('task');
  const [createPriority, setCreatePriority] = useState('2');
  const [createDescription, setCreateDescription] = useState('');
  const [createParentId, setCreateParentId] = useState('');
  const [createBlocksId, setCreateBlocksId] = useState('');
  const [createRelatedId, setCreateRelatedId] = useState('');

  const resetCreateForm = () => {
    setCreateTitle('');
    setCreateType('task');
    setCreatePriority('2');
    setCreateDescription('');
    setCreateParentId('');
    setCreateBlocksId('');
    setCreateRelatedId('');
  };

  return {
    createTitle,
    setCreateTitle,
    createType,
    setCreateType,
    createPriority,
    setCreatePriority,
    createDescription,
    setCreateDescription,
    createParentId,
    setCreateParentId,
    createBlocksId,
    setCreateBlocksId,
    createRelatedId,
    setCreateRelatedId,
    resetCreateForm
  };
}
