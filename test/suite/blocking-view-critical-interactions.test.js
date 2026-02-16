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
    { id: 'A1', title: 'Root blocker', priority: 1, status: 'open', issue_type: 'task' },
    { id: 'B2', title: 'Mid blocker', priority: 1, status: 'open', issue_type: 'task' },
    { id: 'C3', title: 'Another blocker', priority: 1, status: 'open', issue_type: 'task' },
    { id: 'D4', title: 'Final item', priority: 1, status: 'open', issue_type: 'task' }
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

function createGraphData(model) {
  return [{
    Issues: model.issues.map((issue) => ({ ...issue })),
    Dependencies: model.edges.map((edge) => ({
      depends_on_id: edge.from,
      issue_id: edge.to
    }))
  }];
}

function switchToGraphTab(container, window) {
  const graphTab = Array.from(container.querySelectorAll('.blocking-view__tab'))
    .find((btn) => btn.textContent.includes('Graph'));
  assert.ok(graphTab, 'Graph tab button should exist');
  act(() => {
    graphTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
}

describe('BlockingView dependency graph tab', () => {
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
    const graphData = createGraphData(blockingModel);
    act(() => {
      root.render(
        React.createElement(BlockingView, {
          blockingModel,
          graphData,
          onIssueClick: overrides.onIssueClick || (() => {}),
          onClose: () => {},
          onDepAction: overrides.onDepAction || (() => {})
        })
      );
    });
    switchToGraphTab(container, window);
    return blockingModel;
  }

  it('renders a dependency graph node for each issue', () => {
    const model = renderBlockingView();
    const nodes = container.querySelectorAll('.dependency-graph__node');
    assert.strictEqual(nodes.length, model.issues.length, 'should show a node per issue');
  });

  it('invokes onIssueClick when selecting a graph node', () => {
    const onIssueClick = sinon.spy();
    renderBlockingView({ onIssueClick });
    const nodes = container.querySelectorAll('.dependency-graph__node');
    assert.ok(nodes.length > 0, 'graph should render nodes');

    act(() => {
      nodes[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });

    assert.strictEqual(onIssueClick.callCount, 1, 'node clicks should trigger callback');
    const [issue] = onIssueClick.firstCall.args;
    assert.ok(issue);
    assert.strictEqual(issue.id, 'A1');
  });
});
