/**
 * Tests for list filtering controls feature.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const componentPath = path.join(ROOT, 'webview', 'components', 'ListFilterControls.jsx');
const outputDisplayPath = path.join(ROOT, 'webview', 'components', 'OutputDisplay.jsx');
const stylesPath = path.join(ROOT, 'webview', 'styles.css');

suite('List filtering controls', function() {
  suite('ListFilterControls component', function() {
    test('Component file exists', function() {
      assert.ok(fs.existsSync(componentPath), 'ListFilterControls.jsx should exist');
    });

    test('Component accepts filter props', function() {
      const content = fs.readFileSync(componentPath, 'utf-8');
      assert.ok(content.includes('searchFilter'), 'Should accept searchFilter prop');
      assert.ok(content.includes('assigneeFilter'), 'Should accept assigneeFilter prop');
      assert.ok(content.includes('labelFilter'), 'Should accept labelFilter prop');
    });

    test('Component accepts change handlers', function() {
      const content = fs.readFileSync(componentPath, 'utf-8');
      assert.ok(content.includes('onSearchChange'), 'Should accept onSearchChange prop');
      assert.ok(content.includes('onAssigneeChange'), 'Should accept onAssigneeChange prop');
      assert.ok(content.includes('onLabelChange'), 'Should accept onLabelChange prop');
    });

    test('Component has clear all functionality', function() {
      const content = fs.readFileSync(componentPath, 'utf-8');
      assert.ok(content.includes('onClearAll'), 'Should accept onClearAll prop');
      assert.ok(content.includes('Clear filters'), 'Should have clear filters button');
    });

    test('Component extracts labels from issues', function() {
      const content = fs.readFileSync(componentPath, 'utf-8');
      assert.ok(content.includes('extractLabels'), 'Should have extractLabels function');
      assert.ok(content.includes('availableLabels'), 'Should extract available labels');
    });

    test('Component extracts assignees from issues', function() {
      const content = fs.readFileSync(componentPath, 'utf-8');
      assert.ok(content.includes('extractAssignees'), 'Should have extractAssignees function');
      assert.ok(content.includes('availableAssignees'), 'Should extract available assignees');
    });

    test('Component has no inline styles', function() {
      const content = fs.readFileSync(componentPath, 'utf-8');
      assert.ok(!content.includes('style={{'), 'Should not have inline styles');
    });

    test('Component exports default', function() {
      const content = fs.readFileSync(componentPath, 'utf-8');
      assert.ok(content.includes('export default ListFilterControls'), 'Should export default');
    });
  });

  suite('OutputDisplay integration', function() {
    test('OutputDisplay imports ListFilterControls', function() {
      const content = fs.readFileSync(outputDisplayPath, 'utf-8');
      assert.ok(content.includes("import ListFilterControls"), 'Should import ListFilterControls');
    });

    test('OutputDisplay has search filter state', function() {
      const content = fs.readFileSync(outputDisplayPath, 'utf-8');
      assert.ok(content.includes('searchFilter'), 'Should have searchFilter state');
      assert.ok(content.includes('setSearchFilter'), 'Should have setSearchFilter');
    });

    test('OutputDisplay has assignee filter state', function() {
      const content = fs.readFileSync(outputDisplayPath, 'utf-8');
      assert.ok(content.includes('assigneeFilter'), 'Should have assigneeFilter state');
      assert.ok(content.includes('setAssigneeFilter'), 'Should have setAssigneeFilter');
    });

    test('OutputDisplay has label filter state', function() {
      const content = fs.readFileSync(outputDisplayPath, 'utf-8');
      assert.ok(content.includes('labelFilter'), 'Should have labelFilter state');
      assert.ok(content.includes('setLabelFilter'), 'Should have setLabelFilter');
    });

    test('OutputDisplay has filter matching functions', function() {
      const content = fs.readFileSync(outputDisplayPath, 'utf-8');
      assert.ok(content.includes('matchesSearch'), 'Should have matchesSearch function');
      assert.ok(content.includes('matchesAssignee'), 'Should have matchesAssignee function');
      assert.ok(content.includes('matchesLabel'), 'Should have matchesLabel function');
    });

    test('OutputDisplay filters hierarchy nodes', function() {
      const content = fs.readFileSync(outputDisplayPath, 'utf-8');
      assert.ok(content.includes('filterHierarchyNode'), 'Should have filterHierarchyNode function');
      assert.ok(content.includes('filteredRoots'), 'Should compute filteredRoots');
    });

    test('OutputDisplay filters closed issues', function() {
      const content = fs.readFileSync(outputDisplayPath, 'utf-8');
      assert.ok(content.includes('filteredClosedIssues'), 'Should filter closed issues');
    });

    test('OutputDisplay shows filtered count in pagination', function() {
      const content = fs.readFileSync(outputDisplayPath, 'utf-8');
      assert.ok(content.includes('filteredCount'), 'Should pass filteredCount to pagination');
      assert.ok(content.includes('unfilteredCount'), 'Should pass unfilteredCount to pagination');
    });
  });

  suite('CSS styles', function() {
    test('CSS defines list filter controls styles', function() {
      const content = fs.readFileSync(stylesPath, 'utf-8');
      assert.ok(content.includes('.list-filter-controls'), 'Should have list-filter-controls class');
    });

    test('CSS defines search input styles', function() {
      const content = fs.readFileSync(stylesPath, 'utf-8');
      assert.ok(content.includes('.list-filter-controls__search'), 'Should have search class');
      assert.ok(content.includes('.list-filter-controls__search-input'), 'Should have search input class');
    });

    test('CSS defines filter dropdown styles', function() {
      const content = fs.readFileSync(stylesPath, 'utf-8');
      assert.ok(content.includes('.filter-dropdown'), 'Should have filter-dropdown class');
      assert.ok(content.includes('.filter-dropdown__input'), 'Should have filter dropdown input class');
      assert.ok(content.includes('.filter-dropdown__list'), 'Should have filter dropdown list class');
    });

    test('CSS defines clear all button styles', function() {
      const content = fs.readFileSync(stylesPath, 'utf-8');
      assert.ok(content.includes('.list-filter-controls__clear-all'), 'Should have clear-all class');
    });

    test('CSS uses VS Code theme variables', function() {
      const content = fs.readFileSync(stylesPath, 'utf-8');
      const filterSection = content.substring(
        content.indexOf('.list-filter-controls'),
        content.indexOf('.list-filter-controls') + 2000
      );
      assert.ok(filterSection.includes('var(--vscode-'), 'Should use VS Code theme variables');
    });
  });

  suite('Filtering logic', function() {
    test('matchesSearch function filters by ID, title, and description', function() {
      const content = fs.readFileSync(outputDisplayPath, 'utf-8');
      const matchesSearchFn = content.match(/function matchesSearch[\s\S]*?^}/m);
      assert.ok(matchesSearchFn, 'Should have matchesSearch function');
      const fnContent = matchesSearchFn[0];
      assert.ok(fnContent.includes('issue.id'), 'Should check issue ID');
      assert.ok(fnContent.includes('issue.title'), 'Should check issue title');
      assert.ok(fnContent.includes('issue.description'), 'Should check issue description');
      assert.ok(fnContent.includes('toLowerCase'), 'Should be case-insensitive');
    });

    test('matchesAssignee function filters by assignee', function() {
      const content = fs.readFileSync(outputDisplayPath, 'utf-8');
      const matchesFn = content.match(/function matchesAssignee[\s\S]*?^}/m);
      assert.ok(matchesFn, 'Should have matchesAssignee function');
      const fnContent = matchesFn[0];
      assert.ok(fnContent.includes('issue.assignee'), 'Should check issue assignee');
      assert.ok(fnContent.includes('toLowerCase'), 'Should be case-insensitive');
    });

    test('matchesLabel function filters by labels', function() {
      const content = fs.readFileSync(outputDisplayPath, 'utf-8');
      const matchesFn = content.match(/function matchesLabel[\s\S]*?^}/m);
      assert.ok(matchesFn, 'Should have matchesLabel function');
      const fnContent = matchesFn[0];
      assert.ok(fnContent.includes('issue.labels'), 'Should check issue labels');
      assert.ok(fnContent.includes('toLowerCase'), 'Should be case-insensitive');
    });

    test('filterHierarchyNode recursively filters tree', function() {
      const content = fs.readFileSync(outputDisplayPath, 'utf-8');
      const filterFn = content.match(/function filterHierarchyNode[\s\S]*?^}/m);
      assert.ok(filterFn, 'Should have filterHierarchyNode function');
      const fnContent = filterFn[0];
      assert.ok(fnContent.includes('node.children'), 'Should handle children');
      assert.ok(fnContent.includes('filterHierarchyNode'), 'Should recurse');
    });
  });
});
