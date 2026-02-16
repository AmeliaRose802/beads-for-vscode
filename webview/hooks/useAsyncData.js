/* global window */
import { useState, useEffect } from 'react';

/**
 * Hook for loading async data from the VS Code extension via message passing.
 * Handles request, response matching, timeout, and cleanup.
 *
 * @param {object} options
 * @param {boolean} options.shouldLoad - Trigger flag; the request fires when this becomes true
 * @param {object|null} options.vscode - The VS Code API handle (null if unavailable)
 * @param {string} options.issueId - Issue ID used for request/response matching
 * @param {object} options.request - Message object sent via vscode.postMessage
 * @param {string} options.responseType - The message.type to listen for
 * @param {function} options.onResponse - Callback receiving the matched message; should return data
 * @param {number} [options.timeout=5000] - Timeout in ms before giving up
 * @returns {{ loading: boolean, trigger: function }}
 */
export function useAsyncData({ shouldLoad, vscode, issueId, request, responseType, onResponse, timeout = 5000 }) {
  const [loading, setLoading] = useState(false);
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    if (!shouldLoad || !vscode || loading) return;

    setLoading(true);
    setTriggered(false);
    let cleanedUp = false;

    vscode.postMessage(request);

    const handler = (event) => {
      if (cleanedUp) return;
      const message = event.data;
      if (message.type === responseType && message.issueId === issueId) {
        setLoading(false);
        setTriggered(true);
        onResponse(message);
      }
    };

    window.addEventListener('message', handler);

    const timeoutId = setTimeout(() => {
      if (!cleanedUp) {
        setLoading(false);
        setTriggered(true);
      }
    }, timeout);

    return () => {
      cleanedUp = true;
      window.removeEventListener('message', handler);
      clearTimeout(timeoutId);
    };
  }, [shouldLoad, vscode, issueId, loading]);

  return { loading, triggered };
}
