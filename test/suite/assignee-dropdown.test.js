const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

suite('AssigneeDropdown component', () => {
  const componentPath = path.join(ROOT, 'webview', 'components', 'AssigneeDropdown.jsx');
  const stylesPath = path.join(ROOT, 'webview', 'styles.css');

  test('Component file exists', () => {
    assert.ok(fs.existsSync(componentPath), 'AssigneeDropdown.jsx should exist');
  });

  test('Component accepts required props', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    assert.ok(source.includes('value'), 'should accept value prop');
    assert.ok(source.includes('onChange'), 'should accept onChange prop');
    assert.ok(source.includes('existingAssignees'), 'should accept existingAssignees prop');
  });

  test('Component supports custom text input', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    assert.ok(source.includes('type="text"'), 'should render a text input for custom entry');
    assert.ok(source.includes('handleInputChange'), 'should handle text input changes');
  });

  test('Component renders dropdown list from existing assignees', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    assert.ok(source.includes('filteredAssignees'), 'should filter assignees');
    assert.ok(source.includes('assignee-dropdown__list'), 'should render dropdown list');
    assert.ok(source.includes('assignee-dropdown__option'), 'should render option items');
  });

  test('Component supports clearing the assignee', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    assert.ok(source.includes('handleClear'), 'should have clear handler');
    assert.ok(source.includes('assignee-dropdown__clear'), 'should render clear button');
    assert.ok(source.includes("onChange('')"), 'clear should emit empty string');
  });

  test('Component supports keyboard navigation', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    assert.ok(source.includes('ArrowDown'), 'should handle ArrowDown key');
    assert.ok(source.includes('ArrowUp'), 'should handle ArrowUp key');
    assert.ok(source.includes("'Enter'"), 'should handle Enter key');
    assert.ok(source.includes("'Escape'"), 'should handle Escape key');
  });

  test('Component deduplicates assignees', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    assert.ok(source.includes('new Set'), 'should deduplicate assignees with Set');
  });

  test('Component has ARIA attributes for accessibility', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    assert.ok(source.includes('role="combobox"'), 'input should have combobox role');
    assert.ok(source.includes('role="listbox"'), 'list should have listbox role');
    assert.ok(source.includes('role="option"'), 'options should have option role');
    assert.ok(source.includes('aria-expanded'), 'should indicate expanded state');
  });

  test('CSS defines assignee dropdown styles', () => {
    const css = fs.readFileSync(stylesPath, 'utf8');
    assert.ok(css.includes('.assignee-dropdown'), 'CSS should define dropdown container');
    assert.ok(css.includes('.assignee-dropdown__input'), 'CSS should define input styling');
    assert.ok(css.includes('.assignee-dropdown__list'), 'CSS should define list styling');
    assert.ok(css.includes('.assignee-dropdown__option'), 'CSS should define option styling');
    assert.ok(css.includes('.assignee-dropdown__clear'), 'CSS should define clear button');
    assert.ok(css.includes('.assignee-dropdown__option--highlighted'), 'CSS should define highlighted state');
  });

  test('CSS uses VS Code theme variables', () => {
    const css = fs.readFileSync(stylesPath, 'utf8');
    // Extract assignee-dropdown section
    const startIdx = css.indexOf('.assignee-dropdown');
    const section = css.substring(startIdx);
    assert.ok(section.includes('var(--vscode-'), 'CSS should use VS Code theme variables');
    assert.ok(section.includes('var(--vscode-input-background)'), 'should use input background variable');
    assert.ok(section.includes('var(--vscode-dropdown-background)'), 'should use dropdown background variable');
  });

  test('Component has no inline styles', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    assert.ok(!source.includes('style={{'), 'Component must not use inline styles');
    assert.ok(!source.includes('style ={{'), 'Component must not use inline styles');
  });

  test('Component exports default', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    assert.ok(source.includes('export default AssigneeDropdown'), 'should export default');
  });

  test('Component has JSDoc documentation', () => {
    const source = fs.readFileSync(componentPath, 'utf8');
    assert.ok(source.includes('@param'), 'should have JSDoc @param tags');
    assert.ok(source.includes('@returns'), 'should have JSDoc @returns tag');
  });
});
