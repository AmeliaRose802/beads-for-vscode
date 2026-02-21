const assert = require('assert');
const { loadCSSWithImports } = require('../css-loader');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

suite('Beads init guard — disabled buttons when not initialized', () => {
  const appSrc = fs.readFileSync(path.join(ROOT, 'webview', 'App.jsx'), 'utf8');
  const css = loadCSSWithImports(path.join(ROOT, 'webview', 'styles', 'index.css'));

  suite('App.jsx', () => {
    test('derives beadsEnabled from beadsStatus?.initialized', () => {
      assert.ok(
        appSrc.includes('beadsEnabled') && appSrc.includes('beadsStatus?.initialized'),
        'App should derive beadsEnabled from beadsStatus?.initialized'
      );
    });

    test('Quick Action buttons have disabled prop tied to beadsEnabled', () => {
      assert.ok(
        appSrc.includes('disabled={!beadsEnabled}'),
        'Quick Action buttons should be disabled when beads is not initialized'
      );
    });

    test('has disabledTitle for tooltip on disabled buttons', () => {
      assert.ok(
        appSrc.includes('disabledTitle'),
        'App should define a disabledTitle message for disabled button tooltips'
      );
    });

    test('disabledTitle explains beads is not initialized', () => {
      assert.ok(
        appSrc.includes('Beads is not initialized'),
        'disabledTitle should explain that beads is not initialized in this workspace'
      );
    });

    test('buttons use conditional title showing disabledTitle when disabled', () => {
      assert.ok(
        appSrc.includes('beadsEnabled ?') && appSrc.includes(': disabledTitle'),
        'buttons should switch to disabledTitle when beads is not enabled'
      );
    });
  });

  suite('CSS', () => {
    test('defines .action-btn:disabled style', () => {
      assert.ok(
        css.includes('.action-btn:disabled'),
        'CSS should define .action-btn:disabled style'
      );
    });

    test('disabled buttons use not-allowed cursor', () => {
      assert.ok(
        css.includes('cursor: not-allowed'),
        'disabled buttons should show not-allowed cursor'
      );
    });

    test('disabled buttons have reduced opacity', () => {
      assert.ok(
        css.includes('opacity: 0.4'),
        'disabled buttons should have reduced opacity to indicate unavailability'
      );
    });
  });
});
