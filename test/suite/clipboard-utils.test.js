const assert = require('assert');
const {
  formatIssuesForClipboard,
  buildPhasedClipboardText,
  buildMermaidChartText
} = require('../../webview/clipboard-utils');

suite('clipboard-utils', () => {
  suite('formatIssuesForClipboard', () => {
    test('formats numbered list with ids and titles', () => {
      const result = formatIssuesForClipboard([
        { id: 'A-1', title: 'Alpha' },
        { id: 'B-2', title: 'Beta' }
      ]);

      assert.strictEqual(
        result,
        '1. A-1 - Alpha\n2. B-2 - Beta'
      );
    });

    test('includes custom header and start index', () => {
      const result = formatIssuesForClipboard(
        [{ id: 'X', title: 'First' }],
        { header: 'Phase 1', startIndex: 5 }
      );

      assert.strictEqual(result, 'Phase 1\n5. X - First');
    });

    test('handles missing titles gracefully', () => {
      const result = formatIssuesForClipboard([
        { id: 'A', title: '' },
        { id: 'B' }
      ]);

      assert.strictEqual(
        result,
        '1. A - (untitled)\n2. B - (untitled)'
      );
    });

    test('returns empty string for empty list', () => {
      assert.strictEqual(formatIssuesForClipboard([]), '');
    });
  });

  suite('buildPhasedClipboardText', () => {
    test('creates sections per phase with spacing', () => {
      const result = buildPhasedClipboardText([
        [{ id: 'A-1', title: 'Alpha' }],
        [{ id: 'B-2', title: 'Beta' }]
      ]);

      assert.strictEqual(
        result,
        'Phase 1\n1. A-1 - Alpha\n\nPhase 2\n1. B-2 - Beta'
      );
    });

    test('skips empty groups', () => {
      const result = buildPhasedClipboardText([
        [],
        [{ id: 'B-2', title: 'Beta' }]
      ]);

      assert.strictEqual(result, 'Phase 2\n1. B-2 - Beta');
    });

    test('returns empty string when no groups provided', () => {
      assert.strictEqual(buildPhasedClipboardText([]), '');
      assert.strictEqual(buildPhasedClipboardText(null), '');
    });
  });

  suite('buildMermaidChartText', () => {
    test('returns empty string for empty or invalid input', () => {
      assert.strictEqual(buildMermaidChartText([]), '');
      assert.strictEqual(buildMermaidChartText(null), '');
      assert.strictEqual(buildMermaidChartText(undefined), '');
    });

    test('generates node definitions from issues', () => {
      const result = buildMermaidChartText([{
        Issues: [
          { id: 'bd-1', title: 'Fix login' },
          { id: 'bd-2', title: 'Add tests' }
        ],
        Dependencies: []
      }]);

      assert.ok(result.startsWith('graph LR'));
      assert.ok(result.includes('bd-1["bd-1: Fix login"]'));
      assert.ok(result.includes('bd-2["bd-2: Add tests"]'));
    });

    test('generates edges from dependencies', () => {
      const result = buildMermaidChartText([{
        Issues: [
          { id: 'bd-1', title: 'A' },
          { id: 'bd-2', title: 'B' }
        ],
        Dependencies: [{
          depends_on_id: 'bd-1',
          issue_id: 'bd-2',
          type: 'blocks'
        }]
      }]);

      assert.ok(result.includes('bd-1 -->|"blocks"| bd-2'));
    });

    test('deduplicates nodes across components', () => {
      const result = buildMermaidChartText([
        { Issues: [{ id: 'bd-1', title: 'A' }], Dependencies: [] },
        { Issues: [{ id: 'bd-1', title: 'A' }], Dependencies: [] }
      ]);

      const count = (result.match(/bd-1\[/g) || []).length;
      assert.strictEqual(count, 1);
    });

    test('deduplicates edges', () => {
      const result = buildMermaidChartText([{
        Issues: [
          { id: 'bd-1', title: 'A' },
          { id: 'bd-2', title: 'B' }
        ],
        Dependencies: [
          { depends_on_id: 'bd-1', issue_id: 'bd-2', type: 'blocks' },
          { depends_on_id: 'bd-1', issue_id: 'bd-2', type: 'blocks' }
        ]
      }]);

      const count = (result.match(/bd-1 -->/g) || []).length;
      assert.strictEqual(count, 1);
    });

    test('handles missing titles', () => {
      const result = buildMermaidChartText([{
        Issues: [{ id: 'bd-1' }],
        Dependencies: []
      }]);

      assert.ok(result.includes('bd-1["bd-1: (untitled)"]'));
    });

    test('escapes quotes in titles', () => {
      const result = buildMermaidChartText([{
        Issues: [{ id: 'bd-1', title: 'Fix "bug"' }],
        Dependencies: []
      }]);

      assert.ok(result.includes('#quot;'));
      assert.ok(!result.includes('""'));
    });

    test('sanitizes special characters in IDs', () => {
      const result = buildMermaidChartText([{
        Issues: [{ id: 'ns/id.1', title: 'Test' }],
        Dependencies: []
      }]);

      assert.ok(result.includes('ns_id_1["ns/id.1: Test"]'));
    });

    test('skips deps with missing from or to IDs', () => {
      const result = buildMermaidChartText([{
        Issues: [{ id: 'bd-1', title: 'A' }],
        Dependencies: [{ depends_on_id: 'bd-1' }]
      }]);

      assert.ok(!result.includes('-->'));
    });
  });
});
