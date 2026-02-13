const assert = require('assert');
const { parseListJSON, parseStatsOutput } = require('../../webview/parse-utils');

suite('Parse Utils Tests', () => {
  suite('parseListJSON', () => {
    test('Should count dependency fields', () => {
      const json = JSON.stringify([{
        id: 'test-1',
        title: 'Issue with deps',
        issue_type: 'task',
        priority: 1,
        status: 'open',
        dependency_count: 3,
        dependent_count: 2
      }]);

      const result = parseListJSON(json, 'list');
      assert.strictEqual(result.openIssues[0].dependency_count, 3);
      assert.strictEqual(result.openIssues[0].dependent_count, 2);
    });

    test('Should default dependency counts to 0', () => {
      const json = JSON.stringify([{
        id: 'test-1',
        title: 'No deps',
        issue_type: 'task',
        priority: 1,
        status: 'open'
      }]);

      const result = parseListJSON(json, 'list');
      assert.strictEqual(result.openIssues[0].dependency_count, 0);
      assert.strictEqual(result.openIssues[0].dependent_count, 0);
    });

    test('Should count only open issues in header', () => {
      const json = JSON.stringify([
        { id: 't-1', title: 'Open', issue_type: 'task', priority: 1, status: 'open' },
        { id: 't-2', title: 'Closed', issue_type: 'task', priority: 1, status: 'closed' }
      ]);

      const result = parseListJSON(json, 'ready');
      assert.strictEqual(result.header, 'Found 1 issue');
    });

    test('Should include labels array when present', () => {
      const json = JSON.stringify([
        {
          id: 't-1',
          title: 'With labels',
          issue_type: 'task',
          priority: 1,
          status: 'open',
          labels: ['frontend', 'urgent']
        }
      ]);

      const result = parseListJSON(json, 'list');
      assert.deepStrictEqual(result.openIssues[0].labels, ['frontend', 'urgent']);
    });

    test('Should default labels to empty array', () => {
      const json = JSON.stringify([
        {
          id: 't-1',
          title: 'No labels',
          issue_type: 'task',
          priority: 1,
          status: 'open'
        }
      ]);

      const result = parseListJSON(json, 'list');
      assert.ok(Array.isArray(result.openIssues[0].labels));
      assert.strictEqual(result.openIssues[0].labels.length, 0);
    });

    test('Should build hierarchy using parent-child edges when graph data provided', () => {
      const json = JSON.stringify([
        { id: 'root-1', title: 'Root Feature', issue_type: 'feature', priority: 1, status: 'open' },
        { id: 'child-1', title: 'Child Task', issue_type: 'task', priority: 2, status: 'open' }
      ]);

      const graph = JSON.stringify([
        {
          Dependencies: [
            { issue_id: 'child-1', depends_on_id: 'root-1', type: 'parent-child' }
          ]
        }
      ]);

      const result = parseListJSON(json, 'list', graph);
      assert.strictEqual(result.hierarchy.length, 1);
      assert.strictEqual(result.hierarchy[0].issue.id, 'root-1');
      assert.strictEqual(result.hierarchy[0].children.length, 1);
      assert.strictEqual(result.hierarchy[0].children[0].issue.id, 'child-1');
    });

    test('Should mark issues as blocked when they have open blocking dependencies', () => {
      const json = JSON.stringify([
        { id: 'blocker-1', title: 'Blocker', issue_type: 'task', priority: 1, status: 'open' },
        { id: 'blocked-1', title: 'Blocked', issue_type: 'task', priority: 2, status: 'open' }
      ]);

      const graph = JSON.stringify([
        {
          IssueMap: {
            'blocker-1': { id: 'blocker-1', status: 'open' },
            'blocked-1': { id: 'blocked-1', status: 'open' }
          },
          Dependencies: [
            { from_id: 'blocker-1', to_id: 'blocked-1', type: 'blocks' }
          ]
        }
      ]);

      const result = parseListJSON(json, 'list', graph);
      assert.strictEqual(result.openIssues.find(i => i.id === 'blocked-1').isBlocked, true);
      assert.strictEqual(result.openIssues.find(i => i.id === 'blocker-1').isBlocked, false);
    });

    test('Should not mark issues as blocked when blockers are closed', () => {
      const json = JSON.stringify([
        { id: 'blocked-1', title: 'Was Blocked', issue_type: 'task', priority: 2, status: 'open' }
      ]);

      const graph = JSON.stringify([
        {
          IssueMap: {
            'blocker-1': { id: 'blocker-1', status: 'closed' },
            'blocked-1': { id: 'blocked-1', status: 'open' }
          },
          Dependencies: [
            { from_id: 'blocker-1', to_id: 'blocked-1', type: 'blocks' }
          ]
        }
      ]);

      const result = parseListJSON(json, 'list', graph);
      assert.strictEqual(result.openIssues[0].isBlocked, false);
    });

    test('Should include blocked count in header', () => {
      const json = JSON.stringify([
        { id: 'a', title: 'A', issue_type: 'task', priority: 1, status: 'open' },
        { id: 'b', title: 'B', issue_type: 'task', priority: 2, status: 'open' },
        { id: 'c', title: 'C', issue_type: 'task', priority: 2, status: 'open' }
      ]);

      const graph = JSON.stringify([
        {
          IssueMap: {
            'a': { id: 'a', status: 'open' },
            'b': { id: 'b', status: 'open' },
            'c': { id: 'c', status: 'open' }
          },
          Dependencies: [
            { from_id: 'a', to_id: 'b', type: 'blocks' }
          ]
        }
      ]);

      const result = parseListJSON(json, 'list', graph);
      assert.strictEqual(result.header, 'Found 3 issues (1 blocked)');
    });

    test('Should not show blocked count when no items are blocked', () => {
      const json = JSON.stringify([
        { id: 'a', title: 'A', issue_type: 'task', priority: 1, status: 'open' }
      ]);

      const result = parseListJSON(json, 'list');
      assert.strictEqual(result.header, 'Found 1 issue');
    });
  });

  suite('parseStatsOutput', () => {
    test('Should parse statistics header', () => {
      const text = '📊 Project Statistics\nTotal: 10\nOpen: 5';
      const result = parseStatsOutput(text);
      assert.strictEqual(result.type, 'stats');
      assert.ok(result.header.includes('Statistics'));
    });

    test('Should parse key-value pairs', () => {
      const text = 'Statistics\nTotal Issues: 10\nOpen: 5\nClosed: 3';
      const result = parseStatsOutput(text);
      assert.strictEqual(result.stats['Total Issues'], '10');
      assert.strictEqual(result.stats['Open'], '5');
      assert.strictEqual(result.stats['Closed'], '3');
    });

    test('Should handle empty input', () => {
      const result = parseStatsOutput('');
      assert.strictEqual(result.type, 'stats');
      assert.strictEqual(result.header, '');
      assert.deepStrictEqual(result.stats, {});
    });

    test('Should skip blank lines', () => {
      const text = 'Statistics\n\nTotal: 10\n\nOpen: 5\n';
      const result = parseStatsOutput(text);
      assert.strictEqual(Object.keys(result.stats).length, 2);
    });
  });
});
