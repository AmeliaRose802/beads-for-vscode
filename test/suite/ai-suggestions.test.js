const assert = require('assert');
const { parseAIResponse, buildAIPrompt } = require('../../ai-suggestions');

suite('AI Suggestions Tests', () => {
  suite('parseAIResponse', () => {
    test('Should parse valid JSON response', () => {
      const response = '{"type":"bug","priority":1,"description":"A bug","links":"--parent x-1"}';
      const result = parseAIResponse(response);
      assert.strictEqual(result.type, 'bug');
      assert.strictEqual(result.priority, 1);
      assert.strictEqual(result.description, 'A bug');
      assert.strictEqual(result.links, '--parent x-1');
    });

    test('Should extract JSON from surrounding text', () => {
      const response = 'Here is my analysis:\n{"type":"feature","priority":2,"description":"test","links":""}\nDone.';
      const result = parseAIResponse(response);
      assert.strictEqual(result.type, 'feature');
      assert.strictEqual(result.priority, 2);
    });

    test('Should default invalid type to task', () => {
      const response = '{"type":"invalid","priority":2,"description":"test","links":""}';
      const result = parseAIResponse(response);
      assert.strictEqual(result.type, 'task');
    });

    test('Should default invalid priority to 2', () => {
      const response = '{"type":"bug","priority":99,"description":"test","links":""}';
      const result = parseAIResponse(response);
      assert.strictEqual(result.priority, 2);
    });

    test('Should default negative priority to 2', () => {
      const response = '{"type":"bug","priority":-1,"description":"test","links":""}';
      const result = parseAIResponse(response);
      assert.strictEqual(result.priority, 2);
    });

    test('Should clear invalid link format', () => {
      const response = '{"type":"task","priority":2,"description":"test","links":"invalid link"}';
      const result = parseAIResponse(response);
      assert.strictEqual(result.links, '');
    });

    test('Should preserve valid link format', () => {
      const response = '{"type":"task","priority":2,"description":"test","links":"--related beads_ui-5"}';
      const result = parseAIResponse(response);
      assert.strictEqual(result.links, '--related beads_ui-5');
    });

    test('Should return defaults for unparseable response', () => {
      const result = parseAIResponse('not json at all');
      assert.strictEqual(result.type, 'task');
      assert.strictEqual(result.priority, 2);
      assert.ok(result.description.includes('defaults'));
    });

    test('Should handle empty response', () => {
      const result = parseAIResponse('');
      assert.strictEqual(result.type, 'task');
      assert.strictEqual(result.priority, 2);
    });

    test('Should accept all valid types', () => {
      const types = ['bug', 'feature', 'task', 'epic', 'chore'];
      for (const type of types) {
        const response = `{"type":"${type}","priority":2,"description":"test","links":""}`;
        const result = parseAIResponse(response);
        assert.strictEqual(result.type, type);
      }
    });
  });

  suite('buildAIPrompt', () => {
    test('Should include title and description', () => {
      const prompt = buildAIPrompt('Fix bug', 'It is broken', [], '');
      assert.ok(prompt.includes('Fix bug'));
      assert.ok(prompt.includes('It is broken'));
    });

    test('Should handle empty existing issues', () => {
      const prompt = buildAIPrompt('Test', '', [], '');
      assert.ok(prompt.includes('(none)'));
    });

    test('Should include epic summaries', () => {
      const issues = [
        { id: 'x-1', title: 'Big Feature', issue_type: 'epic', priority: 1, status: 'open' }
      ];
      const prompt = buildAIPrompt('Test', '', issues, '');
      assert.ok(prompt.includes('x-1: Big Feature'));
    });

    test('Should include workspace files', () => {
      const prompt = buildAIPrompt('Test', '', [], 'src/app.js, src/utils.js');
      assert.ok(prompt.includes('src/app.js'));
    });

    test('Should handle null description', () => {
      const prompt = buildAIPrompt('Test', null, [], '');
      assert.ok(prompt.includes('(none)'));
    });
  });
});
