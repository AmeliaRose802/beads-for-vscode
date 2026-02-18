/**
 * Determine how wheel gestures should be interpreted inside the dependency graph.
 * Zoom gestures on most trackpads present as wheel events with a modifier (ctrl/meta),
 * whereas unmodified wheel events typically indicate a scroll/pan interaction.
 *
 * @param {{ ctrlKey?: boolean, metaKey?: boolean } | undefined} event - Wheel event data.
 * @returns {'zoom' | 'pan'} String describing whether to zoom or pan.
 */
const MIN_SCALE = 0.2;
const MAX_SCALE = 3;

/**
 * Classify a wheel interaction as either zoom (pinch/modified scroll) or pan.
 *
 * @param {{ ctrlKey?: boolean, metaKey?: boolean } | undefined} event - Wheel event payload.
 * @returns {'zoom' | 'pan'} The gesture classification for downstream handling.
 */
function classifyWheelGesture(event) {
  if (!event) {
    return 'pan';
  }

  if (event.ctrlKey || event.metaKey) {
    return 'zoom';
  }

  return 'pan';
}

/**
 * Clamp a zoom scale value so we never exceed supported min/max bounds.
 *
 * @param {number} value - Desired scale multiplier.
 * @returns {number} Clamped scale within the supported range.
 */
function clampScale(value) {
  return Math.max(MIN_SCALE, Math.min(value, MAX_SCALE));
}

module.exports = {
  classifyWheelGesture,
  clampScale
};
