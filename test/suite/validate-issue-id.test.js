const assert = require('assert');
const {
  ISSUE_ID_PATTERN,
  isValidIssueId,
  validateIssueId,
  validateIssueIds
} = require('../../validate-issue-id');

suite('validate-issue-id', () => {
  suite('ISSUE_ID_PATTERN', () => {
    test('matches valid IDs with alphanumeric prefix and suffix', () => {
      assert.ok(ISSUE_ID_PATTERN.test('beads_ui-f27t'));
      assert.ok(ISSUE_ID_PATTERN.test('bd-123'));
      assert.ok(ISSUE_ID_PATTERN.test('my_project-abc'));
      assert.ok(ISSUE_ID_PATTERN.test('A-1'));
      assert.ok(ISSUE_ID_PATTERN.test('test123-xyz789'));
    });

    test('rejects IDs with spaces', () => {
      assert.ok(!ISSUE_ID_PATTERN.test('bd 123'));
      assert.ok(!ISSUE_ID_PATTERN.test(' bd-123'));
      assert.ok(!ISSUE_ID_PATTERN.test('bd-123 '));
      assert.ok(!ISSUE_ID_PATTERN.test('bd- 123'));
    });

    test('rejects IDs without hyphen separator', () => {
      assert.ok(!ISSUE_ID_PATTERN.test('bd123'));
      assert.ok(!ISSUE_ID_PATTERN.test('bdabc'));
    });

    test('rejects IDs with special characters', () => {
      assert.ok(!ISSUE_ID_PATTERN.test('bd-123!'));
      assert.ok(!ISSUE_ID_PATTERN.test('../etc-passwd'));
      assert.ok(!ISSUE_ID_PATTERN.test('bd-123;rm'));
      assert.ok(!ISSUE_ID_PATTERN.test('bd-123|cat'));
      assert.ok(!ISSUE_ID_PATTERN.test('bd-123&rm'));
    });

    test('rejects empty strings', () => {
      assert.ok(!ISSUE_ID_PATTERN.test(''));
    });

    test('rejects IDs starting or ending with hyphen', () => {
      assert.ok(!ISSUE_ID_PATTERN.test('-abc'));
      assert.ok(!ISSUE_ID_PATTERN.test('abc-'));
      assert.ok(!ISSUE_ID_PATTERN.test('-'));
    });

    test('rejects IDs with multiple hyphens in suffix', () => {
      assert.ok(!ISSUE_ID_PATTERN.test('bd-123-456'));
    });
  });

  suite('isValidIssueId', () => {
    test('returns true for valid IDs', () => {
      assert.strictEqual(isValidIssueId('beads_ui-f27t'), true);
      assert.strictEqual(isValidIssueId('bd-1'), true);
      assert.strictEqual(isValidIssueId('project_name-abc123'), true);
    });

    test('returns false for invalid IDs', () => {
      assert.strictEqual(isValidIssueId('bd 123'), false);
      assert.strictEqual(isValidIssueId(''), false);
      assert.strictEqual(isValidIssueId('../etc'), false);
    });

    test('returns false for non-string inputs', () => {
      assert.strictEqual(isValidIssueId(null), false);
      assert.strictEqual(isValidIssueId(undefined), false);
      assert.strictEqual(isValidIssueId(123), false);
      assert.strictEqual(isValidIssueId({}), false);
      assert.strictEqual(isValidIssueId([]), false);
    });
  });

  suite('validateIssueId', () => {
    test('does not throw for valid IDs', () => {
      assert.doesNotThrow(() => validateIssueId('beads_ui-f27t'));
      assert.doesNotThrow(() => validateIssueId('bd-123'));
      assert.doesNotThrow(() => validateIssueId('my_project-xyz'));
    });

    test('throws for invalid IDs', () => {
      assert.throws(
        () => validateIssueId('bd 123'),
        /Invalid Issue ID/
      );
      assert.throws(
        () => validateIssueId(''),
        /Invalid Issue ID/
      );
    });

    test('includes custom context in error message', () => {
      assert.throws(
        () => validateIssueId('bad id', 'epicA'),
        /Invalid epicA/
      );
    });

    test('includes the invalid ID in error message', () => {
      assert.throws(
        () => validateIssueId('bad id'),
        /"bad id"/
      );
    });

    test('suggests correct format in error message', () => {
      assert.throws(
        () => validateIssueId('bad'),
        /prefix-suffix/
      );
    });
  });

  suite('validateIssueIds', () => {
    test('does not throw for array of valid IDs', () => {
      assert.doesNotThrow(() => validateIssueIds(['bd-1', 'bd-2', 'bd-3']));
      assert.doesNotThrow(() => validateIssueIds([]));
    });

    test('throws for array containing invalid ID', () => {
      assert.throws(
        () => validateIssueIds(['bd-1', 'bad id', 'bd-3']),
        /Invalid/
      );
    });

    test('throws for non-array input', () => {
      assert.throws(
        () => validateIssueIds('bd-1'),
        /Expected array/
      );
      assert.throws(
        () => validateIssueIds(null),
        /Expected array/
      );
    });

    test('uses custom context in error messages', () => {
      assert.throws(
        () => validateIssueIds(['bad id'], 'issueId'),
        /Invalid issueId/
      );
    });
  });
});

suite('validate-issue-id integration', () => {
  test('validates real-world beads IDs', () => {
    const realIds = [
      'beads_ui-f27t',
      'beads_ui-abc1',
      'myproject-task42'
    ];
    for (const id of realIds) {
      assert.doesNotThrow(
        () => validateIssueId(id),
        `Expected "${id}" to be valid`
      );
    }
  });

  test('rejects IDs that could cause argument splitting', () => {
    const dangerousIds = [
      'bd -rf',
      'bd --help',
      'bd\t123',
      'bd\n123'
    ];
    for (const id of dangerousIds) {
      assert.throws(
        () => validateIssueId(id),
        /Invalid/,
        `Expected "${id}" to be rejected`
      );
    }
  });

  test('rejects IDs that could be path traversal attempts', () => {
    const pathTraversalIds = [
      '../etc-passwd',
      '..\\windows-system32',
      './local-file'
    ];
    for (const id of pathTraversalIds) {
      assert.throws(
        () => validateIssueId(id),
        /Invalid/,
        `Expected "${id}" to be rejected`
      );
    }
  });
});
