const assert = require('assert');
const { register } = require('esbuild-register/dist/node');

register({ extensions: ['.js'], target: 'es2019' });

const { calculateLayout } = require('../../webview/components/dependency-graph-layout');

suite('dependency-graph-layout', () => {
  /**
   * Build minimal graph data from issues and dependencies.
   *
   * @param {Array<{id: string}>} issues
   * @param {Array<object>} deps
   * @returns {Array<{Issues: Array, Dependencies: Array}>}
   */
  function makeGraphData(issues, deps) {
    return [{ Issues: issues, Dependencies: deps }];
  }

  test('returns empty object for empty input', () => {
    assert.deepStrictEqual(calculateLayout([]), {});
    assert.deepStrictEqual(calculateLayout(null), {});
  });

  test('blocker is placed to the left of the issue it blocks', () => {
    const blocker = { id: 'A', title: 'Blocker', issue_type: 'task', priority: 1, status: 'open' };
    const blocked = { id: 'B', title: 'Blocked', issue_type: 'task', priority: 2, status: 'open' };

    const deps = [
      { issue_id: 'B', depends_on_id: 'A', dependency_type: 'blocks' }
    ];

    const positions = calculateLayout(makeGraphData([blocker, blocked], deps));

    assert.ok(positions.A, 'blocker A should have a position');
    assert.ok(positions.B, 'blocked B should have a position');
    assert.ok(
      positions.A.x < positions.B.x,
      `Blocker A (x=${positions.A.x}) should be to the left of blocked B (x=${positions.B.x})`
    );
  });

  test('chain of blockers flows left to right', () => {
    const a = { id: 'A', title: 'Root', issue_type: 'task', priority: 1, status: 'open' };
    const b = { id: 'B', title: 'Mid', issue_type: 'task', priority: 2, status: 'open' };
    const c = { id: 'C', title: 'Leaf', issue_type: 'task', priority: 3, status: 'open' };

    const deps = [
      { issue_id: 'B', depends_on_id: 'A', dependency_type: 'blocks' },
      { issue_id: 'C', depends_on_id: 'B', dependency_type: 'blocks' }
    ];

    const positions = calculateLayout(makeGraphData([a, b, c], deps));

    assert.ok(positions.A.x < positions.B.x, 'A should be left of B');
    assert.ok(positions.B.x < positions.C.x, 'B should be left of C');
  });

  test('independent issues receive positions', () => {
    const a = { id: 'A', title: 'Solo', issue_type: 'task', priority: 1, status: 'open' };

    const positions = calculateLayout(makeGraphData([a], []));

    assert.ok(positions.A, 'solo node should have a position');
    assert.strictEqual(typeof positions.A.x, 'number');
    assert.strictEqual(typeof positions.A.y, 'number');
  });
});
