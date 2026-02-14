const assert = require('assert');
const {
  formatIssuesForClipboard,
  buildPhasedClipboardText
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
});
