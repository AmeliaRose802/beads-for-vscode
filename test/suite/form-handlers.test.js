const assert = require('assert');
const { buildCreateCommand, buildUpdateCommand, escapeShellArg, safeShellArg } = require('../../webview/form-handlers');

suite('Form Handlers Tests', () => {
  // Cross-platform: always double-quote
  const q = '"';
  
  suite('escapeShellArg', () => {
    test('Should escape double quotes', function() {
      assert.strictEqual(escapeShellArg('test"quote'), 'test\\"quote');
    });

    test('Should escape backslashes', function() {
      assert.strictEqual(escapeShellArg('test\\path'), 'test\\\\path');
    });

    test('Should escape dollar signs', function() {
      assert.strictEqual(escapeShellArg('test$var'), 'test\\$var');
    });

    test('Should escape backticks', function() {
      assert.strictEqual(escapeShellArg('test`cmd`'), 'test\\`cmd\\`');
    });

    test('Should escape exclamation marks', function() {
      assert.strictEqual(escapeShellArg('test!bang'), 'test\\!bang');
    });

    test('Should prevent command injection with semicolon', () => {
      const escaped = safeShellArg('test; rm -rf /');
      assert.ok(escaped.startsWith(q) && escaped.endsWith(q), 'Should be quoted');
      // The semicolon is safely contained within double quotes
      assert.ok(escaped.includes('test; rm -rf /'), 'Content should be preserved inside quotes');
    });

    test('Should prevent command injection with pipe', () => {
      const escaped = safeShellArg('test | cat /etc/passwd');
      assert.ok(escaped.startsWith(q) && escaped.endsWith(q), 'Should be quoted');
    });

    test('Should prevent command injection with backticks', () => {
      const escaped = safeShellArg('test`whoami`');
      assert.ok(escaped.startsWith(q) && escaped.endsWith(q), 'Should be quoted');
      assert.ok(escaped.includes('\\`'), 'Backticks should be escaped');
    });

    test('Should prevent command injection with $() subshell', () => {
      const escaped = safeShellArg('test$(whoami)');
      assert.ok(escaped.startsWith(q) && escaped.endsWith(q), 'Should be quoted');
      assert.ok(escaped.includes('\\$'), 'Dollar sign should be escaped');
    });

    test('Should prevent command injection with newline and additional command', () => {
      const escaped = safeShellArg('test\nrm -rf /');
      assert.ok(escaped.startsWith(q) && escaped.endsWith(q), 'Should be quoted');
    });

    test('Should handle empty string', () => {
      assert.strictEqual(safeShellArg(''), q + q);
    });

    test('Should handle non-string input', () => {
      assert.strictEqual(escapeShellArg(null), '');
      assert.strictEqual(escapeShellArg(undefined), '');
      assert.strictEqual(escapeShellArg(123), '');
    });
  });

  suite('buildCreateCommand', () => {
    test('Should build basic create command', () => {
      const cmd = buildCreateCommand({
        title: 'Test issue', type: 'bug', priority: '1',
        description: '', parentId: '', blocksId: '', relatedId: '', currentFile: ''
      });
      assert.ok(cmd.includes('create --title'));
      assert.ok(cmd.includes('Test issue'));
      assert.ok(cmd.includes('-t bug -p 1'));
    });

    test('Should include description when provided', () => {
      const cmd = buildCreateCommand({
        title: 'Test', type: 'task', priority: '2',
        description: 'A description', parentId: '', blocksId: '', relatedId: '', currentFile: ''
      });
      assert.ok(cmd.includes('-d'));
      assert.ok(cmd.includes('A description'));
    });

    test('Should include file reference in notes', () => {
      const cmd = buildCreateCommand({
        title: 'Test', type: 'task', priority: '2',
        description: '', parentId: '', blocksId: '', relatedId: '', currentFile: 'src/app.js'
      });
      assert.ok(cmd.includes('--notes'));
      assert.ok(cmd.includes('File: src/app.js'));
    });

    test('Should include parent dependency', () => {
      const cmd = buildCreateCommand({
        title: 'Test', type: 'task', priority: '2',
        description: '', parentId: 'beads_ui-5', blocksId: '', relatedId: '', currentFile: ''
      });
      assert.ok(cmd.includes('--deps parent:beads_ui-5'));
    });

    test('Should include blocks dependency', () => {
      const cmd = buildCreateCommand({
        title: 'Test', type: 'task', priority: '2',
        description: '', parentId: '', blocksId: 'beads_ui-10', relatedId: '', currentFile: ''
      });
      assert.ok(cmd.includes('--deps blocks:beads_ui-10'));
    });

    test('Should include related dependency', () => {
      const cmd = buildCreateCommand({
        title: 'Test', type: 'task', priority: '2',
        description: '', parentId: '', blocksId: '', relatedId: 'beads_ui-3', currentFile: ''
      });
      assert.ok(cmd.includes('--deps related:beads_ui-3'));
    });

    test('Should include all dependencies when provided', () => {
      const cmd = buildCreateCommand({
        title: 'Test', type: 'feature', priority: '0',
        description: '', parentId: 'p1', blocksId: 'b1', relatedId: 'r1', currentFile: ''
      });
      assert.ok(cmd.includes('--deps parent:p1'));
      assert.ok(cmd.includes('--deps blocks:b1'));
      assert.ok(cmd.includes('--deps related:r1'));
    });

    test('Should return null for empty title', () => {
      const cmd = buildCreateCommand({
        title: '', type: 'task', priority: '2',
        description: '', parentId: '', blocksId: '', relatedId: '', currentFile: ''
      });
      assert.strictEqual(cmd, null);
    });

    test('Should return null for whitespace-only title', () => {
      const cmd = buildCreateCommand({
        title: '   ', type: 'task', priority: '2',
        description: '', parentId: '', blocksId: '', relatedId: '', currentFile: ''
      });
      assert.strictEqual(cmd, null);
    });

    test('SECURITY: Should escape command injection in title', () => {
      const cmd = buildCreateCommand({
        title: 'test"; rm -rf /; echo "', type: 'bug', priority: '0',
        description: '', parentId: '', blocksId: '', relatedId: '', currentFile: ''
      });
      // The command should not contain unescaped shell metacharacters
      assert.ok(cmd, 'Command should be generated');
      // Verify the dangerous command is escaped and won't execute
      assert.ok(!cmd.match(/[^\\]"; rm/), 'Should not contain unescaped command injection');
    });

    test('SECURITY: Should escape command injection in description', () => {
      const cmd = buildCreateCommand({
        title: 'Safe title', type: 'bug', priority: '0',
        description: '$(whoami) | cat /etc/passwd', parentId: '', blocksId: '', relatedId: '', currentFile: ''
      });
      assert.ok(cmd, 'Command should be generated');
      assert.ok(cmd.includes('\\$'), 'Dollar sign should be escaped');
    });

    test('SECURITY: Should escape backticks in title', () => {
      const cmd = buildCreateCommand({
        title: 'test`whoami`test', type: 'bug', priority: '0',
        description: '', parentId: '', blocksId: '', relatedId: '', currentFile: ''
      });
      assert.ok(cmd, 'Command should be generated');
      // Backticks should not be executable
      assert.ok(!cmd.match(/[^\\]`whoami`/), 'Backticks should be escaped');
    });

    test('SECURITY: Should escape newlines that could chain commands', () => {
      const cmd = buildCreateCommand({
        title: 'test\nrm -rf /', type: 'bug', priority: '0',
        description: '', parentId: '', blocksId: '', relatedId: '', currentFile: ''
      });
      assert.ok(cmd, 'Command should be generated');
    });
  });

  suite('buildUpdateCommand', () => {
    test('Should build basic update command', () => {
      const cmd = buildUpdateCommand({
        issueId: 'beads_ui-1', title: 'Updated title', type: 'bug',
        priority: '0', description: '', status: 'in_progress'
      });
      assert.ok(cmd.startsWith('update beads_ui-1'));
      assert.ok(cmd.includes('--title'));
      assert.ok(cmd.includes('Updated title'));
      assert.ok(cmd.includes('--type bug'));
      assert.ok(cmd.includes('--priority 0'));
      assert.ok(cmd.includes('--status in_progress'));
    });

    test('Should include description when provided', () => {
      const cmd = buildUpdateCommand({
        issueId: 'x-1', title: 'T', type: 'task',
        priority: '2', description: 'New desc', status: 'open'
      });
      assert.ok(cmd.includes('--description'));
      assert.ok(cmd.includes('New desc'));
    });

    test('Should return null for empty title', () => {
      const cmd = buildUpdateCommand({
        issueId: 'x-1', title: '', type: 'task',
        priority: '2', description: '', status: 'open'
      });
      assert.strictEqual(cmd, null);
    });

    test('SECURITY: Should escape command injection in title', () => {
      const cmd = buildUpdateCommand({
        issueId: 'x-1', title: 'test"; rm -rf /; echo "', type: 'bug',
        priority: '0', description: '', status: 'open'
      });
      assert.ok(cmd, 'Command should be generated');
      assert.ok(!cmd.match(/[^\\]"; rm/), 'Should not contain unescaped command injection');
    });

    test('SECURITY: Should escape command injection in description', () => {
      const cmd = buildUpdateCommand({
        issueId: 'x-1', title: 'Safe', type: 'bug',
        priority: '0', description: '$(whoami)', status: 'open'
      });
      assert.ok(cmd, 'Command should be generated');
      assert.ok(cmd.includes('\\$'), 'Dollar sign should be escaped');
    });
  });
});
