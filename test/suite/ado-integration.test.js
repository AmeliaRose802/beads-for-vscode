const assert = require('assert');
const {
  parseAdoProjectUrl,
  extractAdoIdLabel,
  extractBeadsIdFromOutput,
  mapBeadsTypeToAdoType,
  mapAdoTypeToBeadsType,
  mapBeadsPriorityToAdoPriority,
  mapAdoPriorityToBeadsPriority
} = require('../../ado-integration');

suite('ADO Integration Helpers', () => {
  suite('parseAdoProjectUrl', () => {
    test('parses dev.azure.com URLs', () => {
      const parsed = parseAdoProjectUrl('https://dev.azure.com/my-org/my-project');
      assert.strictEqual(parsed.organization, 'my-org');
      assert.strictEqual(parsed.project, 'my-project');
    });

    test('parses visualstudio.com URLs', () => {
      const parsed = parseAdoProjectUrl('https://contoso.visualstudio.com/DefaultCollection/ProjectX');
      assert.strictEqual(parsed.organization, 'contoso');
      assert.strictEqual(parsed.project, 'ProjectX');
    });
  });

  suite('label extraction', () => {
    test('extracts ado label', () => {
      const id = extractAdoIdLabel(['priority:high', 'ado:12345']);
      assert.strictEqual(id, '12345');
    });

    test('returns null when missing', () => {
      const id = extractAdoIdLabel(['foo', 'bar']);
      assert.strictEqual(id, null);
    });
  });

  suite('beads ID extraction', () => {
    test('extracts from plain output', () => {
      const id = extractBeadsIdFromOutput('Created issue beads_ui-0djk');
      assert.strictEqual(id, 'beads_ui-0djk');
    });
  });

  suite('type mapping', () => {
    test('maps beads bug to ADO Bug', () => {
      assert.strictEqual(mapBeadsTypeToAdoType('bug'), 'Bug');
    });

    test('maps ADO User Story to beads feature', () => {
      assert.strictEqual(mapAdoTypeToBeadsType('User Story'), 'feature');
    });
  });

  suite('priority mapping', () => {
    test('maps beads priority 0 to ADO 1', () => {
      assert.strictEqual(mapBeadsPriorityToAdoPriority(0), 1);
    });

    test('maps ADO priority 4 to beads 3', () => {
      assert.strictEqual(mapAdoPriorityToBeadsPriority(4), 3);
    });
  });
});
