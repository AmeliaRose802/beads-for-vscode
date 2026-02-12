const assert = require('assert');
const { buildCreateCommand, buildUpdateCommand } = require('../../webview/form-handlers');

suite('Form Handlers Tests', () => {
  suite('buildCreateCommand', () => {
    test('Should build basic create command', () => {
      const cmd = buildCreateCommand({
        title: 'Test issue', type: 'bug', priority: '1',
        description: '', parentId: '', blocksId: '', relatedId: '', currentFile: ''
      });
      assert.strictEqual(cmd, 'create --title "Test issue" -t bug -p 1');
    });

    test('Should include description when provided', () => {
      const cmd = buildCreateCommand({
        title: 'Test', type: 'task', priority: '2',
        description: 'A description', parentId: '', blocksId: '', relatedId: '', currentFile: ''
      });
      assert.ok(cmd.includes('-d "A description"'));
    });

    test('Should include file reference in notes', () => {
      const cmd = buildCreateCommand({
        title: 'Test', type: 'task', priority: '2',
        description: '', parentId: '', blocksId: '', relatedId: '', currentFile: 'src/app.js'
      });
      assert.ok(cmd.includes('--notes "File: src/app.js"'));
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
  });

  suite('buildUpdateCommand', () => {
    test('Should build basic update command', () => {
      const cmd = buildUpdateCommand({
        issueId: 'beads_ui-1', title: 'Updated title', type: 'bug',
        priority: '0', description: '', status: 'in_progress'
      });
      assert.ok(cmd.startsWith('update beads_ui-1'));
      assert.ok(cmd.includes('--title "Updated title"'));
      assert.ok(cmd.includes('--type bug'));
      assert.ok(cmd.includes('--priority 0'));
      assert.ok(cmd.includes('--status in_progress'));
    });

    test('Should include description when provided', () => {
      const cmd = buildUpdateCommand({
        issueId: 'x-1', title: 'T', type: 'task',
        priority: '2', description: 'New desc', status: 'open'
      });
      assert.ok(cmd.includes('--description "New desc"'));
    });

    test('Should return null for empty title', () => {
      const cmd = buildUpdateCommand({
        issueId: 'x-1', title: '', type: 'task',
        priority: '2', description: '', status: 'open'
      });
      assert.strictEqual(cmd, null);
    });
  });
});
