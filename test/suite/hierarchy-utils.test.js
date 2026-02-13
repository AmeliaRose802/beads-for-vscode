const assert = require('assert');
const { buildHierarchyModel } = require('../../webview/hierarchy-utils');

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

  test('related relationship back-references are marked as cycles', () => {
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
    assert.strictEqual(loopNode.children[0].isCycle, true, 'Related back-reference should be cycle');
    assert.strictEqual(loopNode.children[0].isBackReference, false);
  });
});
