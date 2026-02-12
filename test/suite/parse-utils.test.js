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
