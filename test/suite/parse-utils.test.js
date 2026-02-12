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
