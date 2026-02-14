const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

suite('Inline Assignee Editing', () => {
  const issueCardPath = path.join(ROOT, 'webview', 'components', 'IssueCard.jsx');
  const outputDisplayPath = path.join(ROOT, 'webview', 'components', 'OutputDisplay.jsx');
  const appPath = path.join(ROOT, 'webview', 'App.jsx');
  const stylesPath = path.join(ROOT, 'webview', 'styles.css');
  const hierarchyViewPath = path.join(ROOT, 'webview', 'components', 'HierarchyView.jsx');

  test('IssueCard accepts onAssigneeChange prop', () => {
    const source = fs.readFileSync(issueCardPath, 'utf8');
    assert.ok(source.includes('onAssigneeChange'), 'IssueCard should accept onAssigneeChange prop');
  });

  test('IssueCard accepts existingAssignees prop', () => {
    const source = fs.readFileSync(issueCardPath, 'utf8');
    assert.ok(source.includes('existingAssignees'), 'IssueCard should accept existingAssignees prop');
  });

  test('IssueCard imports AssigneeDropdown component', () => {
    const source = fs.readFileSync(issueCardPath, 'utf8');
    assert.ok(source.includes("import AssigneeDropdown from './AssigneeDropdown'"), 
      'IssueCard should import AssigneeDropdown component');
  });

  test('IssueCard has state for editing assignee', () => {
    const source = fs.readFileSync(issueCardPath, 'utf8');
    assert.ok(source.includes('isEditingAssignee'), 'should have isEditingAssignee state');
    assert.ok(source.includes('setIsEditingAssignee'), 'should have setIsEditingAssignee setter');
  });

  test('IssueCard has state for assignee save status', () => {
    const source = fs.readFileSync(issueCardPath, 'utf8');
    assert.ok(source.includes('assigneeSaveState'), 'should have assigneeSaveState state');
    assert.ok(source.includes('setAssigneeSaveState'), 'should have setAssigneeSaveState setter');
    // Check for all save states
    assert.ok(source.includes("'idle'"), 'should support idle state');
    assert.ok(source.includes("'saving'"), 'should support saving state');
    assert.ok(source.includes("'saved'"), 'should support saved state');
    assert.ok(source.includes("'error'"), 'should support error state');
  });

  test('IssueCard has handleAssigneeClick handler', () => {
    const source = fs.readFileSync(issueCardPath, 'utf8');
    assert.ok(source.includes('handleAssigneeClick'), 'should have handleAssigneeClick handler');
    assert.ok(source.includes('setIsEditingAssignee(true)'), 'clicking should enable editing mode');
  });

  test('IssueCard has handleAssigneeChange handler', () => {
    const source = fs.readFileSync(issueCardPath, 'utf8');
    assert.ok(source.includes('handleAssigneeChange'), 'should have handleAssigneeChange handler');
    assert.ok(source.includes("setAssigneeSaveState('saving')"), 'should set saving state');
    assert.ok(source.includes("setAssigneeSaveState('saved')"), 'should set saved state on success');
    assert.ok(source.includes("setAssigneeSaveState('error')"), 'should set error state on failure');
  });

  test('IssueCard renders assignee editor for non-closed issues', () => {
    const source = fs.readFileSync(issueCardPath, 'utf8');
    assert.ok(source.includes('issue-card__assignee-editor'), 'should have assignee editor element');
    assert.ok(source.includes('!isClosed'), 'should only show editor for non-closed issues');
  });

  test('IssueCard renders AssigneeDropdown when editing', () => {
    const source = fs.readFileSync(issueCardPath, 'utf8');
    assert.ok(source.includes('<AssigneeDropdown'), 'should render AssigneeDropdown component');
    assert.ok(source.includes('value={issue.assignee'), 'should pass current assignee as value');
    assert.ok(source.includes('onCommit={handleAssigneeChange}'), 'should pass commit handler');
    assert.ok(!source.includes('onChange={handleAssigneeChange}'), 'should not save on each keystroke');
    assert.ok(source.includes('existingAssignees={existingAssignees'), 'should pass existing assignees');
  });

  test('IssueCard displays visual feedback for save states', () => {
    const source = fs.readFileSync(issueCardPath, 'utf8');
    assert.ok(source.includes("assigneeSaveState === 'saving'"), 'should check for saving state');
    assert.ok(source.includes("assigneeSaveState === 'saved'"), 'should check for saved state');
    assert.ok(source.includes("assigneeSaveState === 'error'"), 'should check for error state');
    // Check for visual indicators
    assert.ok(source.includes('⏳'), 'should show loading spinner when saving');
    assert.ok(source.includes('✓'), 'should show checkmark when saved');
    assert.ok(source.includes('❌'), 'should show error icon when error');
  });

  test('IssueCard prevents card click when interacting with assignee editor', () => {
    const source = fs.readFileSync(issueCardPath, 'utf8');
    assert.ok(source.includes("'.issue-card__assignee-editor'"), 
      'handleCardClick should check for assignee editor');
  });

  test('OutputDisplay extracts existing assignees from issues', () => {
    const source = fs.readFileSync(outputDisplayPath, 'utf8');
    assert.ok(source.includes('existingAssignees'), 'should extract existing assignees');
    assert.ok(source.includes('new Set'), 'should deduplicate assignees with Set');
    assert.ok(source.includes('.map(issue => issue.assignee)'), 'should map issue assignees');
  });

  test('OutputDisplay passes onAssigneeChange to IssueCard', () => {
    const source = fs.readFileSync(outputDisplayPath, 'utf8');
    assert.ok(source.includes('onAssigneeChange={onAssigneeChange}'), 
      'should pass onAssigneeChange prop to IssueCard');
  });

  test('OutputDisplay passes existingAssignees to IssueCard', () => {
    const source = fs.readFileSync(outputDisplayPath, 'utf8');
    assert.ok(source.includes('existingAssignees={existingAssignees}'), 
      'should pass existingAssignees prop to IssueCard');
  });

  test('App.jsx has handleAssigneeChange function', () => {
    const source = fs.readFileSync(appPath, 'utf8');
    assert.ok(source.includes('handleAssigneeChange'), 'should have handleAssigneeChange function');
    assert.ok(source.includes('new Promise'), 'should return a Promise');
  });

  test('handleAssigneeChange uses bd update command', () => {
    const source = fs.readFileSync(appPath, 'utf8');
    const funcMatch = source.match(/const handleAssigneeChange[\s\S]*?^\s\s};/m);
    assert.ok(funcMatch, 'should find handleAssigneeChange function');
    const funcBody = funcMatch[0];
    assert.ok(funcBody.includes('update ${issueId}'), 'should use bd update command');
    assert.ok(funcBody.includes('--assignee'), 'should use --assignee flag');
  });

  test('handleAssigneeChange handles empty assignee (clear)', () => {
    const source = fs.readFileSync(appPath, 'utf8');
    const funcMatch = source.match(/const handleAssigneeChange[\s\S]*?^\s\s};/m);
    assert.ok(funcMatch, 'should find handleAssigneeChange function');
    const funcBody = funcMatch[0];
    assert.ok(funcBody.includes('newAssignee.trim()'), 'should check if assignee is empty');
    assert.ok(funcBody.includes('--assignee ""'), 'should support clearing assignee');
  });

  test('handleAssigneeChange resolves promise on success', () => {
    const source = fs.readFileSync(appPath, 'utf8');
    const funcMatch = source.match(/const handleAssigneeChange[\s\S]*?^\s\s};/m);
    assert.ok(funcMatch, 'should find handleAssigneeChange function');
    const funcBody = funcMatch[0];
    assert.ok(funcBody.includes('resolve()'), 'should resolve promise on success');
    assert.ok(funcBody.includes('message.success'), 'should check for success in response');
  });

  test('handleAssigneeChange rejects promise on error', () => {
    const source = fs.readFileSync(appPath, 'utf8');
    const funcMatch = source.match(/const handleAssigneeChange[\s\S]*?^\s\s};/m);
    assert.ok(funcMatch, 'should find handleAssigneeChange function');
    const funcBody = funcMatch[0];
    assert.ok(funcBody.includes('reject'), 'should reject promise on error');
    assert.ok(funcBody.includes('new Error'), 'should create Error object');
  });

  test('handleAssigneeChange has timeout for safety', () => {
    const source = fs.readFileSync(appPath, 'utf8');
    const funcMatch = source.match(/const handleAssigneeChange[\s\S]*?^\s\s};/m);
    assert.ok(funcMatch, 'should find handleAssigneeChange function');
    const funcBody = funcMatch[0];
    assert.ok(funcBody.includes('setTimeout'), 'should have timeout');
    assert.ok(funcBody.includes('Timeout updating assignee'), 'should reject with timeout message');
  });

  test('App.jsx passes onAssigneeChange to OutputDisplay', () => {
    const source = fs.readFileSync(appPath, 'utf8');
    assert.ok(source.includes('onAssigneeChange={handleAssigneeChange}'), 
      'should pass onAssigneeChange to OutputDisplay');
  });

  test('CSS defines assignee editor styles', () => {
    const css = fs.readFileSync(stylesPath, 'utf8');
    assert.ok(css.includes('.issue-card__assignee-editor'), 'should define assignee editor container');
    assert.ok(css.includes('.issue-card__assignee-display'), 'should define assignee display element');
    assert.ok(css.includes('.issue-card__assignee-input-wrapper'), 'should define input wrapper');
    assert.ok(css.includes('.issue-card__assignee-editor--active'), 'should define active state');
  });

  test('CSS styles assignee editor for inline editing', () => {
    const css = fs.readFileSync(stylesPath, 'utf8');
    // Find the assignee editor section
    const startIdx = css.indexOf('.issue-card__assignee-editor');
    const section = css.substring(startIdx, startIdx + 2000);
    
    assert.ok(section.includes('position:'), 'should use positioning');
    assert.ok(section.includes('cursor: pointer'), 'display should be clickable');
    assert.ok(section.includes('z-index:'), 'input wrapper should have z-index for layering');
  });

  test('CSS uses VS Code theme variables for assignee editor', () => {
    const css = fs.readFileSync(stylesPath, 'utf8');
    const startIdx = css.indexOf('.issue-card__assignee-editor');
    const section = css.substring(startIdx, startIdx + 2000);
    
    assert.ok(section.includes('var(--vscode-'), 'should use VS Code theme variables');
    assert.ok(section.includes('var(--vscode-dropdown-background)'), 
      'should use dropdown background variable');
    assert.ok(section.includes('var(--vscode-focusBorder)'), 
      'should use focus border variable');
  });

  test('CSS has no inline styles in assignee editor', () => {
    const css = fs.readFileSync(stylesPath, 'utf8');
    const startIdx = css.indexOf('.issue-card__assignee-editor');
    const section = css.substring(startIdx, startIdx + 2000);
    
    // Make sure we're defining styles, not using inline styles
    assert.ok(!section.includes('style={{'), 'should not have inline styles in CSS');
  });

  test('IssueCard has no inline styles for assignee editor', () => {
    const source = fs.readFileSync(issueCardPath, 'utf8');
    // Extract the assignee editor section
    const startIdx = source.indexOf('issue-card__assignee-editor');
    if (startIdx === -1) {
      assert.fail('Could not find assignee editor in component');
    }
    const section = source.substring(startIdx - 100, startIdx + 500);
    
    assert.ok(!section.includes('style={{'), 'assignee editor should not use inline styles');
  });

  test('Feature integrates with existing components', () => {
    const issueCard = fs.readFileSync(issueCardPath, 'utf8');
    const outputDisplay = fs.readFileSync(outputDisplayPath, 'utf8');
    const app = fs.readFileSync(appPath, 'utf8');
    
    // Check data flow: App -> OutputDisplay -> IssueCard
    assert.ok(app.includes('handleAssigneeChange'), 'App should define handler');
    assert.ok(app.includes('onAssigneeChange={handleAssigneeChange}'), 'App should pass to OutputDisplay');
    assert.ok(outputDisplay.includes('onAssigneeChange'), 'OutputDisplay should accept handler');
    assert.ok(outputDisplay.includes('onAssigneeChange={onAssigneeChange}'), 'OutputDisplay should pass to IssueCard');
    assert.ok(issueCard.includes('onAssigneeChange'), 'IssueCard should accept handler');
  });

  test('Feature handles all required states', () => {
    const source = fs.readFileSync(issueCardPath, 'utf8');
    
    // Test each required state is handled
    const states = ['idle', 'saving', 'saved', 'error'];
    states.forEach(state => {
      assert.ok(source.includes(`'${state}'`), `should handle ${state} state`);
    });
  });

  test('Feature provides visual feedback for each state', () => {
    const source = fs.readFileSync(issueCardPath, 'utf8');
    
    // Check for visual indicators
    const indicators = {
      'saving': '⏳',
      'saved': '✓',
      'error': '❌'
    };
    
    for (const [state, icon] of Object.entries(indicators)) {
      assert.ok(source.includes(icon), `should show ${icon} for ${state} state`);
    }
  });

  test('Hierarchy action is hidden when there are no relationships', () => {
    const source = fs.readFileSync(issueCardPath, 'utf8');
    const guardPattern = /{totalRelationships > 0 &&\s*\(/;
    assert.ok(guardPattern.test(source), 'hierarchy button should only render when related work exists');
  });

  test('Hierarchy view shows an empty state when no relationships exist', () => {
    const source = fs.readFileSync(hierarchyViewPath, 'utf8');
    assert.ok(
      source.includes('No relationships found for this item.'),
      'Hierarchy view should explain when no relationships are available'
    );
  });
});
