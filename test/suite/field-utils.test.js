const assert = require('assert');
const {
  getField,
  getStatusIcon,
  isClosedStatus,
  buildIssueMap,
  DEP_ISSUE_KEYS,
  DEP_TARGET_KEYS,
  DEP_FROM_KEYS,
  DEP_TO_KEYS,
  DEP_TYPE_KEYS
} = require('../../webview/field-utils');

suite('field-utils', () => {
  suite('getField', () => {
    test('returns value for first matching key', () => {
      const obj = { issue_id: 'bd-1', other: 'x' };
      assert.strictEqual(getField(obj, ['issue_id', 'IssueID']), 'bd-1');
    });

    test('falls back to second key if first is missing', () => {
      const obj = { IssueID: 'bd-2' };
      assert.strictEqual(getField(obj, ['issue_id', 'IssueID']), 'bd-2');
    });

    test('returns undefined when no keys match', () => {
      const obj = { unrelated: 'value' };
      assert.strictEqual(getField(obj, ['issue_id', 'IssueID']), undefined);
    });

    test('skips keys with undefined values', () => {
      const obj = { issue_id: undefined, IssueID: 'bd-3' };
      assert.strictEqual(getField(obj, ['issue_id', 'IssueID']), 'bd-3');
    });

    test('returns falsy values that are not undefined', () => {
      const obj = { count: 0 };
      assert.strictEqual(getField(obj, ['count']), 0);
    });

    test('returns empty string as valid value', () => {
      const obj = { name: '' };
      assert.strictEqual(getField(obj, ['name']), '');
    });

    test('returns null as valid value', () => {
      const obj = { val: null };
      assert.strictEqual(getField(obj, ['val']), null);
    });

    test('handles empty keys array', () => {
      assert.strictEqual(getField({ a: 1 }, []), undefined);
    });
  });

  suite('isClosedStatus', () => {
    test('returns true for closed', () => {
      assert.strictEqual(isClosedStatus('closed'), true);
    });

    test('returns true for done', () => {
      assert.strictEqual(isClosedStatus('done'), true);
    });

    test('returns false for open', () => {
      assert.strictEqual(isClosedStatus('open'), false);
    });

    test('returns false for in_progress', () => {
      assert.strictEqual(isClosedStatus('in_progress'), false);
    });

    test('returns false for blocked', () => {
      assert.strictEqual(isClosedStatus('blocked'), false);
    });
  });

  suite('getStatusIcon', () => {
    test('returns ○ for open', () => {
      assert.strictEqual(getStatusIcon('open'), '○');
    });

    test('returns ◐ for in_progress', () => {
      assert.strictEqual(getStatusIcon('in_progress'), '◐');
    });

    test('returns ● for blocked', () => {
      assert.strictEqual(getStatusIcon('blocked'), '●');
    });

    test('returns ✓ for closed', () => {
      assert.strictEqual(getStatusIcon('closed'), '✓');
    });

    test('returns ❄ for deferred', () => {
      assert.strictEqual(getStatusIcon('deferred'), '❄');
    });

    test('returns ○ for unknown status', () => {
      assert.strictEqual(getStatusIcon('whatever'), '○');
    });
  });

  suite('buildIssueMap', () => {
    test('builds map from Issues array', () => {
      const components = [
        { Issues: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }] }
      ];
      const map = buildIssueMap(components);
      assert.strictEqual(map.a.title, 'A');
      assert.strictEqual(map.b.title, 'B');
    });

    test('builds map from IssueMap object', () => {
      const components = [
        { IssueMap: { x: { id: 'x', title: 'X' } } }
      ];
      const map = buildIssueMap(components);
      assert.strictEqual(map.x.title, 'X');
    });

    test('merges Issues and IssueMap', () => {
      const components = [
        {
          IssueMap: { x: { id: 'x', title: 'X' } },
          Issues: [{ id: 'y', title: 'Y' }]
        }
      ];
      const map = buildIssueMap(components);
      assert.ok(map.x);
      assert.ok(map.y);
    });

    test('handles empty components', () => {
      const map = buildIssueMap([]);
      assert.deepStrictEqual(map, {});
    });

    test('handles null components', () => {
      const map = buildIssueMap([null, undefined]);
      assert.deepStrictEqual(map, {});
    });

    test('skips issues without id', () => {
      const components = [
        { Issues: [{ title: 'No ID' }, { id: 'ok', title: 'OK' }] }
      ];
      const map = buildIssueMap(components);
      assert.ok(!map[undefined]);
      assert.strictEqual(map.ok.title, 'OK');
    });

    test('merges multiple components', () => {
      const components = [
        { Issues: [{ id: 'a', title: 'A' }] },
        { Issues: [{ id: 'b', title: 'B' }] }
      ];
      const map = buildIssueMap(components);
      assert.ok(map.a);
      assert.ok(map.b);
    });
  });

  suite('exported key arrays', () => {
    test('DEP_ISSUE_KEYS is non-empty array', () => {
      assert.ok(Array.isArray(DEP_ISSUE_KEYS));
      assert.ok(DEP_ISSUE_KEYS.length > 0);
    });

    test('DEP_TARGET_KEYS is non-empty array', () => {
      assert.ok(Array.isArray(DEP_TARGET_KEYS));
      assert.ok(DEP_TARGET_KEYS.length > 0);
    });

    test('DEP_FROM_KEYS is non-empty array', () => {
      assert.ok(Array.isArray(DEP_FROM_KEYS));
      assert.ok(DEP_FROM_KEYS.length > 0);
    });

    test('DEP_TO_KEYS is non-empty array', () => {
      assert.ok(Array.isArray(DEP_TO_KEYS));
      assert.ok(DEP_TO_KEYS.length > 0);
    });

    test('DEP_TYPE_KEYS is non-empty array', () => {
      assert.ok(Array.isArray(DEP_TYPE_KEYS));
      assert.ok(DEP_TYPE_KEYS.length > 0);
    });
  });
});
