const assert = require('assert');
const fs = require('fs');
const path = require('path');

suite('BlockingView inline dependency editing', () => {
  const blockingViewSrc = fs.readFileSync(
    path.join(__dirname, '../../webview/components/BlockingView.jsx'), 'utf8'
  );
  const stylesSrc = fs.readFileSync(
    path.join(__dirname, '../../webview/styles.css'), 'utf8'
  );
  const appSrc = fs.readFileSync(
    path.join(__dirname, '../../webview/App.jsx'), 'utf8'
  );

  suite('BlockingView component', () => {
    test('accepts onDepAction prop', () => {
      assert.ok(
        blockingViewSrc.includes('onDepAction'),
        'BlockingView should accept onDepAction prop'
      );
    });

    test('has activeEdgeMenu state', () => {
      assert.ok(
        blockingViewSrc.includes('activeEdgeMenu'),
        'BlockingView should track active edge menu state'
      );
    });

    test('has retargetState for re-targeting links', () => {
      assert.ok(
        blockingViewSrc.includes('retargetState'),
        'BlockingView should track retarget state'
      );
    });

    test('has addLinkState for adding new links', () => {
      assert.ok(
        blockingViewSrc.includes('addLinkState'),
        'BlockingView should track add-link state'
      );
    });

    test('has handleEdgeClick handler', () => {
      assert.ok(
        blockingViewSrc.includes('handleEdgeClick'),
        'BlockingView should have handleEdgeClick handler'
      );
    });

    test('has handleRemoveLink handler', () => {
      assert.ok(
        blockingViewSrc.includes('handleRemoveLink'),
        'BlockingView should have handleRemoveLink handler'
      );
    });

    test('has handleRetarget handler', () => {
      assert.ok(
        blockingViewSrc.includes('handleRetarget'),
        'BlockingView should have handleRetarget handler'
      );
    });

    test('has handleAddLink handler', () => {
      assert.ok(
        blockingViewSrc.includes('handleAddLink'),
        'BlockingView should have handleAddLink handler'
      );
    });

    test('has renderEdgeMenu function', () => {
      assert.ok(
        blockingViewSrc.includes('renderEdgeMenu'),
        'BlockingView should have renderEdgeMenu function'
      );
    });

    test('critical path arrows are interactive', () => {
      assert.ok(
        blockingViewSrc.includes('blocking-view__critical-arrow--interactive'),
        'Critical path arrows should have interactive class'
      );
    });

    test('graph arrows are interactive', () => {
      assert.ok(
        blockingViewSrc.includes('blocking-view__arrow-down--interactive'),
        'Graph arrows should have interactive class'
      );
    });

    test('critical callout exists in component', () => {
      assert.ok(
        blockingViewSrc.includes('blocking-view__critical-callout'),
        'BlockingView should include critical callout class'
      );
    });

    test('critical actionable node class exists in component', () => {
      assert.ok(
        blockingViewSrc.includes('blocking-view__critical-node--actionable'),
        'BlockingView should include actionable critical node class'
      );
    });

    test('has isClosedStatus helper', () => {
      assert.ok(
        blockingViewSrc.includes('isClosedStatus'),
        'BlockingView should include isClosedStatus helper'
      );
    });

    test('critical callout includes unblock text', () => {
      assert.ok(
        blockingViewSrc.includes('Unblock'),
        'BlockingView should include unblock callout text'
      );
    });

    test('edge menu has remove option', () => {
      assert.ok(
        blockingViewSrc.includes('Remove link'),
        'Edge menu should have remove link option'
      );
    });

    test('edge menu has re-target option', () => {
      assert.ok(
        blockingViewSrc.includes('Re-target'),
        'Edge menu should have re-target option'
      );
    });

    test('edge menu has add link option', () => {
      assert.ok(
        blockingViewSrc.includes('Add link from'),
        'Edge menu should have add link option'
      );
    });

    test('edge menu has close button', () => {
      assert.ok(
        blockingViewSrc.includes('blocking-view__edge-menu-close'),
        'Edge menu should have a close button'
      );
    });

    test('re-target shows input field', () => {
      assert.ok(
        blockingViewSrc.includes('blocking-view__edge-menu-input'),
        'Re-target should show an input field'
      );
    });

    test('add link shows input field', () => {
      assert.ok(
        blockingViewSrc.includes('Target ID...'),
        'Add link should show an input field with placeholder'
      );
    });

    test('closeEdgeMenu resets all edge editing state', () => {
      assert.ok(
        blockingViewSrc.includes('setActiveEdgeMenu(null)'),
        'closeEdgeMenu should reset activeEdgeMenu'
      );
      assert.ok(
        blockingViewSrc.includes('setRetargetState(null)'),
        'closeEdgeMenu should reset retargetState'
      );
      assert.ok(
        blockingViewSrc.includes('setAddLinkState(null)'),
        'closeEdgeMenu should reset addLinkState'
      );
    });

    test('handleRemoveLink calls onDepAction with remove', () => {
      assert.ok(
        blockingViewSrc.includes("onDepAction('remove'"),
        'handleRemoveLink should call onDepAction with remove'
      );
    });

    test('keyboard Enter submits re-target', () => {
      assert.ok(
        blockingViewSrc.includes("e.key === 'Enter'") &&
        blockingViewSrc.includes('handleRetarget'),
        'Enter key should submit re-target'
      );
    });

    test('keyboard Escape cancels re-target', () => {
      assert.ok(
        blockingViewSrc.includes("e.key === 'Escape'"),
        'Escape key should cancel re-target/add-link'
      );
    });

    test('has no inline styles', () => {
      const inlineStylePattern = /style\s*=\s*\{\{/;
      assert.ok(
        !inlineStylePattern.test(blockingViewSrc),
        'BlockingView should have no inline styles'
      );
    });
  });

  suite('App.jsx integration', () => {
    test('passes onDepAction to BlockingView', () => {
      assert.ok(
        appSrc.includes('onDepAction'),
        'App.jsx should pass onDepAction to BlockingView'
      );
    });

    test('onDepAction uses dep add/remove commands', () => {
      assert.ok(
        appSrc.includes('dep ${action}'),
        'onDepAction should build dep add/remove command'
      );
    });

    test('onDepAction uses --blocks flag', () => {
      assert.ok(
        appSrc.includes('--blocks'),
        'onDepAction should use --blocks flag for blocking deps'
      );
    });
  });

  suite('CSS styles', () => {
    test('defines interactive arrow styles', () => {
      assert.ok(
        stylesSrc.includes('.blocking-view__arrow-down--interactive'),
        'CSS should define interactive arrow styles'
      );
      assert.ok(
        stylesSrc.includes('.blocking-view__critical-arrow--interactive'),
        'CSS should define interactive critical arrow styles'
      );
    });

    test('defines critical callout styles', () => {
      assert.ok(
        stylesSrc.includes('.blocking-view__critical-callout'),
        'CSS should define critical callout styles'
      );
    });

    test('defines actionable critical node styles', () => {
      assert.ok(
        stylesSrc.includes('.blocking-view__critical-node--actionable'),
        'CSS should define actionable critical node styles'
      );
    });

    test('defines edge menu container styles', () => {
      assert.ok(
        stylesSrc.includes('.blocking-view__edge-menu'),
        'CSS should define edge menu styles'
      );
    });

    test('edge menu uses VS Code theme variables', () => {
      assert.ok(
        stylesSrc.includes('var(--vscode-editorWidget-background)'),
        'Edge menu should use VS Code widget background'
      );
      assert.ok(
        stylesSrc.includes('var(--vscode-panel-border)'),
        'Edge menu should use VS Code panel border'
      );
    });

    test('defines edge menu button styles', () => {
      assert.ok(
        stylesSrc.includes('.blocking-view__edge-menu-btn'),
        'CSS should define edge menu button styles'
      );
    });

    test('defines remove button styling', () => {
      assert.ok(
        stylesSrc.includes('.blocking-view__edge-menu-btn--remove'),
        'CSS should style the remove button distinctly'
      );
    });

    test('defines edge menu input styles', () => {
      assert.ok(
        stylesSrc.includes('.blocking-view__edge-menu-input'),
        'CSS should define edge menu input styles'
      );
    });

    test('edge menu input uses VS Code input variables', () => {
      assert.ok(
        stylesSrc.includes('var(--vscode-input-background)'),
        'Input should use VS Code input background'
      );
      assert.ok(
        stylesSrc.includes('var(--vscode-input-foreground)'),
        'Input should use VS Code input foreground'
      );
    });

    test('interactive arrows have cursor pointer', () => {
      assert.ok(
        stylesSrc.includes('cursor: pointer'),
        'Interactive arrows should show pointer cursor'
      );
    });

    test('edge menu has z-index for overlay', () => {
      assert.ok(
        stylesSrc.includes('z-index: 10'),
        'Edge menu should have z-index for overlay'
      );
    });
  });
});
