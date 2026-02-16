import React, { useEffect, useRef } from 'react';

const PokePokeStatus = ({ instances = [], onStop, vscode }) => {
  const dismissTimersRef = useRef(new Map());

  useEffect(() => {
    return () => {
      const timers = dismissTimersRef.current;
      for (const timeoutId of timers.values()) {
        clearTimeout(timeoutId);
      }
      timers.clear();
    };
  }, []);

  useEffect(() => {
    const timers = dismissTimersRef.current;
    const terminalStates = new Set(['failed', 'completed']);

    for (const [itemId, timeoutId] of timers.entries()) {
      const inst = instances.find((i) => i.itemId === itemId);
      if (!inst || !terminalStates.has(inst.state)) {
        clearTimeout(timeoutId);
        timers.delete(itemId);
      }
    }

    for (const inst of instances) {
      if (terminalStates.has(inst.state) && !timers.has(inst.itemId)) {
        const timeoutId = setTimeout(() => {
          timers.delete(inst.itemId);
          vscode.postMessage({ type: 'pokepokeDismiss', itemId: inst.itemId });
        }, 10000);
        timers.set(inst.itemId, timeoutId);
      }
    }
  }, [instances, vscode]);

  const handleDismiss = (itemId) => {
    const timers = dismissTimersRef.current;
    const timeoutId = timers.get(itemId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timers.delete(itemId);
    }
    vscode.postMessage({ type: 'pokepokeDismiss', itemId });
  };

  if (!Array.isArray(instances) || instances.length === 0) {
    return null;
  }

  return (
    <div className="section pokepoke-status-section">
      <div className="section-title">🤖 PokePoke</div>
      {instances.map((inst) => (
        <div key={inst.itemId} className={`pokepoke-instance pokepoke-instance--${inst.state}`}>
          <span className="pokepoke-instance__id">{inst.itemId}</span>
          <span className="pokepoke-instance__state">{inst.state}</span>
          <div className="pokepoke-instance__actions">
            {(inst.state === 'running' || inst.state === 'starting') && (
              <button className="pokepoke-instance__stop-btn" onClick={() => onStop(inst.itemId)} title="Stop">🛑</button>
            )}
            {(inst.state === 'failed' || inst.state === 'completed') && (
              <button className="pokepoke-instance__dismiss-btn" onClick={() => handleDismiss(inst.itemId)} title="Dismiss">✕</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PokePokeStatus;
