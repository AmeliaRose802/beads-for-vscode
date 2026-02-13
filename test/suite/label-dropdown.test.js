const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

suite('LabelDropdown component', () => {
  const componentPath = path.join(ROOT, 'webview', 'components', 'LabelDropdown.jsx');
  const stylesPath = path.join(ROOT, 'webview', 'styles.css');

  test('Component file exists', () => {
    assert.ok(fs.existsSync(componentPath), 'LabelDropdown.jsx should exist');
  });

  test('Component accepts expected props', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    assert.ok(source.includes('value = \'\''), 'should default value prop');
    assert.ok(source.includes('onChange'), 'should accept onChange prop');
    assert.ok(source.includes('labels = []'), 'should accept labels prop');
  });

  test('Component implements combobox interactions', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    assert.ok(source.includes('role="combobox"'), 'input should declare combobox role');
    assert.ok(source.includes('role="listbox"'), 'list should declare listbox role');
    assert.ok(source.includes('role="option"'), 'options should declare option role');
    assert.ok(source.includes('aria-expanded'), 'should expose expanded state');
    assert.ok(source.includes('aria-selected'), 'options should expose selection state');
  });

  test('Component filters and deduplicates labels', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    assert.ok(source.includes('normalizedLabels'), 'should normalize labels');
    assert.ok(source.includes('new Set'), 'should deduplicate labels with Set');
    assert.ok(source.includes('filteredLabels'), 'should filter labels based on user input');
  });

  test('Component exposes keyboard navigation handlers', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    assert.ok(source.includes('ArrowDown'), 'should handle ArrowDown key');
    assert.ok(source.includes('ArrowUp'), 'should handle ArrowUp key');
    assert.ok(source.includes("'Enter'") || source.includes('"Enter"'), 'should handle Enter key');
    assert.ok(source.includes("'Escape'") || source.includes('"Escape"'), 'should handle Escape key');
  });

  test('Component supports clearing the selection', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    assert.ok(source.includes('handleClear'), 'should implement clear handler');
    assert.ok(source.includes('label-dropdown__clear'), 'should render clear button element');
  });

  test('Component avoids inline styles', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    assert.ok(!source.includes('style={{'), 'Component must not use inline styles');
  });

  test('CSS defines label dropdown styles', () => {
    const css = fs.readFileSync(stylesPath, 'utf8');
    assert.ok(css.includes('.label-dropdown'), 'CSS should include dropdown container styles');
    assert.ok(css.includes('.label-dropdown__input'), 'CSS should include input styles');
    assert.ok(css.includes('.label-dropdown__list'), 'CSS should include list styles');
    assert.ok(css.includes('.label-dropdown__option'), 'CSS should include option styles');
    assert.ok(css.includes('.label-dropdown__clear'), 'CSS should include clear button styles');
  });

  test('CSS uses VS Code theme variables for label dropdown', () => {
    const css = fs.readFileSync(stylesPath, 'utf8');
    const start = css.indexOf('.label-dropdown');
    const section = start >= 0 ? css.substring(start, Math.min(css.length, start + 2000)) : '';
    assert.ok(section.includes('var(--vscode-input-background)'), 'should use VS Code input background');
    assert.ok(section.includes('var(--vscode-dropdown-background)'), 'should use VS Code dropdown background');
  });

  test('Component exports default', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    assert.ok(source.includes('export default LabelDropdown'), 'should export component as default');
  });
});
