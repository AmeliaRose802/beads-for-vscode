const assert = require('assert');
const { buildHierarchyModel, filterHierarchyTree, countDescendants } = require('../../webview/hierarchy-utils');

suite('hierarchy-utils', () => {
  const components = [
    {
      Issues: [
        { id: 'root', title: 'Root', status: 'open', priority: 1, issue_type: 'feature' },
        { id: 'child', title: 'Child', status: 'open', priority: 2, issue_type: 'task' },
        { id: 'blocked', title: 'Blocked', status: 'blocked', priority: 2, issue_type: 'bug' },
        { id: 'related', title: 'Related', status: 'open', priority: 3, issue_type: 'task' }
      ],
      Dependencies: [
        { issue_id: 'child', depends_on_id: 'root', type: 'parent-child' },
        { issue_id: 'blocked', depends_on_id: 'child', type: 'blocked-by' },
        { issue_id: 'root', depends_on_id: 'related', type: 'related' }
      ]
    }
  ];

  test('buildHierarchyModel constructs parent chain to root', () => {
    const model = buildHierarchyModel('child', components);
    const parentIds = model.parentChain.map(item => item.id);
    assert.deepStrictEqual(parentIds, ['root', 'child']);
  });

  test('buildHierarchyModel builds dependency tree with directions', () => {
    const model = buildHierarchyModel('child', components);
    const childNode = model.tree;

    // Outgoing relation from child to blocked (blocked-by edge)
    const blockedNode = childNode.children.find(item => item.id === 'blocked');
    assert.ok(blockedNode, 'Blocked issue should appear in tree');
    assert.strictEqual(blockedNode.relationType, 'blocked-by');
    assert.strictEqual(blockedNode.direction, 'outgoing');

    // Incoming relation from root (parent-child edge)
    const parentNode = childNode.children.find(item => item.id === 'root');
    assert.ok(parentNode, 'Parent should appear as incoming relation');
    assert.strictEqual(parentNode.relationType, 'parent-child');
    assert.strictEqual(parentNode.direction, 'incoming');
  });

  test('blocking cycles are marked as cycles', () => {
    const cyclicComponents = [
      {
        Issues: [
          { id: 'a', title: 'A', status: 'open', priority: 1, issue_type: 'task' },
          { id: 'b', title: 'B', status: 'open', priority: 1, issue_type: 'task' }
        ],
        Dependencies: [
          { issue_id: 'a', depends_on_id: 'b', type: 'blocks' },
          { issue_id: 'b', depends_on_id: 'a', type: 'blocks' }
        ]
      }
    ];

    const model = buildHierarchyModel('a', cyclicComponents);
    const loopNode = model.tree.children.find(node => node.id === 'b');
    assert.ok(loopNode, 'B should appear as child of A');
    assert.strictEqual(loopNode.children[0].id, 'a');
    assert.strictEqual(loopNode.children[0].isCycle, true);
    assert.strictEqual(loopNode.children[0].isBackReference, false);
  });

  test('parent-child back-references are marked as back-references not cycles', () => {
    const parentChildComponents = [
      {
        Issues: [
          { id: 'parent', title: 'Parent', status: 'open', priority: 1, issue_type: 'feature' },
          { id: 'child', title: 'Child', status: 'open', priority: 2, issue_type: 'task' }
        ],
        Dependencies: [
          { issue_id: 'child', depends_on_id: 'parent', type: 'parent-child' }
        ]
      }
    ];

    // Start from parent, traverse to child, which has back-edge to parent
    const model = buildHierarchyModel('parent', parentChildComponents);

    // Find the child node in the tree
    const childNode = model.tree.children.find(node => node.id === 'child');
    assert.ok(childNode, 'Child should appear in parent tree');

    // Child has an outgoing edge to parent (traversed back)
    const backRefNode = childNode.children.find(node => node.id === 'parent');
    assert.ok(backRefNode, 'Parent back-reference should appear');
    assert.strictEqual(backRefNode.isBackReference, true, 'Should be marked as back-reference');
    assert.strictEqual(backRefNode.isCycle, false, 'Should NOT be marked as cycle');
  });

  test('related relationship back-references are marked as back-references not cycles', () => {
    const relatedComponents = [
      {
        Issues: [
          { id: 'a', title: 'A', status: 'open', priority: 1, issue_type: 'task' },
          { id: 'b', title: 'B', status: 'open', priority: 1, issue_type: 'task' }
        ],
        Dependencies: [
          { issue_id: 'a', depends_on_id: 'b', type: 'related' },
          { issue_id: 'b', depends_on_id: 'a', type: 'related' }
        ]
      }
    ];

    const model = buildHierarchyModel('a', relatedComponents);
    const loopNode = model.tree.children.find(node => node.id === 'b');
    assert.ok(loopNode, 'B should appear as child of A');
    assert.strictEqual(loopNode.children[0].id, 'a');
    assert.strictEqual(loopNode.children[0].isBackReference, true, 'Related back-reference should be back-reference');
    assert.strictEqual(loopNode.children[0].isCycle, false, 'Related back-reference should NOT be cycle');
  });

  test('relates-to relationship is treated as related (non-cyclic)', () => {
    const relatedComponents = [
      {
        Issues: [
          { id: 'a', title: 'A', status: 'open', priority: 1, issue_type: 'task' },
          { id: 'b', title: 'B', status: 'open', priority: 1, issue_type: 'task' }
        ],
        Dependencies: [
          { issue_id: 'a', depends_on_id: 'b', type: 'relates-to' },
          { issue_id: 'b', depends_on_id: 'a', type: 'relates-to' }
        ]
      }
    ];

    const model = buildHierarchyModel('a', relatedComponents);
    const loopNode = model.tree.children.find(node => node.id === 'b');
    assert.ok(loopNode, 'B should appear as child of A');
    assert.strictEqual(loopNode.children[0].id, 'a');
    assert.strictEqual(loopNode.children[0].isBackReference, true, 'Relates-to back-reference should be back-reference');
    assert.strictEqual(loopNode.children[0].isCycle, false, 'Relates-to back-reference should NOT be cycle');
  });

  suite('filterHierarchyTree', () => {
    test('returns all children when all types enabled', () => {
      const model = buildHierarchyModel('child', components);
      const allTypes = new Set(['parent-child', 'blocks', 'blocked-by', 'related']);
      const filtered = filterHierarchyTree(model.tree, allTypes);
      assert.strictEqual(filtered.children.length, model.tree.children.length);
    });

    test('filters out blocked-by when only parent-child enabled', () => {
      const model = buildHierarchyModel('child', components);
      const filtered = filterHierarchyTree(model.tree, new Set(['parent-child']));
      const types = filtered.children.map(c => c.relationType);
      assert.ok(types.every(t => t === 'parent-child'), 'Only parent-child nodes should remain');
      assert.ok(!types.includes('blocked-by'), 'blocked-by nodes should be filtered out');
    });

    test('filters out parent-child when only blocking types enabled', () => {
      const model = buildHierarchyModel('child', components);
      const filtered = filterHierarchyTree(model.tree, new Set(['blocks', 'blocked-by']));
      const types = filtered.children.map(c => c.relationType);
      assert.ok(!types.includes('parent-child'), 'parent-child should be filtered out');
    });

    test('returns empty children when no types enabled', () => {
      const model = buildHierarchyModel('child', components);
      const filtered = filterHierarchyTree(model.tree, new Set());
      assert.strictEqual(filtered.children.length, 0);
    });

    test('returns null/undefined input unchanged', () => {
      assert.strictEqual(filterHierarchyTree(null, new Set(['blocks'])), null);
      assert.strictEqual(filterHierarchyTree(undefined, new Set(['blocks'])), undefined);
    });

    test('filters recursively through subtrees', () => {
      const deepComponents = [
        {
          Issues: [
            { id: 'a', title: 'A', status: 'open', priority: 1, issue_type: 'task' },
            { id: 'b', title: 'B', status: 'open', priority: 1, issue_type: 'task' },
            { id: 'c', title: 'C', status: 'open', priority: 1, issue_type: 'task' }
          ],
          Dependencies: [
            { issue_id: 'a', depends_on_id: 'b', type: 'blocks' },
            { issue_id: 'b', depends_on_id: 'c', type: 'related' }
          ]
        }
      ];
      const model = buildHierarchyModel('a', deepComponents);
      const filtered = filterHierarchyTree(model.tree, new Set(['blocks']));
      const bNode = filtered.children.find(c => c.id === 'b');
      assert.ok(bNode, 'B should remain (blocks type)');
      const relatedInB = bNode.children.filter(c => c.relationType === 'related');
      assert.strictEqual(relatedInB.length, 0, 'Related children of B should be filtered');
    });

    test('preserves root node regardless of filter', () => {
      const model = buildHierarchyModel('child', components);
      const filtered = filterHierarchyTree(model.tree, new Set());
      assert.strictEqual(filtered.id, model.tree.id);
      assert.strictEqual(filtered.title, model.tree.title);
    });
  });

  suite('countDescendants', () => {
    test('returns 0 for null or undefined node', () => {
      assert.strictEqual(countDescendants(null), 0);
      assert.strictEqual(countDescendants(undefined), 0);
    });

    test('returns 0 for node with no children', () => {
      assert.strictEqual(countDescendants({ id: 'a', children: [] }), 0);
    });

    test('returns 0 for node with missing children array', () => {
      assert.strictEqual(countDescendants({ id: 'a' }), 0);
    });

    test('counts direct children', () => {
      const node = {
        id: 'root',
        children: [
          { id: 'c1', children: [] },
          { id: 'c2', children: [] }
        ]
      };
      assert.strictEqual(countDescendants(node), 2);
    });

    test('counts nested descendants recursively', () => {
      const node = {
        id: 'root',
        children: [
          {
            id: 'c1',
            children: [
              { id: 'gc1', children: [] },
              { id: 'gc2', children: [] }
            ]
          },
          { id: 'c2', children: [] }
        ]
      };
      // c1 + gc1 + gc2 + c2 = 4
      assert.strictEqual(countDescendants(node), 4);
    });

    test('counts descendants in real hierarchy tree', () => {
      const model = buildHierarchyModel('root', components);
      const count = countDescendants(model.tree);
      assert.ok(count > 0, 'Root node should have descendants');
    });
  });
});
