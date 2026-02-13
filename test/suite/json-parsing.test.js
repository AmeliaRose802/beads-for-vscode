const assert = require('assert');
const { parseListJSON } = require('../../webview/parse-utils');

suite('JSON Parsing Tests', () => {

  test('Should parse empty JSON array', () => {
    const json = '[]';
    const result = parseListJSON(json, 'list');
    
    assert.strictEqual(result.type, 'list');
    assert.strictEqual(result.openIssues.length, 0);
    assert.strictEqual(result.closedIssues.length, 0);
    assert.strictEqual(result.header, 'Found 0 issues');
  });

  test('Should parse single open issue', () => {
    const json = JSON.stringify([{
      id: 'test-1',
      title: 'Test Issue',
      issue_type: 'bug',
      priority: 1,
      status: 'open',
      created_at: '2025-12-08T10:00:00Z'
    }]);
    
    const result = parseListJSON(json, 'list');
    
    assert.strictEqual(result.type, 'list');
    assert.strictEqual(result.openIssues.length, 1);
    assert.strictEqual(result.closedIssues.length, 0);
    assert.strictEqual(result.openIssues[0].id, 'test-1');
    assert.strictEqual(result.openIssues[0].title, 'Test Issue');
    assert.strictEqual(result.openIssues[0].type, 'bug');
    assert.strictEqual(result.openIssues[0].priority, 'p1');
  });

  test('Should parse single closed issue', () => {
    const json = JSON.stringify([{
      id: 'test-2',
      title: 'Closed Issue',
      issue_type: 'task',
      priority: 2,
      status: 'closed',
      created_at: '2025-12-08T10:00:00Z',
      closed_at: '2025-12-08T12:00:00Z'
    }]);
    
    const result = parseListJSON(json, 'list');
    
    assert.strictEqual(result.type, 'list');
    assert.strictEqual(result.openIssues.length, 0);
    assert.strictEqual(result.closedIssues.length, 1);
    assert.strictEqual(result.closedIssues[0].id, 'test-2');
    assert.strictEqual(result.closedIssues[0].status, 'closed');
    assert.strictEqual(result.closedIssues[0].closed_at, '2025-12-08T12:00:00Z');
  });

  test('Should separate open and closed issues', () => {
    const json = JSON.stringify([
      {
        id: 'test-1',
        title: 'Open Issue',
        issue_type: 'bug',
        priority: 1,
        status: 'open',
        created_at: '2025-12-08T10:00:00Z'
      },
      {
        id: 'test-2',
        title: 'Closed Issue',
        issue_type: 'task',
        priority: 2,
        status: 'closed',
        created_at: '2025-12-08T09:00:00Z',
        closed_at: '2025-12-08T11:00:00Z'
      },
      {
        id: 'test-3',
        title: 'Another Open',
        issue_type: 'feature',
        priority: 0,
        status: 'in_progress',
        created_at: '2025-12-08T11:00:00Z'
      }
    ]);
    
    const result = parseListJSON(json, 'list');
    
    assert.strictEqual(result.openIssues.length, 2);
    assert.strictEqual(result.closedIssues.length, 1);
    assert.strictEqual(result.header, 'Found 3 issues (2 open, 1 closed)');
  });

  test('Should sort closed issues by closed_at date (most recent first)', () => {
    const json = JSON.stringify([
      {
        id: 'test-1',
        title: 'Closed First',
        issue_type: 'bug',
        priority: 1,
        status: 'closed',
        created_at: '2025-12-08T10:00:00Z',
        closed_at: '2025-12-08T10:30:00Z'
      },
      {
        id: 'test-2',
        title: 'Closed Last',
        issue_type: 'task',
        priority: 2,
        status: 'closed',
        created_at: '2025-12-08T09:00:00Z',
        closed_at: '2025-12-08T15:00:00Z'
      },
      {
        id: 'test-3',
        title: 'Closed Middle',
        issue_type: 'feature',
        priority: 0,
        status: 'closed',
        created_at: '2025-12-08T11:00:00Z',
        closed_at: '2025-12-08T12:00:00Z'
      }
    ]);
    
    const result = parseListJSON(json, 'list');
    
    assert.strictEqual(result.closedIssues.length, 3);
    assert.strictEqual(result.closedIssues[0].id, 'test-2'); // Most recent
    assert.strictEqual(result.closedIssues[1].id, 'test-3'); // Middle
    assert.strictEqual(result.closedIssues[2].id, 'test-1'); // Oldest
  });

  test('Should handle issues without closed_at gracefully', () => {
    const json = JSON.stringify([
      {
        id: 'test-1',
        title: 'Closed With Date',
        issue_type: 'bug',
        priority: 1,
        status: 'closed',
        created_at: '2025-12-08T10:00:00Z',
        closed_at: '2025-12-08T12:00:00Z'
      },
      {
        id: 'test-2',
        title: 'Closed Without Date',
        issue_type: 'task',
        priority: 2,
        status: 'closed',
        created_at: '2025-12-08T09:00:00Z'
      }
    ]);
    
    const result = parseListJSON(json, 'list');
    
    assert.strictEqual(result.closedIssues.length, 2);
    // Should not throw, and items should still be present
    assert.ok(result.closedIssues.find(i => i.id === 'test-1'));
    assert.ok(result.closedIssues.find(i => i.id === 'test-2'));
  });

  test('Should default missing issue_type to task', () => {
    const json = JSON.stringify([{
      id: 'test-1',
      title: 'No Type Issue',
      priority: 2,
      status: 'open',
      created_at: '2025-12-08T10:00:00Z'
    }]);
    
    const result = parseListJSON(json, 'list');
    
    assert.strictEqual(result.openIssues[0].type, 'task');
  });

  test('Should handle invalid JSON', () => {
    const json = 'not valid json {[}]';
    const result = parseListJSON(json, 'list');
    
    assert.strictEqual(result.type, 'error');
    assert.strictEqual(result.message, 'Failed to parse issue list');
  });

  test('Should preserve all issue fields', () => {
    const json = JSON.stringify([{
      id: 'test-1',
      title: 'Complete Issue',
      issue_type: 'feature',
      priority: 1,
      status: 'in_progress',
      created_at: '2025-12-08T10:00:00Z',
      updated_at: '2025-12-08T11:00:00Z',
      description: 'Test description',
      assignee: 'user@example.com'
    }]);
    
    const result = parseListJSON(json, 'list');
    
    const issue = result.openIssues[0];
    assert.strictEqual(issue.id, 'test-1');
    assert.strictEqual(issue.title, 'Complete Issue');
    assert.strictEqual(issue.type, 'feature');
    assert.strictEqual(issue.priority, 'p1');
    assert.strictEqual(issue.status, 'in_progress');
    assert.strictEqual(issue.created_at, '2025-12-08T10:00:00Z');
    assert.strictEqual(issue.updated_at, '2025-12-08T11:00:00Z');
    assert.strictEqual(issue.description, 'Test description');
    assert.strictEqual(issue.assignee, 'user@example.com');
  });

  test('Should handle singular vs plural in header', () => {
    const singleJson = JSON.stringify([{
      id: 'test-1',
      title: 'Single',
      issue_type: 'task',
      priority: 2,
      status: 'open'
    }]);
    
    const multiJson = JSON.stringify([
      { id: 'test-1', title: 'First', issue_type: 'task', priority: 2, status: 'open' },
      { id: 'test-2', title: 'Second', issue_type: 'task', priority: 2, status: 'open' }
    ]);
    
    const singleResult = parseListJSON(singleJson, 'list');
    const multiResult = parseListJSON(multiJson, 'list');
    
    assert.strictEqual(singleResult.header, 'Found 1 issue');
    assert.strictEqual(multiResult.header, 'Found 2 issues');
  });
});
