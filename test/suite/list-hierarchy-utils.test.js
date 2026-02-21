const assert = require('assert');
const { buildFlatHierarchy, MAX_INDENT_DEPTH } = require('../../webview/list-hierarchy-utils');

suite('List Hierarchy Utils', () => {
  suite('buildFlatHierarchy', () => {
    test('Should return empty array for null/undefined/empty input', () => {
      assert.deepStrictEqual(buildFlatHierarchy(null), []);
      assert.deepStrictEqual(buildFlatHierarchy(undefined), []);
      assert.deepStrictEqual(buildFlatHierarchy([]), []);
    });

    test('Should return all items at depth 0 when no parent_id', () => {
      const issues = [
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' },
        { id: 'c', title: 'C' }
      ];
      const result = buildFlatHierarchy(issues);
      assert.strictEqual(result.length, 3);
      result.forEach(item => assert.strictEqual(item.depth, 0));
      assert.deepStrictEqual(result.map(r => r.issue.id), ['a', 'b', 'c']);
    });

    test('Should nest children under their parent', () => {
      const issues = [
        { id: 'parent', title: 'Parent', type: 'epic' },
        { id: 'child1', title: 'Child 1', parent_id: 'parent' },
        { id: 'child2', title: 'Child 2', parent_id: 'parent' }
      ];
      const result = buildFlatHierarchy(issues);
      assert.strictEqual(result.length, 3);
      assert.strictEqual(result[0].issue.id, 'parent');
      assert.strictEqual(result[0].depth, 0);
      assert.strictEqual(result[1].issue.id, 'child1');
      assert.strictEqual(result[1].depth, 1);
      assert.strictEqual(result[2].issue.id, 'child2');
      assert.strictEqual(result[2].depth, 1);
    });

    test('Should handle multi-level nesting', () => {
      const issues = [
        { id: 'root', title: 'Root' },
        { id: 'child', title: 'Child', parent_id: 'root' },
        { id: 'grandchild', title: 'Grandchild', parent_id: 'child' }
      ];
      const result = buildFlatHierarchy(issues);
      assert.strictEqual(result.length, 3);
      assert.deepStrictEqual(
        result.map(r => ({ id: r.issue.id, depth: r.depth })),
        [
          { id: 'root', depth: 0 },
          { id: 'child', depth: 1 },
          { id: 'grandchild', depth: 2 }
        ]
      );
    });

    test('Should treat issues with missing parent as root', () => {
      const issues = [
        { id: 'orphan', title: 'Orphan', parent_id: 'nonexistent' },
        { id: 'root', title: 'Root' }
      ];
      const result = buildFlatHierarchy(issues);
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].depth, 0);
      assert.strictEqual(result[1].depth, 0);
    });

    test('Should cap depth at MAX_INDENT_DEPTH', () => {
      const issues = [
        { id: 'l0', title: 'L0' },
        { id: 'l1', title: 'L1', parent_id: 'l0' },
        { id: 'l2', title: 'L2', parent_id: 'l1' },
        { id: 'l3', title: 'L3', parent_id: 'l2' },
        { id: 'l4', title: 'L4', parent_id: 'l3' },
        { id: 'l5', title: 'L5', parent_id: 'l4' },
        { id: 'l6', title: 'L6', parent_id: 'l5' }
      ];
      const result = buildFlatHierarchy(issues);
      assert.strictEqual(result.length, 7);
      assert.strictEqual(result[5].depth, MAX_INDENT_DEPTH);
      assert.strictEqual(result[6].depth, MAX_INDENT_DEPTH);
    });

    test('Should handle mixed roots and children', () => {
      const issues = [
        { id: 'epic1', title: 'Epic 1' },
        { id: 'task1', title: 'Task 1', parent_id: 'epic1' },
        { id: 'epic2', title: 'Epic 2' },
        { id: 'task2', title: 'Task 2', parent_id: 'epic2' },
        { id: 'standalone', title: 'Standalone' }
      ];
      const result = buildFlatHierarchy(issues);
      assert.strictEqual(result.length, 5);
      const ids = result.map(r => r.issue.id);
      // epic1 should come before task1
      assert.ok(ids.indexOf('epic1') < ids.indexOf('task1'));
      // epic2 should come before task2
      assert.ok(ids.indexOf('epic2') < ids.indexOf('task2'));
      // task1 should be at depth 1
      assert.strictEqual(result[ids.indexOf('task1')].depth, 1);
      // task2 should be at depth 1
      assert.strictEqual(result[ids.indexOf('task2')].depth, 1);
    });
  });
});
