const assert = require('assert');
const { buildPlanSchedule } = require('../../webview/plan-utils');

suite('plan-utils', () => {
  suite('buildPlanSchedule', () => {
    test('returns empty schedule for empty issues', () => {
      const result = buildPlanSchedule([], [], null, 2);
      assert.strictEqual(result.totalWaves, 0);
      assert.strictEqual(result.totalItems, 0);
      assert.strictEqual(result.averageThroughput, 0);
      assert.strictEqual(result.capacity, 2);
      assert.deepStrictEqual(result.waves, []);
    });

    test('returns empty schedule for null issues', () => {
      const result = buildPlanSchedule(null, [], null, 1);
      assert.strictEqual(result.totalWaves, 0);
    });

    test('schedules independent items in parallel', () => {
      const issues = [
        { id: 'a', status: 'open' },
        { id: 'b', status: 'open' },
        { id: 'c', status: 'open' }
      ];
      const result = buildPlanSchedule(issues, [], null, 3);
      assert.strictEqual(result.totalWaves, 1);
      assert.strictEqual(result.totalItems, 3);
    });

    test('respects capacity limit', () => {
      const issues = [
        { id: 'a', status: 'open' },
        { id: 'b', status: 'open' },
        { id: 'c', status: 'open' }
      ];
      const result = buildPlanSchedule(issues, [], null, 2);
      assert.strictEqual(result.totalWaves, 2);
      assert.strictEqual(result.capacity, 2);
    });

    test('schedules linear chain in dependency order', () => {
      const issues = [
        { id: 'a', status: 'open' },
        { id: 'b', status: 'open' },
        { id: 'c', status: 'open' }
      ];
      const edges = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' }
      ];
      const result = buildPlanSchedule(issues, edges, null, 3);
      assert.strictEqual(result.totalWaves, 3);
      assert.strictEqual(result.waves[0].length, 1);
      assert.strictEqual(result.waves[0][0].id, 'a');
      assert.strictEqual(result.waves[1][0].id, 'b');
      assert.strictEqual(result.waves[2][0].id, 'c');
    });

    test('schedules diamond dependencies correctly', () => {
      const issues = [
        { id: 'a', status: 'open' },
        { id: 'b', status: 'open' },
        { id: 'c', status: 'open' },
        { id: 'd', status: 'open' }
      ];
      const edges = [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'c' },
        { from: 'b', to: 'd' },
        { from: 'c', to: 'd' }
      ];
      const result = buildPlanSchedule(issues, edges, null, 4);
      // Wave 1: a, Wave 2: b+c, Wave 3: d
      assert.strictEqual(result.totalWaves, 3);
      assert.strictEqual(result.waves[0].length, 1);
      assert.strictEqual(result.waves[0][0].id, 'a');
      assert.strictEqual(result.waves[1].length, 2);
      assert.strictEqual(result.waves[2].length, 1);
      assert.strictEqual(result.waves[2][0].id, 'd');
    });

    test('excludes closed items from schedule', () => {
      const issues = [
        { id: 'a', status: 'closed' },
        { id: 'b', status: 'open' },
        { id: 'c', status: 'done' }
      ];
      const result = buildPlanSchedule(issues, [], null, 3);
      assert.strictEqual(result.totalItems, 1);
      assert.strictEqual(result.waves[0][0].id, 'b');
    });

    test('treats closed blockers as already satisfied', () => {
      const issues = [
        { id: 'a', status: 'closed' },
        { id: 'b', status: 'open' }
      ];
      const edges = [{ from: 'a', to: 'b' }];
      const result = buildPlanSchedule(issues, edges, null, 2);
      assert.strictEqual(result.totalWaves, 1);
      assert.strictEqual(result.waves[0][0].id, 'b');
    });

    test('detects cycle groups', () => {
      const issues = [
        { id: 'a', status: 'open' },
        { id: 'b', status: 'open' }
      ];
      const edges = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' }
      ];
      const result = buildPlanSchedule(issues, edges, null, 2);
      assert.ok(result.cycleGroups.length > 0);
      assert.ok(result.cycleIds.length === 2);
    });

    test('normalizes invalid parallel limit to 1', () => {
      const issues = [{ id: 'a', status: 'open' }];
      const result = buildPlanSchedule(issues, [], null, 0);
      assert.strictEqual(result.capacity, 1);
    });

    test('normalizes negative parallel limit to 1', () => {
      const issues = [{ id: 'a', status: 'open' }];
      const result = buildPlanSchedule(issues, [], null, -5);
      assert.strictEqual(result.capacity, 1);
    });

    test('normalizes NaN parallel limit to 1', () => {
      const issues = [{ id: 'a', status: 'open' }];
      const result = buildPlanSchedule(issues, [], null, NaN);
      assert.strictEqual(result.capacity, 1);
    });

    test('floors fractional parallel limit', () => {
      const issues = [
        { id: 'a', status: 'open' },
        { id: 'b', status: 'open' },
        { id: 'c', status: 'open' }
      ];
      const result = buildPlanSchedule(issues, [], null, 2.9);
      assert.strictEqual(result.capacity, 2);
    });

    test('uses completionOrder for scheduling priority', () => {
      const issues = [
        { id: 'c', status: 'open' },
        { id: 'a', status: 'open' },
        { id: 'b', status: 'open' }
      ];
      const order = [
        { id: 'b' },
        { id: 'a' },
        { id: 'c' }
      ];
      const result = buildPlanSchedule(issues, [], order, 1);
      assert.strictEqual(result.waves[0][0].id, 'b');
      assert.strictEqual(result.waves[1][0].id, 'a');
      assert.strictEqual(result.waves[2][0].id, 'c');
    });

    test('computes average throughput', () => {
      const issues = [
        { id: 'a', status: 'open' },
        { id: 'b', status: 'open' },
        { id: 'c', status: 'open' }
      ];
      const result = buildPlanSchedule(issues, [], null, 2);
      assert.strictEqual(result.averageThroughput, 3 / 2);
    });

    test('handles issues with null/undefined ids gracefully', () => {
      const issues = [
        { id: null, status: 'open' },
        { id: 'a', status: 'open' }
      ];
      const result = buildPlanSchedule(issues, [], null, 2);
      assert.strictEqual(result.totalItems, 1);
    });

    test('handles self-loop as cycle', () => {
      const issues = [{ id: 'a', status: 'open' }];
      const edges = [{ from: 'a', to: 'a' }];
      const result = buildPlanSchedule(issues, edges, null, 1);
      assert.ok(result.cycleIds.includes('a'));
    });

    test('excludes epics from scheduled waves', () => {
      const issues = [
        { id: 'epic1', status: 'open', issue_type: 'epic' },
        { id: 'a', status: 'open', issue_type: 'task' },
        { id: 'b', status: 'open', issue_type: 'bug' }
      ];
      const result = buildPlanSchedule(issues, [], null, 3);
      const allScheduled = result.waves.flat();
      assert.ok(!allScheduled.some(i => i.id === 'epic1'), 'Epic should not appear in waves');
      assert.strictEqual(result.totalItems, 2);
    });

    test('items blocked only by epics are not stuck', () => {
      const issues = [
        { id: 'epic1', status: 'open', issue_type: 'epic' },
        { id: 'a', status: 'open', issue_type: 'task' }
      ];
      const edges = [{ from: 'epic1', to: 'a' }];
      const result = buildPlanSchedule(issues, edges, null, 2);
      assert.strictEqual(result.totalWaves, 1);
      assert.strictEqual(result.waves[0][0].id, 'a');
    });
  });
});
