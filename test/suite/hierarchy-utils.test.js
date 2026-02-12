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

  test('cycles are marked to prevent infinite recursion', () => {
    const cyclicComponents = [
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

    const model = buildHierarchyModel('a', cyclicComponents);
    const loopNode = model.tree.children.find(node => node.id === 'b');
    assert.ok(loopNode, 'B should appear as child of A');
    assert.strictEqual(loopNode.children[0].id, 'a');
    assert.strictEqual(loopNode.children[0].isCycle, true);
  });
});
