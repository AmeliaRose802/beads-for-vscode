import { useCallback, useRef, useState } from 'react';

/**
 * Track pending bd commands so the UI can render progress indicators.
 * @returns {{ pendingOperations: Array<{id: string, label: string, scope: 'primary'|'inline'|'background'}>, beginCommandProgress: Function, completeCommandProgress: Function }}
 */
export function useCommandProgress() {
  const [pendingOperations, setPendingOperations] = useState([]);
  const registryRef = useRef(new Map());
  const seqRef = useRef(0);

  const beginCommandProgress = useCallback((command, scope = 'primary') => {
    if (!command) {
      return;
    }
    const normalizedCommand = command.trim();
    if (!normalizedCommand) {
      return;
    }
    const id = `${scope}-${seqRef.current++}`;
    const label = normalizedCommand.startsWith('bd ')
      ? normalizedCommand
      : `bd ${normalizedCommand}`;
    setPendingOperations((prev) => [...prev, { id, label, scope }]);
    const queue = registryRef.current.get(normalizedCommand) || [];
    registryRef.current.set(normalizedCommand, [...queue, id]);
  }, [setPendingOperations]);

  const completeCommandProgress = useCallback((command) => {
    if (!command) {
      return;
    }
    const normalizedCommand = command.trim();
    if (!normalizedCommand) {
      return;
    }
    const queue = registryRef.current.get(normalizedCommand);
    if (!queue || queue.length === 0) {
      return;
    }
    const [id, ...rest] = queue;
    if (rest.length > 0) {
      registryRef.current.set(normalizedCommand, rest);
    } else {
      registryRef.current.delete(normalizedCommand);
    }
    setPendingOperations((prev) => prev.filter((entry) => entry.id !== id));
  }, [setPendingOperations]);

  return {
    pendingOperations,
    beginCommandProgress,
    completeCommandProgress
  };
}
