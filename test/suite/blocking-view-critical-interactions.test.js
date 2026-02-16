/* global window document */
const { describe, it, beforeEach, afterEach } = require('mocha');
const assert = require('assert');
const sinon = require('sinon');
const { JSDOM } = require('jsdom');
const React = require('react');
const { act } = require('react');
const ReactDOMClient = require('react-dom/client');
const { register } = require('esbuild-register/dist/node');

register({
  extensions: ['.jsx'],
  target: 'es2019'
});

const BlockingView = require('../../webview/components/BlockingView.jsx').default;

function createBlockingModel() {
  const issues = [
    { id: 'A1', title: 'Root blocker', priority: 1, status: 'open' },
    { id: 'B2', title: 'Mid blocker', priority: 1, status: 'open' },
    { id: 'C3', title: 'Another blocker', priority: 1, status: 'open' },
    { id: 'D4', title: 'Final item', priority: 1, status: 'open' }
  ];

  return {
    issues,
    edges: [
      { from: 'A1', to: 'B2' },
      { from: 'B2', to: 'C3' },
      { from: 'C3', to: 'D4' }
    ],
    completionOrder: issues,
    criticalPath: issues,
    criticalPaths: [issues],
    readyItems: [],
    parallelGroups: issues.map(issue => [issue]),
    fanOutCounts: {}
  };
}

function switchToCriticalTab(container, window) {
  const criticalTab = Array.from(container.querySelectorAll('.blocking-view__tab'))
    .find((btn) => btn.textContent.includes('Critical'));
  assert.ok(criticalTab, 'Critical tab button should exist');
  act(() => {
    criticalTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
}

describe('BlockingView critical path edge menu', () => {
  let dom;
  let container;
  let root;

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
      pretendToBeVisual: true
    });
    global.React = React;
    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;
    global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    global.cancelAnimationFrame = (handle) => clearTimeout(handle);
    container = document.getElementById('root');
    root = ReactDOMClient.createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => root.unmount());
    }
    dom.window.close();
    delete global.React;
    delete global.window;
    delete global.document;
    delete global.navigator;
    delete global.requestAnimationFrame;
    delete global.cancelAnimationFrame;
  });

  function renderBlockingView(overrides = {}) {
    const blockingModel = createBlockingModel();
    act(() => {
      root.render(
        React.createElement(BlockingView, {
          blockingModel,
          onIssueClick: () => {},
          onClose: () => {},
          onDepAction: overrides.onDepAction || (() => {})
        })
      );
    });
    switchToCriticalTab(container, window);
    return blockingModel;
  }

  it('renders an arrow for every dependency in a single critical path', () => {
    const model = renderBlockingView();
    const expectedEdges = model.criticalPaths[0].length - 1;
    const arrows = container.querySelectorAll('.blocking-view__critical-arrow--interactive');
    assert.strictEqual(arrows.length, expectedEdges, 'should show an arrow per dependency edge');
  });

  it('allows edge menu interactions within the critical path view', () => {
    const onDepAction = sinon.spy();
    renderBlockingView({ onDepAction });
    const arrows = container.querySelectorAll('.blocking-view__critical-arrow--interactive');
    assert.ok(arrows.length >= 1, 'should render at least one arrow');

    const targetArrow = arrows[arrows.length - 1];
    act(() => {
      targetArrow.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });

    let menu = container.querySelector('.blocking-view__edge-menu');
    assert.ok(menu, 'edge menu should open after clicking an arrow');

    const closeBtn = menu.querySelector('.blocking-view__edge-menu-close');
    assert.ok(closeBtn, 'edge menu close button should exist');
    act(() => {
      closeBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });

    menu = container.querySelector('.blocking-view__edge-menu');
    assert.ok(!menu, 'edge menu should close after clicking the close button');

    act(() => {
      targetArrow.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    const removeBtn = container.querySelector('.blocking-view__edge-menu-btn--remove');
    assert.ok(removeBtn, 'remove link button should render inside the menu');
    act(() => {
      removeBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });

    assert.strictEqual(onDepAction.callCount, 1, 'remove handler should trigger onDepAction');
    const [action, fromId, toId] = onDepAction.firstCall.args;
    assert.strictEqual(action, 'remove');
    assert.ok(fromId);
    assert.ok(toId);
  });
});
