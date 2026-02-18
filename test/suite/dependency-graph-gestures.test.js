const assert = require('assert');
const { classifyWheelGesture } = require('../../webview/graph-gestures');

suite('Dependency graph gestures', () => {
  test('treats ctrl-modified wheel events as zoom gestures', () => {
    const intent = classifyWheelGesture({ ctrlKey: true, metaKey: false });
    assert.strictEqual(intent, 'zoom', 'ctrl+wheel should zoom the graph');
  });

  test('treats meta-modified wheel events as zoom gestures', () => {
    const intent = classifyWheelGesture({ ctrlKey: false, metaKey: true });
    assert.strictEqual(intent, 'zoom', 'meta+wheel should zoom the graph');
  });

  test('falls back to pan for unmodified wheel events', () => {
    const intent = classifyWheelGesture({ ctrlKey: false, metaKey: false });
    assert.strictEqual(intent, 'pan', 'standard two-finger scroll should pan instead of zoom');
  });

  test('defaults to pan when no event is supplied', () => {
    const intent = classifyWheelGesture();
    assert.strictEqual(intent, 'pan', 'undefined event should be treated as a pan to stay safe');
  });
});
