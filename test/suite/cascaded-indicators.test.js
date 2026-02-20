const assert = require('assert');
const { loadCSSWithImports } = require('../css-loader');
const fs = require('fs');
const path = require('path');

suite('cascaded relationship indicators', () => {
  test('DependencyGraph applies cascaded edge class and tooltip text', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../webview/components/DependencyGraph.jsx'),
      'utf8'
    );

    assert.ok(
      src.includes('dependency-graph__edge--cascaded'),
      'DependencyGraph should apply dependency-graph__edge--cascaded class'
    );

    assert.ok(
      src.includes('Cascaded from'),
      'DependencyGraph edge tooltip should mention cascaded origin'
    );
  });

  test('DependencyGraphLegend includes cascaded blocks entry', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../webview/components/DependencyGraphLegend.jsx'),
      'utf8'
    );

    assert.ok(
      src.includes('cascaded blocks'),
      'Legend should label cascaded blocks'
    );

    assert.ok(
      src.includes('dependency-graph__legend-line--cascaded'),
      'Legend should include cascaded line style class'
    );
  });

  test('styles define cascaded graph and hierarchy markers', () => {
    const css = loadCSSWithImports(path.join(__dirname, '../../webview/styles/index.css'));

    assert.ok(
      css.includes('.dependency-graph__edge--cascaded'),
      'styles.css should define dependency-graph__edge--cascaded'
    );

    assert.ok(
      css.includes('.hierarchy-node__cascaded'),
      'styles.css should define hierarchy-node__cascaded'
    );
  });
});
