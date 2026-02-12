const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

suite('IssueCard tag rendering', () => {
  test('IssueCard uses labels array for tag rendering', () => {
    const issueCardPath = path.join(ROOT, 'webview', 'components', 'IssueCard.jsx');
    const source = fs.readFileSync(issueCardPath, 'utf8');

    assert.ok(source.includes('issue-card__tags'), 'IssueCard should render a tags container');
    assert.ok(source.includes('issue-card__tag'), 'IssueCard should render individual tag elements');
    assert.ok(source.includes('issue.labels'), 'IssueCard should read labels from the issue model');
  });

  test('Styles define tag classes with wrapping layout', () => {
    const stylesPath = path.join(ROOT, 'webview', 'styles.css');
    const css = fs.readFileSync(stylesPath, 'utf8');

    assert.ok(css.includes('.issue-card__tags'), 'CSS should define container for issue-card tags');
    assert.ok(css.includes('flex-wrap: wrap'), 'Tag container should wrap on narrow views');
    assert.ok(css.includes('.issue-card__tag'), 'CSS should define individual tag styling');
  });
});
