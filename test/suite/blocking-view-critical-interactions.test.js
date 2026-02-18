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

function createMinimalBlockingModel() {
  return {
    issues: [],
    edges: [],
    completionOrder: [],
    criticalPath: [],
    criticalPaths: [],
    readyItems: [],
    parallelGroups: [],
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
    const blockingModel = overrides.blockingModel || createBlockingModel();
    const graphData = overrides.graphData || createGraphData(blockingModel);
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
    return { blockingModel, graphData };
  }

  it('renders a dependency graph node for each issue', () => {
    const { blockingModel } = renderBlockingView();
    const nodes = container.querySelectorAll('.dependency-graph__node');
    assert.strictEqual(nodes.length, blockingModel.issues.length, 'should show a node per issue');
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

  it('shows expanded details when selecting a node', () => {
    renderBlockingView();
    const nodes = container.querySelectorAll('.dependency-graph__node');
    assert.ok(nodes.length > 0, 'graph should render nodes');

    act(() => {
      nodes[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });

    const detailsPanel = container.querySelector('.blocking-view__details');
    assert.ok(detailsPanel, 'should render details panel');
    const expandedDetails = container.querySelector('.issue-card__details');
    assert.ok(expandedDetails, 'IssueCard should be expanded by default');
  });

  it('adds relationship type classes to dependency graph edges', async () => {
    const graphData = [{
      Issues: [
        { id: 'A1', title: 'Root blocker', priority: 1, status: 'open', issue_type: 'task' },
        { id: 'B2', title: 'Blocked item', priority: 1, status: 'open', issue_type: 'task' }
      ],
      Dependencies: [{
        depends_on_id: 'A1',
        issue_id: 'B2',
        dependency_type: 'blocked-by'
      }]
    }];

    renderBlockingView({
      blockingModel: createMinimalBlockingModel(),
      graphData
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const edges = container.querySelectorAll('.dependency-graph__edge--blocked-by');
    assert.strictEqual(edges.length, 1, 'should render blocked-by class on edge');
  });

  it('groups epic descendants and collapses outgoing blocking edges', async () => {
    const graphData = [{
      Issues: [
        { id: 'E1', title: 'Epic', priority: 2, status: 'open', issue_type: 'epic' },
        { id: 'T1', title: 'Child 1', priority: 2, status: 'open', issue_type: 'task' },
        { id: 'T2', title: 'Child 2', priority: 2, status: 'open', issue_type: 'task' },
        { id: 'X1', title: 'External', priority: 2, status: 'open', issue_type: 'task' }
      ],
      Dependencies: [
        { issue_id: 'T1', depends_on_id: 'E1', dependency_type: 'parent-child' },
        { issue_id: 'T2', depends_on_id: 'E1', dependency_type: 'parent-child' },
        { depends_on_id: 'T1', issue_id: 'X1', dependency_type: 'blocked-by' },
        { depends_on_id: 'T2', issue_id: 'X1', dependency_type: 'blocked-by' }
      ]
    }];

    renderBlockingView({
      blockingModel: createMinimalBlockingModel(),
      graphData
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const epicGroups = container.querySelectorAll('.dependency-graph__epic-group');
    assert.strictEqual(epicGroups.length, 1, 'should render an epic grouping container');

    const edges = container.querySelectorAll('.dependency-graph__edge--blocked-by');
    assert.strictEqual(edges.length, 1, 'should collapse child blocking edges into a single epic edge');

    const nodes = Array.from(container.querySelectorAll('.dependency-graph__node'));
    const epicNode = nodes.find(node => node.textContent.includes('E1'));
    const childNode = nodes.find(node => node.textContent.includes('T1'));
    assert.ok(epicNode && childNode, 'should render epic and child nodes');

    const epicTop = Number((epicNode.getAttribute('style') || '').match(/top:\s*(\d+)/)?.[1]);
    const childTop = Number((childNode.getAttribute('style') || '').match(/top:\s*(\d+)/)?.[1]);
    assert.ok(childTop > epicTop, 'child node should appear below epic node');
  });
});
