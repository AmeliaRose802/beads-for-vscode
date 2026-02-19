import { useState } from 'react';

/**
 * Custom hook for relationship panel form state management.
 * @returns {object} Relationship form state and setters
 */
export function useRelationshipFormState() {
  const [sourceBead, setSourceBead] = useState('');
  const [targetBead, setTargetBead] = useState('');
  const [relationType, setRelationType] = useState('parent');

  const resetRelationshipForm = () => {
    setSourceBead('');
    setTargetBead('');
  };

  return {
    sourceBead,
    setSourceBead,
    targetBead,
    setTargetBead,
    relationType,
    setRelationType,
    resetRelationshipForm
  };
}
