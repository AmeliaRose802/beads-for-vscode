const assert = require('assert');
const {
  buildBlockingModel,
  topologicalSort,
  findCriticalPath,
  findReadyItems,
  findParallelGroups,
  applyFilters
} = require('../../webview/blocking-utils');

suite('blocking-utils', () => {
  // Shared fixture: linear chain where B depends on A and C depends on B.
  // In beads graph data this is represented as issue -> depends_on.
  const linearComponents = [
    {
      Issues: [
        { id: 'a', title: 'A', status: 'open', priority: 1, issue_type: 'task' },
        { id: 'b', title: 'B', status: 'open', priority: 2, issue_type: 'task' },
        { id: 'c', title: 'C', status: 'open', priority: 1, issue_type: 'bug' }
      ],
      Dependencies: [
        { issue_id: 'b', depends_on_id: 'a', type: 'blocks' },
        { issue_id: 'c', depends_on_id: 'b', type: 'blocks' }
      ]
    }
  ];

  // Diamond: B and C both depend on A, and D depends on both B and C.
  const diamondComponents = [
    {
      Issues: [
        { id: 'a', title: 'A', status: 'open', priority: 0, issue_type: 'task' },
        { id: 'b', title: 'B', status: 'open', priority: 1, issue_type: 'task' },
        { id: 'c', title: 'C', status: 'open', priority: 2, issue_type: 'task' },
        { id: 'd', title: 'D', status: 'open', priority: 1, issue_type: 'task' }
      ],
      Dependencies: [
        { issue_id: 'b', depends_on_id: 'a', type: 'blocks' },
        { issue_id: 'c', depends_on_id: 'a', type: 'blocks' },
        { issue_id: 'd', depends_on_id: 'b', type: 'blocks' },
        { issue_id: 'd', depends_on_id: 'c', type: 'blocks' }
      ]
    }
  ];

  suite('topologicalSort', () => {
    test('sorts linear chain in dependency order', () => {
      const edges = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' }
      ];
      const result = topologicalSort(['a', 'b', 'c'], edges);
      assert.strictEqual(result.indexOf('a') < result.indexOf('b'), true);
      assert.strictEqual(result.indexOf('b') < result.indexOf('c'), true);
    });

    test('handles no edges', () => {
      const result = topologicalSort(['x', 'y', 'z'], []);
      assert.strictEqual(result.length, 3);
      assert.ok(result.includes('x'));
      assert.ok(result.includes('y'));
      assert.ok(result.includes('z'));
    });

    test('handles single node', () => {
      const result = topologicalSort(['only'], []);
      assert.deepStrictEqual(result, ['only']);
    });

    test('handles empty input', () => {
      const result = topologicalSort([], []);
      assert.deepStrictEqual(result, []);
    });

    test('handles cycles without crashing', () => {
      const edges = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' }
      ];
      const result = topologicalSort(['a', 'b'], edges);
      assert.strictEqual(result.length, 2);
      assert.ok(result.includes('a'));
      assert.ok(result.includes('b'));
    });

    test('diamond dependencies maintain order', () => {
      const edges = [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'c' },
        { from: 'b', to: 'd' },
        { from: 'c', to: 'd' }
      ];
      const result = topologicalSort(['a', 'b', 'c', 'd'], edges);
      assert.strictEqual(result.indexOf('a') < result.indexOf('b'), true);
      assert.strictEqual(result.indexOf('a') < result.indexOf('c'), true);
      assert.strictEqual(result.indexOf('b') < result.indexOf('d'), true);
      assert.strictEqual(result.indexOf('c') < result.indexOf('d'), true);
    });
  });

  suite('findCriticalPath', () => {
    test('finds longest chain in linear graph', () => {
      const edges = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' }
      ];
      const path = findCriticalPath(['a', 'b', 'c'], edges);
      assert.deepStrictEqual(path, ['a', 'b', 'c']);
    });

    test('finds correct path in diamond', () => {
      const edges = [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'c' },
        { from: 'b', to: 'd' },
        { from: 'c', to: 'd' }
      ];
      const path = findCriticalPath(['a', 'b', 'c', 'd'], edges);
      // Path should be length 3 (a -> b/c -> d)
      assert.strictEqual(path.length, 3);
      assert.strictEqual(path[0], 'a');
      assert.strictEqual(path[path.length - 1], 'd');
    });

    test('returns single node for no edges', () => {
      const path = findCriticalPath(['x'], []);
      assert.strictEqual(path.length, 1);
    });

    test('returns empty for empty input', () => {
      const path = findCriticalPath([], []);
      assert.deepStrictEqual(path, []);
    });

    test('prioritizes higher-priority shorter chain over longer lower-priority chain', () => {
      const edges = [
        { from: 'p1a', to: 'p1b' },
        { from: 'p2a', to: 'p2b' },
        { from: 'p2b', to: 'p2c' },
        { from: 'p2c', to: 'p2d' }
      ];

      const issueMap = {
        p1a: { id: 'p1a', priority: 1 },
        p1b: { id: 'p1b', priority: 1 },
        p2a: { id: 'p2a', priority: 2 },
        p2b: { id: 'p2b', priority: 2 },
        p2c: { id: 'p2c', priority: 2 },
        p2d: { id: 'p2d', priority: 2 }
      };

      const path = findCriticalPath(
        ['p1a', 'p1b', 'p2a', 'p2b', 'p2c', 'p2d'],
        edges,
        issueMap
      );

      assert.deepStrictEqual(path, ['p1a', 'p1b']);
    });
  });

  suite('findReadyItems', () => {
    test('identifies unblocked items', () => {
      const edges = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' }
      ];
      const issueMap = {
        a: { id: 'a', status: 'open' },
        b: { id: 'b', status: 'open' },
        c: { id: 'c', status: 'open' }
      };
      const ready = findReadyItems(['a', 'b', 'c'], edges, issueMap);
      assert.deepStrictEqual(ready, ['a']);
    });

    test('marks items as ready when blockers are closed', () => {
      const edges = [{ from: 'a', to: 'b' }];
      const issueMap = {
        a: { id: 'a', status: 'closed' },
        b: { id: 'b', status: 'open' }
      };
      const ready = findReadyItems(['a', 'b'], edges, issueMap);
      assert.deepStrictEqual(ready, ['b']);
    });

    test('excludes closed items from ready list', () => {
      const issueMap = {
        a: { id: 'a', status: 'closed' }
      };
      const ready = findReadyItems(['a'], [], issueMap);
      assert.deepStrictEqual(ready, []);
    });

    test('all items ready when no edges', () => {
      const issueMap = {
        a: { id: 'a', status: 'open' },
        b: { id: 'b', status: 'open' }
      };
      const ready = findReadyItems(['a', 'b'], [], issueMap);
      assert.deepStrictEqual(ready, ['a', 'b']);
    });
  });

  suite('findParallelGroups', () => {
    test('groups items at same depth', () => {
      const edges = [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'c' },
        { from: 'b', to: 'd' },
        { from: 'c', to: 'd' }
      ];
      const groups = findParallelGroups(['a', 'b', 'c', 'd'], edges);
      assert.strictEqual(groups.length, 3);
      assert.deepStrictEqual(groups[0], ['a']);
      assert.ok(groups[1].includes('b') && groups[1].includes('c'));
      assert.deepStrictEqual(groups[2], ['d']);
    });

    test('does not increase phase when blocker is closed', () => {
      const edges = [{ from: 'a', to: 'b' }];
      const issueMap = {
        a: { id: 'a', status: 'closed' },
        b: { id: 'b', status: 'open' }
      };

      const groups = findParallelGroups(['a', 'b'], edges, issueMap);
      assert.strictEqual(groups.length, 1);
      assert.ok(groups[0].includes('b'));
    });

    test('single group when no edges', () => {
      const groups = findParallelGroups(['a', 'b', 'c'], []);
      assert.strictEqual(groups.length, 1);
      assert.strictEqual(groups[0].length, 3);
    });

    test('returns empty for empty input', () => {
      const groups = findParallelGroups([], []);
      assert.deepStrictEqual(groups, []);
    });
  });

  suite('applyFilters', () => {
    const issueMap = {
      a: { id: 'a', priority: 0, assignee: 'alice', labels: ['security'] },
      b: { id: 'b', priority: 1, assignee: 'bob', labels: ['backend'] },
      c: { id: 'c', priority: 2, assignee: 'alice', labels: ['frontend'] }
    };

    test('filters by priority', () => {
      const result = applyFilters(['a', 'b', 'c'], issueMap, { priority: 0 });
      assert.deepStrictEqual(result, ['a']);
    });

    test('filters by assignee', () => {
      const result = applyFilters(['a', 'b', 'c'], issueMap, { assignee: 'alice' });
      assert.deepStrictEqual(result, ['a', 'c']);
    });

    test('filters by label', () => {
      const result = applyFilters(['a', 'b', 'c'], issueMap, { label: 'backend' });
      assert.deepStrictEqual(result, ['b']);
    });

    test('combines multiple filters', () => {
      const result = applyFilters(['a', 'b', 'c'], issueMap, { priority: 0, assignee: 'alice' });
      assert.deepStrictEqual(result, ['a']);
    });

    test('returns all when no filters match criteria', () => {
      const result = applyFilters(['a', 'b', 'c'], issueMap, {});
      assert.deepStrictEqual(result, ['a', 'b', 'c']);
    });
  });

  suite('buildBlockingModel', () => {
    test('builds complete model from linear components', () => {
      const model = buildBlockingModel(linearComponents);
      assert.ok(model.issues.length > 0);
      assert.ok(model.completionOrder.length > 0);
      assert.ok(model.criticalPath.length > 0);
      assert.ok(model.readyItems.length > 0);
    });

    test('completion order respects dependencies', () => {
      const model = buildBlockingModel(linearComponents);
      const orderIds = model.completionOrder.map(i => i.id);
      assert.strictEqual(orderIds.indexOf('a') < orderIds.indexOf('b'), true);
      assert.strictEqual(orderIds.indexOf('b') < orderIds.indexOf('c'), true);
    });

    test('critical path is the full linear chain', () => {
      const model = buildBlockingModel(linearComponents);
      const pathIds = model.criticalPath.map(i => i.id);
      assert.deepStrictEqual(pathIds, ['a', 'b', 'c']);
    });

    test('only root items are ready in linear chain', () => {
      const model = buildBlockingModel(linearComponents);
      const readyIds = model.readyItems.map(i => i.id);
      assert.deepStrictEqual(readyIds, ['a']);
    });

    test('identifies parallel opportunities in diamond', () => {
      const model = buildBlockingModel(diamondComponents);
      const hasParallel = model.parallelGroups.some(g => g.length > 1);
      assert.ok(hasParallel, 'Diamond should have parallel group with b and c');
    });

    test('applies filters to model', () => {
      const model = buildBlockingModel(linearComponents, { priority: 1 });
      const ids = model.issues.map(i => i.id);
      assert.ok(ids.includes('a'));
      assert.ok(ids.includes('c'));
      assert.ok(!ids.includes('b'));
    });

    test('returns empty model for null input', () => {
      const model = buildBlockingModel(null);
      assert.deepStrictEqual(model.issues, []);
      assert.deepStrictEqual(model.completionOrder, []);
    });

    test('returns empty model for empty array', () => {
      const model = buildBlockingModel([]);
      assert.deepStrictEqual(model.issues, []);
    });

    test('handles blocked-by edge type', () => {
      const components = [
        {
          Issues: [
            { id: 'x', title: 'X', status: 'open', priority: 1, issue_type: 'task' },
            { id: 'y', title: 'Y', status: 'open', priority: 1, issue_type: 'task' }
          ],
          Dependencies: [
            { from_id: 'y', to_id: 'x', type: 'blocked-by' }
          ]
        }
      ];
      const model = buildBlockingModel(components);
      // blocked-by reverses: x blocks y
      const orderIds = model.completionOrder.map(i => i.id);
      assert.strictEqual(orderIds.indexOf('x') < orderIds.indexOf('y'), true);
    });

    test('critical path favors higher-priority shorter chain', () => {
      const components = [
        {
          Issues: [
            { id: 'p1a', title: 'P1 A', status: 'open', priority: 1, issue_type: 'bug' },
            { id: 'p1b', title: 'P1 B', status: 'open', priority: 1, issue_type: 'bug' },
            { id: 'p2a', title: 'P2 A', status: 'open', priority: 2, issue_type: 'task' },
            { id: 'p2b', title: 'P2 B', status: 'open', priority: 2, issue_type: 'task' },
            { id: 'p2c', title: 'P2 C', status: 'open', priority: 2, issue_type: 'task' }
          ],
          Dependencies: [
            { from_id: 'p1a', to_id: 'p1b', type: 'blocks' },
            { from_id: 'p2a', to_id: 'p2b', type: 'blocks' },
            { from_id: 'p2b', to_id: 'p2c', type: 'blocks' }
          ]
        }
      ];

      const model = buildBlockingModel(components);
      const pathIds = model.criticalPath.map(i => i.id);
      assert.deepStrictEqual(pathIds, ['p1a', 'p1b']);
    });

    test('ignores non-blocking edge types', () => {
      const components = [
        {
          Issues: [
            { id: 'a', title: 'A', status: 'open', priority: 1, issue_type: 'task' },
            { id: 'b', title: 'B', status: 'open', priority: 1, issue_type: 'task' }
          ],
          Dependencies: [
            { from_id: 'a', to_id: 'b', type: 'related' }
          ]
        }
      ];
      const model = buildBlockingModel(components);
      assert.strictEqual(model.edges.length, 0);
      assert.strictEqual(model.readyItems.length, 2);
    });

    test('parent-child edges do not create false blocking cycles', () => {
      const components = [
        {
          Issues: [
            { id: 'epic', title: 'Epic', status: 'open', priority: 1, issue_type: 'epic' },
            { id: 'a', title: 'A', status: 'open', priority: 1, issue_type: 'task' },
            { id: 'b', title: 'B', status: 'open', priority: 1, issue_type: 'task' },
            { id: 'c', title: 'C', status: 'open', priority: 1, issue_type: 'task' }
          ],
          Dependencies: [
            { issue_id: 'a', depends_on_id: 'epic', type: 'parent-child' },
            { issue_id: 'b', depends_on_id: 'epic', type: 'parent-child' },
            { issue_id: 'c', depends_on_id: 'epic', type: 'parent-child' },
            { issue_id: 'b', depends_on_id: 'a', type: 'blocks' },
            { issue_id: 'c', depends_on_id: 'b', type: 'blocks' }
          ]
        }
      ];
      const model = buildBlockingModel(components);
      // Only blocks edges should appear, not parent-child
      assert.strictEqual(model.edges.length, 2);
      const orderIds = model.completionOrder.map(i => i.id);
      assert.strictEqual(orderIds.indexOf('a') < orderIds.indexOf('b'), true);
      assert.strictEqual(orderIds.indexOf('b') < orderIds.indexOf('c'), true);
    });

    test('closed blockers do not push items into later phases', () => {
      const components = [
        {
          Issues: [
            { id: 'a', title: 'A', status: 'closed', priority: 1, issue_type: 'task' },
            { id: 'b', title: 'B', status: 'open', priority: 1, issue_type: 'task' },
            { id: 'c', title: 'C', status: 'open', priority: 1, issue_type: 'task' }
          ],
          Dependencies: [
            { issue_id: 'b', depends_on_id: 'a', type: 'blocks' },
            { issue_id: 'c', depends_on_id: 'b', type: 'blocks' }
          ]
        }
      ];
      const model = buildBlockingModel(components);
      // a is closed, so b should be in Phase 1 (unblocked), c in Phase 2
      assert.strictEqual(model.parallelGroups.length, 2);
      assert.ok(model.parallelGroups[0].some(i => i.id === 'b'));
      assert.ok(model.parallelGroups[1].some(i => i.id === 'c'));
    });

    test('beads orientation produces correct phase order', () => {
      const components = [
        {
          Issues: [
            { id: 'v', title: 'Versioning', status: 'open', priority: 1, issue_type: 'task' },
            { id: 'p', title: 'Packaging', status: 'open', priority: 1, issue_type: 'task' },
            { id: 'u', title: 'UI button', status: 'open', priority: 1, issue_type: 'task' },
            { id: 'd', title: 'Docs', status: 'open', priority: 1, issue_type: 'task' }
          ],
          Dependencies: [
            { issue_id: 'p', depends_on_id: 'v', type: 'blocks' },
            { issue_id: 'u', depends_on_id: 'p', type: 'blocks' },
            { issue_id: 'd', depends_on_id: 'u', type: 'blocks' }
          ]
        }
      ];
      const model = buildBlockingModel(components);
      // Phase 1: v (no blockers)
      // Phase 2: p (blocked by v)
      // Phase 3: u (blocked by p)
      // Phase 4: d (blocked by u)
      assert.strictEqual(model.parallelGroups.length, 4);
      assert.deepStrictEqual(model.parallelGroups[0].map(i => i.id), ['v']);
      assert.deepStrictEqual(model.parallelGroups[1].map(i => i.id), ['p']);
      assert.deepStrictEqual(model.parallelGroups[2].map(i => i.id), ['u']);
      assert.deepStrictEqual(model.parallelGroups[3].map(i => i.id), ['d']);
    });
  });
});
