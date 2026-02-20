const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  findEpicChildren,
  findCascadedBlocks,
  hasDirectEpicBlock
} = require('../../webview/epic-unblock-utils');

suite('Epic unblock utilities', () => {
  suite('findEpicChildren', () => {
    test('returns children of an epic from parent-child deps', () => {
      const graphData = [{
        Issues: [
          { id: 'epic-1', issue_type: 'epic' },
          { id: 'task-a', issue_type: 'task' },
          { id: 'task-b', issue_type: 'task' }
        ],
        Dependencies: [
          { depends_on_id: 'epic-1', issue_id: 'task-a', type: 'parent-child' },
          { depends_on_id: 'epic-1', issue_id: 'task-b', type: 'parent-child' }
        ]
      }];

      const children = findEpicChildren(graphData, 'epic-1');
      assert.strictEqual(children.size, 2);
      assert.ok(children.has('task-a'));
      assert.ok(children.has('task-b'));
    });

    test('returns empty set for epic with no children', () => {
      const graphData = [{
        Issues: [{ id: 'epic-1', issue_type: 'epic' }],
        Dependencies: []
      }];

      const children = findEpicChildren(graphData, 'epic-1');
      assert.strictEqual(children.size, 0);
    });

    test('handles null/undefined graphData', () => {
      assert.strictEqual(findEpicChildren(null, 'epic-1').size, 0);
      assert.strictEqual(findEpicChildren(undefined, 'epic-1').size, 0);
    });

    test('does not include the epic itself', () => {
      const graphData = [{
        Issues: [{ id: 'epic-1', issue_type: 'epic' }],
        Dependencies: [
          { depends_on_id: 'epic-1', issue_id: 'epic-1', type: 'parent-child' }
        ]
      }];

      const children = findEpicChildren(graphData, 'epic-1');
      assert.strictEqual(children.size, 0);
    });

    test('normalises parent type to parent-child', () => {
      const graphData = [{
        Issues: [
          { id: 'epic-1', issue_type: 'epic' },
          { id: 'task-x', issue_type: 'task' }
        ],
        Dependencies: [
          { depends_on_id: 'epic-1', issue_id: 'task-x', type: 'parent' }
        ]
      }];

      const children = findEpicChildren(graphData, 'epic-1');
      assert.strictEqual(children.size, 1);
      assert.ok(children.has('task-x'));
    });

    test('searches across multiple graph components', () => {
      const graphData = [
        {
          Issues: [{ id: 'task-a', issue_type: 'task' }],
          Dependencies: [
            { depends_on_id: 'epic-1', issue_id: 'task-a', type: 'parent-child' }
          ]
        },
        {
          Issues: [{ id: 'task-b', issue_type: 'task' }],
          Dependencies: [
            { depends_on_id: 'epic-1', issue_id: 'task-b', type: 'parent-child' }
          ]
        }
      ];

      const children = findEpicChildren(graphData, 'epic-1');
      assert.strictEqual(children.size, 2);
    });
  });

  suite('findCascadedBlocks', () => {
    const makeGraphData = (extraDeps = []) => [{
      Issues: [
        { id: 'epic-A', issue_type: 'epic' },
        { id: 'epic-B', issue_type: 'epic' },
        { id: 'a1', issue_type: 'task' },
        { id: 'a2', issue_type: 'task' },
        { id: 'b1', issue_type: 'task' },
        { id: 'b2', issue_type: 'task' }
      ],
      Dependencies: [
        { depends_on_id: 'epic-A', issue_id: 'a1', type: 'parent-child' },
        { depends_on_id: 'epic-A', issue_id: 'a2', type: 'parent-child' },
        { depends_on_id: 'epic-B', issue_id: 'b1', type: 'parent-child' },
        { depends_on_id: 'epic-B', issue_id: 'b2', type: 'parent-child' },
        ...extraDeps
      ]
    }];

    test('identifies cascaded deps via cascaded_from metadata', () => {
      const data = makeGraphData([
        { depends_on_id: 'a1', issue_id: 'b1', type: 'blocks', cascaded_from: 'epic-A→epic-B' },
        { depends_on_id: 'a2', issue_id: 'b2', type: 'blocks', cascaded_from: 'epic-A→epic-B' }
      ]);

      const result = findCascadedBlocks(data, 'epic-A', 'epic-B');
      assert.strictEqual(result.cascadedDeps.length, 2);
      assert.strictEqual(result.manualDeps.length, 0);
    });

    test('preserves manual deps (no cascaded_from)', () => {
      const data = makeGraphData([
        { depends_on_id: 'a1', issue_id: 'b1', type: 'blocks', cascaded_from: 'epic-A→epic-B' },
        { depends_on_id: 'a2', issue_id: 'b2', type: 'blocks' }
      ]);

      const result = findCascadedBlocks(data, 'epic-A', 'epic-B');
      assert.strictEqual(result.cascadedDeps.length, 1);
      assert.strictEqual(result.manualDeps.length, 1);
      assert.strictEqual(result.manualDeps[0].from, 'b2');
    });

    test('returns empty results when no blocking deps exist', () => {
      const data = makeGraphData();
      const result = findCascadedBlocks(data, 'epic-A', 'epic-B');
      assert.strictEqual(result.cascadedDeps.length, 0);
      assert.strictEqual(result.manualDeps.length, 0);
    });

    test('handles null graphData', () => {
      const result = findCascadedBlocks(null, 'epic-A', 'epic-B');
      assert.strictEqual(result.cascadedDeps.length, 0);
      assert.strictEqual(result.manualDeps.length, 0);
    });

    test('returns children sets for both epics', () => {
      const data = makeGraphData();
      const result = findCascadedBlocks(data, 'epic-A', 'epic-B');
      assert.strictEqual(result.childrenA.size, 2);
      assert.strictEqual(result.childrenB.size, 2);
      assert.ok(result.childrenA.has('a1'));
      assert.ok(result.childrenB.has('b1'));
    });

    test('ignores deps not between the two epics children', () => {
      const data = makeGraphData([
        { depends_on_id: 'a1', issue_id: 'b1', type: 'blocks', cascaded_from: 'epic-A→epic-B' },
        { depends_on_id: 'a1', issue_id: 'a2', type: 'blocks', cascaded_from: 'other' }
      ]);

      const result = findCascadedBlocks(data, 'epic-A', 'epic-B');
      assert.strictEqual(result.cascadedDeps.length, 1);
    });

    test('handles blocked-by type as well as blocks', () => {
      const data = makeGraphData([
        { depends_on_id: 'a1', issue_id: 'b1', type: 'blocked-by', cascaded_from: 'epic-A→epic-B' }
      ]);

      const result = findCascadedBlocks(data, 'epic-A', 'epic-B');
      assert.strictEqual(result.cascadedDeps.length, 1);
    });
  });

  suite('hasDirectEpicBlock', () => {
    test('returns true when direct block exists between epics', () => {
      const graphData = [{
        Issues: [],
        Dependencies: [
          { depends_on_id: 'epic-A', issue_id: 'epic-B', type: 'blocks' }
        ]
      }];

      assert.strictEqual(hasDirectEpicBlock(graphData, 'epic-A', 'epic-B'), true);
    });

    test('returns true when block exists in reverse direction', () => {
      const graphData = [{
        Issues: [],
        Dependencies: [
          { depends_on_id: 'epic-B', issue_id: 'epic-A', type: 'blocks' }
        ]
      }];

      assert.strictEqual(hasDirectEpicBlock(graphData, 'epic-A', 'epic-B'), true);
    });

    test('returns false when no block exists', () => {
      const graphData = [{
        Issues: [],
        Dependencies: [
          { depends_on_id: 'epic-A', issue_id: 'epic-B', type: 'related' }
        ]
      }];

      assert.strictEqual(hasDirectEpicBlock(graphData, 'epic-A', 'epic-B'), false);
    });

    test('returns false for null graphData', () => {
      assert.strictEqual(hasDirectEpicBlock(null, 'epic-A', 'epic-B'), false);
    });
  });
});

suite('Epic unblock integration', () => {
  const blockingViewSrc = fs.readFileSync(
    path.join(__dirname, '../../webview/components/BlockingView.jsx'), 'utf8'
  );
  const dependencyGraphSrc = fs.readFileSync(
    path.join(__dirname, '../../webview/components/DependencyGraph.jsx'), 'utf8'
  );
  const appSrc = fs.readFileSync(
    path.join(__dirname, '../../webview/App.jsx'), 'utf8'
  );
  const hookSrc = fs.readFileSync(
    path.join(__dirname, '../../webview/hooks/useBulkUnblockEpics.js'), 'utf8'
  );
  const messageHandlerSrc = fs.readFileSync(
    path.join(__dirname, '../../webview/message-handler.js'), 'utf8'
  );
  const extensionHandlerSrc = fs.readFileSync(
    path.join(__dirname, '../../extension-message-handler.js'), 'utf8'
  );
  const stylesSrc = fs.readFileSync(
    path.join(__dirname, '../../webview/styles.css'), 'utf8'
  );
  const dialogSrc = fs.readFileSync(
    path.join(__dirname, '../../webview/components/BulkUnblockConfirmDialog.jsx'), 'utf8'
  );

  suite('DependencyGraph edge click support', () => {
    test('accepts onEdgeClick prop', () => {
      assert.ok(
        dependencyGraphSrc.includes('onEdgeClick'),
        'DependencyGraph should accept onEdgeClick prop'
      );
    });

    test('applies clickable class when onEdgeClick is provided', () => {
      assert.ok(
        dependencyGraphSrc.includes('dependency-graph__edge--clickable'),
        'DependencyGraph should add clickable class to edges'
      );
    });

    test('calls onEdgeClick on edge click event', () => {
      assert.ok(
        dependencyGraphSrc.includes('onClick={edgeClickable'),
        'Edge should have onClick handler when edgeClickable'
      );
    });
  });

  suite('BlockingView epic unblock triggering', () => {
    test('has handleEpicEdgeClick handler', () => {
      assert.ok(
        blockingViewSrc.includes('handleEpicEdgeClick'),
        'BlockingView should have handleEpicEdgeClick handler'
      );
    });

    test('passes onEdgeClick to epic DependencyGraph', () => {
      assert.ok(
        blockingViewSrc.includes('onEdgeClick={handleEpicEdgeClick}'),
        'BlockingView should pass onEdgeClick to epic graph'
      );
    });

    test('dispatches bulkUnblock action on epic edge click', () => {
      assert.ok(
        blockingViewSrc.includes("onDepAction('bulkUnblock'"),
        'handleEpicEdgeClick should call onDepAction with bulkUnblock'
      );
    });
  });

  suite('useBulkUnblockEpics hook', () => {
    test('imports epic-unblock-utils', () => {
      assert.ok(
        hookSrc.includes('epic-unblock-utils'),
        'Hook should import epic-unblock-utils'
      );
    });

    test('uses findCascadedBlocks for analysis', () => {
      assert.ok(
        hookSrc.includes('findCascadedBlocks'),
        'Hook should use findCascadedBlocks'
      );
    });

    test('uses hasDirectEpicBlock', () => {
      assert.ok(
        hookSrc.includes('hasDirectEpicBlock'),
        'Hook should use hasDirectEpicBlock'
      );
    });

    test('sends epicUnblock message on confirm', () => {
      assert.ok(
        hookSrc.includes("type: 'epicUnblock'"),
        'Hook should send epicUnblock message type'
      );
    });

    test('sends epicA and epicB in message', () => {
      assert.ok(
        hookSrc.includes('epicA:') && hookSrc.includes('epicB:'),
        'Message should include epicA and epicB'
      );
    });

    test('sends cascadedDeps in message', () => {
      assert.ok(
        hookSrc.includes('cascadedDeps'),
        'Message should include cascadedDeps'
      );
    });
  });

  suite('Extension message handler epicUnblock', () => {
    test('handles epicUnblock message type', () => {
      assert.ok(
        extensionHandlerSrc.includes("case 'epicUnblock'"),
        'Extension handler should have epicUnblock case'
      );
    });

    test('removes direct epic-to-epic block', () => {
      assert.ok(
        extensionHandlerSrc.includes('dep remove ${epicA} --blocks ${epicB}'),
        'Handler should remove direct epic block'
      );
    });

    test('removes cascaded child blocks', () => {
      assert.ok(
        extensionHandlerSrc.includes('dep remove ${dep.from} --blocks ${dep.to}'),
        'Handler should remove cascaded child blocks'
      );
    });

    test('sends epicUnblockResult response', () => {
      assert.ok(
        extensionHandlerSrc.includes("type: 'epicUnblockResult'"),
        'Handler should send epicUnblockResult response'
      );
    });

    test('invalidates cache after unblock', () => {
      assert.ok(
        extensionHandlerSrc.includes('_invalidateCache'),
        'Handler should invalidate cache after unblock'
      );
    });

    test('reports errors per dependency', () => {
      assert.ok(
        extensionHandlerSrc.includes('errors.push'),
        'Handler should track per-dep errors'
      );
    });
  });

  suite('Message handler epicUnblockResult', () => {
    test('handles epicUnblockResult message type', () => {
      assert.ok(
        messageHandlerSrc.includes("case 'epicUnblockResult'"),
        'Message handler should handle epicUnblockResult'
      );
    });

    test('shows success message with removed count', () => {
      assert.ok(
        messageHandlerSrc.includes('removedCount'),
        'Message handler should show removed count in output'
      );
    });

    test('shows error message on failure', () => {
      assert.ok(
        messageHandlerSrc.includes('Epic unblock failed'),
        'Message handler should show error on failure'
      );
    });

    test('calls handleEpicUnblockComplete callback', () => {
      assert.ok(
        messageHandlerSrc.includes('handleEpicUnblockComplete'),
        'Message handler should call completion callback'
      );
    });
  });

  suite('App.jsx wiring', () => {
    test('imports useBulkUnblockEpics hook', () => {
      assert.ok(
        appSrc.includes('useBulkUnblockEpics'),
        'App should import useBulkUnblockEpics hook'
      );
    });

    test('passes handleEpicUnblockComplete to processMessage', () => {
      assert.ok(
        appSrc.includes('handleEpicUnblockComplete'),
        'App should pass handleEpicUnblockComplete to message handler'
      );
    });

    test('renders BulkUnblockConfirmDialog', () => {
      assert.ok(
        appSrc.includes('<BulkUnblockConfirmDialog'),
        'App should render BulkUnblockConfirmDialog'
      );
    });

    test('handles bulkUnblock action in onDepAction', () => {
      assert.ok(
        appSrc.includes("action === 'bulkUnblock'"),
        'App should handle bulkUnblock in onDepAction'
      );
    });
  });

  suite('BulkUnblockConfirmDialog component', () => {
    test('shows from and to epic IDs', () => {
      assert.ok(
        dialogSrc.includes('fromId') && dialogSrc.includes('toId'),
        'Dialog should display from and to epic IDs'
      );
    });

    test('shows cascaded count', () => {
      assert.ok(
        dialogSrc.includes('cascadedCount'),
        'Dialog should show cascaded count'
      );
    });

    test('has confirm and cancel buttons', () => {
      assert.ok(
        dialogSrc.includes('onConfirm') && dialogSrc.includes('onCancel'),
        'Dialog should have confirm and cancel callbacks'
      );
    });

    test('warns about irreversibility', () => {
      assert.ok(
        dialogSrc.includes('cannot be undone'),
        'Dialog should warn that operation cannot be undone'
      );
    });

    test('mentions preserving manual blocks', () => {
      assert.ok(
        dialogSrc.includes('Manually-created blocks'),
        'Dialog should mention manual blocks are preserved'
      );
    });

    test('has no inline styles', () => {
      const inlineStylePattern = /style\s*=\s*\{\{/;
      assert.ok(
        !inlineStylePattern.test(dialogSrc),
        'Dialog should have no inline styles'
      );
    });
  });

  suite('CSS styles', () => {
    test('defines clickable edge styles', () => {
      assert.ok(
        stylesSrc.includes('.dependency-graph__edge--clickable'),
        'CSS should define clickable edge styles'
      );
    });

    test('clickable edges have cursor pointer', () => {
      assert.ok(
        stylesSrc.includes('cursor: pointer'),
        'Clickable edges should have pointer cursor'
      );
    });

    test('defines bulk unblock dialog overlay', () => {
      assert.ok(
        stylesSrc.includes('.bulk-unblock-dialog-overlay'),
        'CSS should define dialog overlay'
      );
    });

    test('defines bulk unblock dialog styles', () => {
      assert.ok(
        stylesSrc.includes('.bulk-unblock-dialog__actions'),
        'CSS should define dialog action button styles'
      );
    });
  });
});
