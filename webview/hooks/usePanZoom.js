import { useState, useCallback } from 'react';
import { classifyWheelGesture, clampScale } from '../graph-gestures.js';

/**
 * Custom hook for pan/zoom interactions in the dependency graph.
 * Extracted from DependencyGraph.jsx to reduce file length.
 * 
 * @param {object} containerRef - Ref to the container element
 * @param {object} canvasBounds - {maxX, maxY} bounds of the canvas
 * @returns {object} Pan/zoom state and handlers
 */
function usePanZoom(containerRef, canvasBounds) {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e) => {
    if (e.target === containerRef.current || e.target.classList.contains('dependency-graph__canvas')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  }, [containerRef, transform.x, transform.y]);

  const handleMouseMove = useCallback((e) => {
    if (isPanning) {
      const newX = e.clientX - panStart.x;
      const newY = e.clientY - panStart.y;
      
      // Get container bounds for constraint calculation
      const container = containerRef.current;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const canvasWidth = canvasBounds.maxX * transform.scale;
        const canvasHeight = canvasBounds.maxY * transform.scale;
        
        // Constrain panning to keep some content visible
        const minX = Math.min(0, containerRect.width - canvasWidth - 100);
        const maxXPos = Math.max(0, 100);
        const minY = Math.min(0, containerRect.height - canvasHeight - 100);
        const maxYPos = Math.max(0, 100);
        
        setTransform(prev => ({
          ...prev,
          x: Math.max(minX, Math.min(newX, maxXPos)),
          y: Math.max(minY, Math.min(newY, maxYPos))
        }));
      } else {
        setTransform(prev => ({
          ...prev,
          x: newX,
          y: newY
        }));
      }
    }
  }, [isPanning, panStart, containerRef, canvasBounds, transform.scale]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleWheel = useCallback((e) => {
    const { deltaX, deltaY } = e;
    const intent = classifyWheelGesture(e);

    if (intent === 'zoom') {
      e.preventDefault();
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const multiplier = deltaY > 0 ? 0.9 : 1.1;
        const newScale = clampScale(transform.scale * multiplier);
        const scaleDelta = newScale / transform.scale;
        
        // Adjust position to zoom toward mouse cursor
        setTransform(prev => ({
          x: mouseX - (mouseX - prev.x) * scaleDelta,
          y: mouseY - (mouseY - prev.y) * scaleDelta,
          scale: newScale
        }));
      }
      return;
    }

    e.preventDefault();
    setTransform(prev => ({
      ...prev,
      x: prev.x - deltaX,
      y: prev.y - deltaY
    }));
  }, [containerRef, transform.scale]);

  const resetView = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  const zoomIn = useCallback(() => {
    setTransform(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 3) }));
  }, []);

  const zoomOut = useCallback(() => {
    setTransform(prev => ({ ...prev, scale: Math.max(prev.scale / 1.2, 0.2) }));
  }, []);

  return {
    transform,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    resetView,
    zoomIn,
    zoomOut
  };
}

export default usePanZoom;
