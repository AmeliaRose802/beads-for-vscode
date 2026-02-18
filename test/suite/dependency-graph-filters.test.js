const assert = require('assert');
const { register } = require('esbuild-register/dist/node');

register({ extensions: ['.js'], target: 'es2019' });

const {
  filterGraphDataEpicLevel,
  filterGraphDataTaskLevel
} = require('../../webview/components/dependency-graph-utils');

suite('dependency-graph-utils filter functions', () => {
  function makeGraphData(issues, deps) {
    return [{ Issues: issues, Dependencies: deps }];
  }

  const epicIssue = { id: 'E1', title: 'Epic 1', issue_type: 'epic', priority: 1, status: 'open' };
  const epicIssue2 = { id: 'E2', title: 'Epic 2', issue_type: 'epic', priority: 2, status: 'open' };
  const taskIssue = { id: 'T1', title: 'Task 1', issue_type: 'task', priority: 2, status: 'open' };
  const taskIssue2 = { id: 'T2', title: 'Task 2', issue_type: 'task', priority: 2, status: 'open' };
  const bugIssue = { id: 'B1', title: 'Bug 1', issue_type: 'bug', priority: 1, status: 'open' };

  suite('filterGraphDataEpicLevel', () => {
    test('returns empty array for null or non-array input', () => {
      assert.deepStrictEqual(filterGraphDataEpicLevel(null), []);
      assert.deepStrictEqual(filterGraphDataEpicLevel(undefined), []);
      assert.deepStrictEqual(filterGraphDataEpicLevel('not an array'), []);
    });

    test('keeps only epic-type issues', () => {
      const data = makeGraphData([epicIssue, taskIssue, bugIssue], []);
      const result = filterGraphDataEpicLevel(data);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].Issues.length, 1);
      assert.strictEqual(result[0].Issues[0].id, 'E1');
    });

    test('excludes parent-child dependencies', () => {
      const deps = [
        { issue_id: 'T1', depends_on_id: 'E1', dependency_type: 'parent-child' }
      ];
      const data = makeGraphData([epicIssue, taskIssue], deps);
      const result = filterGraphDataEpicLevel(data);
      assert.strictEqual(result[0].Dependencies.length, 0);
    });

    test('maps child blocking deps to epic-level edges', () => {
      const deps = [
        { issue_id: 'T1', depends_on_id: 'E1', dependency_type: 'parent-child' },
        { depends_on_id: 'T1', issue_id: 'E2', dependency_type: 'blocked-by' }
      ];
      const data = makeGraphData([epicIssue, epicIssue2, taskIssue], deps);
      const result = filterGraphDataEpicLevel(data);
      assert.strictEqual(result[0].Dependencies.length, 1);
      assert.strictEqual(result[0].Dependencies[0].depends_on_id, 'E1');
      assert.strictEqual(result[0].Dependencies[0].issue_id, 'E2');
    });

    test('deduplicates collapsed epic edges', () => {
      const deps = [
        { issue_id: 'T1', depends_on_id: 'E1', dependency_type: 'parent-child' },
        { issue_id: 'T2', depends_on_id: 'E1', dependency_type: 'parent-child' },
        { depends_on_id: 'T1', issue_id: 'E2', dependency_type: 'blocked-by' },
        { depends_on_id: 'T2', issue_id: 'E2', dependency_type: 'blocked-by' }
      ];
      const data = makeGraphData([epicIssue, epicIssue2, taskIssue, taskIssue2], deps);
      const result = filterGraphDataEpicLevel(data);
      assert.strictEqual(result[0].Dependencies.length, 1, 'should collapse duplicate epic edges');
    });

    test('filters out components with no epics', () => {
      const data = makeGraphData([taskIssue, bugIssue], []);
      const result = filterGraphDataEpicLevel(data);
      assert.strictEqual(result.length, 0);
    });

    test('excludes intra-epic dependencies', () => {
      const deps = [
        { issue_id: 'T1', depends_on_id: 'E1', dependency_type: 'parent-child' },
        { issue_id: 'T2', depends_on_id: 'E1', dependency_type: 'parent-child' },
        { depends_on_id: 'T1', issue_id: 'T2', dependency_type: 'blocked-by' }
      ];
      const data = makeGraphData([epicIssue, taskIssue, taskIssue2], deps);
      const result = filterGraphDataEpicLevel(data);
      assert.strictEqual(result[0].Dependencies.length, 0, 'intra-epic deps should not appear');
    });
  });

  suite('filterGraphDataTaskLevel', () => {
    test('returns empty array for null or non-array input', () => {
      assert.deepStrictEqual(filterGraphDataTaskLevel(null), []);
      assert.deepStrictEqual(filterGraphDataTaskLevel(undefined), []);
    });

    test('keeps only non-epic issues', () => {
      const data = makeGraphData([epicIssue, taskIssue, bugIssue], []);
      const result = filterGraphDataTaskLevel(data);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].Issues.length, 2);
      const ids = result[0].Issues.map(i => i.id);
      assert.ok(ids.includes('T1'));
      assert.ok(ids.includes('B1'));
      assert.ok(!ids.includes('E1'));
    });

    test('excludes parent-child dependencies', () => {
      const deps = [
        { issue_id: 'T1', depends_on_id: 'E1', dependency_type: 'parent-child' }
      ];
      const data = makeGraphData([epicIssue, taskIssue], deps);
      const result = filterGraphDataTaskLevel(data);
      assert.strictEqual(result[0].Dependencies.length, 0);
    });

    test('keeps inter-task blocking dependencies', () => {
      const deps = [
        { depends_on_id: 'T1', issue_id: 'T2', dependency_type: 'blocked-by' }
      ];
      const data = makeGraphData([taskIssue, taskIssue2], deps);
      const result = filterGraphDataTaskLevel(data);
      assert.strictEqual(result[0].Dependencies.length, 1);
    });

    test('excludes deps that reference epic nodes', () => {
      const deps = [
        { depends_on_id: 'E1', issue_id: 'T1', dependency_type: 'blocked-by' }
      ];
      const data = makeGraphData([epicIssue, taskIssue], deps);
      const result = filterGraphDataTaskLevel(data);
      assert.strictEqual(result[0].Dependencies.length, 0);
    });

    test('filters out components with no tasks', () => {
      const data = makeGraphData([epicIssue], []);
      const result = filterGraphDataTaskLevel(data);
      assert.strictEqual(result.length, 0);
    });
  });
});
