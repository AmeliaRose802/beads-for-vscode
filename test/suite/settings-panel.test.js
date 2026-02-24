const { describe, it } = require('mocha');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('SettingsPanel', () => {
  const ROOT = path.resolve(__dirname, '..', '..');
  const componentPath = path.join(ROOT, 'webview', 'components', 'SettingsPanel.jsx');

  it('should exist and export a component', () => {
    assert.ok(fs.existsSync(componentPath), 'SettingsPanel.jsx should exist');
    const source = fs.readFileSync(componentPath, 'utf8');
    assert.ok(source.includes('module.exports = SettingsPanel'), 'Should export SettingsPanel component');
  });

  it('should accept required props', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    assert.ok(source.includes('backendType'), 'Should accept backendType prop');
    assert.ok(source.includes('adoOrgUrl'), 'Should accept adoOrgUrl prop');
    assert.ok(source.includes('adoIterationPath'), 'Should accept adoIterationPath prop');
    assert.ok(source.includes('adoAreaPath'), 'Should accept adoAreaPath prop');
    assert.ok(source.includes('onSave'), 'Should accept onSave prop');
    assert.ok(source.includes('onCancel'), 'Should accept onCancel prop');
    assert.ok(source.includes('onImportFromADO'), 'Should accept onImportFromADO prop');
    assert.ok(source.includes('onExportToADO'), 'Should accept onExportToADO prop');
  });

  it('should render radio buttons for backend selection', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    assert.ok(source.includes('type="radio"'), 'Should have radio buttons');
    assert.ok(source.includes('github'), 'Should have GitHub option');
    assert.ok(source.includes('ado'), 'Should have Azure DevOps option');
  });

  it('should render ADO-specific fields conditionally', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    assert.ok(source.includes('isADO'), 'Should check if ADO mode is active');
    assert.ok(source.includes('Organization/Project URL'), 'Should have ADO URL field');
    assert.ok(source.includes('Iteration Path'), 'Should have iteration path field');
    assert.ok(source.includes('Area Path'), 'Should have area path field');
  });

  it('should render import and export buttons', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    assert.ok(source.includes('Import from ADO'), 'Should have import button');
    assert.ok(source.includes('Export to ADO'), 'Should have export button');
    assert.ok(source.includes('onImportFromADO'), 'Import button should call handler');
    assert.ok(source.includes('onExportToADO'), 'Export button should call handler');
  });

  it('should have save and cancel buttons', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    assert.ok(source.includes('Save'), 'Should have save button');
    assert.ok(source.includes('Cancel'), 'Should have cancel button');
    assert.ok(source.includes('onSave'), 'Save button should call handler');
    assert.ok(source.includes('onCancel'), 'Cancel button should call handler');
  });

  it('should use CSS classes not inline styles', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    assert.ok(!source.includes('style={{'), 'Should not use inline styles');
    assert.ok(source.includes('className='), 'Should use CSS classes');
  });
});

