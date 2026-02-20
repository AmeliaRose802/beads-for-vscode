const assert = require('assert');
const { JSDOM } = require('jsdom');
const React = require('react');
const { createRoot } = require('react-dom/client');

suite('ErrorBoundary', () => {
  let dom, document, ErrorBoundary, container;

  setup(() => {
    // Setup JSDOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
    document = dom.window.document;
    global.window = dom.window;
    global.document = document;

    // Mock acquireVsCodeApi
    global.acquireVsCodeApi = () => ({
      postMessage: () => {}
    });

    // Delete require cache to ensure fresh module
    delete require.cache[require.resolve('../../webview/components/ErrorBoundary.jsx')];
    ErrorBoundary = require('../../webview/components/ErrorBoundary.jsx').default;

    container = document.getElementById('root');
  });

  test('should render children when there is no error', (done) => {
    const TestComponent = () => React.createElement('div', null, 'Test Content');
    
    const root = createRoot(container);
    root.render(
      React.createElement(ErrorBoundary, { name: 'Test' },
        React.createElement(TestComponent)
      )
    );

    setTimeout(() => {
      assert.ok(container.textContent.includes('Test Content'));
      done();
    }, 100);
  });

  test('should catch errors and display fallback UI', (done) => {
    const BuggyComponent = () => {
      throw new Error('Test error');
    };

    const root = createRoot(container);
    root.render(
      React.createElement(ErrorBoundary, { name: 'TestBoundary' },
        React.createElement(BuggyComponent)
      )
    );

    setTimeout(() => {
      const content = container.textContent;
      assert.ok(content.includes('TestBoundary Error'));
      assert.ok(content.includes('Something went wrong'));
      assert.ok(content.includes('Retry'));
      done();
    }, 100);
  });

  test('should display custom fallback when provided', (done) => {
    const BuggyComponent = () => {
      throw new Error('Test error');
    };

    const customFallback = ({ retry }) => 
      React.createElement('div', null, 
        React.createElement('p', null, 'Custom Error Message'),
        React.createElement('button', { onClick: retry }, 'Try Again')
      );

    const root = createRoot(container);
    root.render(
      React.createElement(ErrorBoundary, { 
        name: 'TestBoundary',
        fallback: customFallback
      },
        React.createElement(BuggyComponent)
      )
    );

    setTimeout(() => {
      const content = container.textContent;
      assert.ok(content.includes('Custom Error Message'));
      assert.ok(content.includes('Try Again'));
      done();
    }, 100);
  });

  test('should show error details when showDetails is true', (done) => {
    const BuggyComponent = () => {
      throw new Error('Detailed test error');
    };

    const root = createRoot(container);
    root.render(
      React.createElement(ErrorBoundary, { 
        name: 'TestBoundary',
        showDetails: true
      },
        React.createElement(BuggyComponent)
      )
    );

    setTimeout(() => {
      const content = container.textContent;
      assert.ok(content.includes('Error Details'));
      assert.ok(content.includes('Detailed test error'));
      done();
    }, 100);
  });

  test('should not show error details when showDetails is false', (done) => {
    const BuggyComponent = () => {
      throw new Error('Hidden error details');
    };

    const root = createRoot(container);
    root.render(
      React.createElement(ErrorBoundary, { 
        name: 'TestBoundary',
        showDetails: false
      },
        React.createElement(BuggyComponent)
      )
    );

    setTimeout(() => {
      const content = container.textContent;
      assert.ok(!content.includes('Error Details'));
      done();
    }, 100);
  });

  test('should call onReset when reset button is clicked', (done) => {
    let resetCalled = false;
    const onReset = () => { resetCalled = true; };

    const BuggyComponent = () => {
      throw new Error('Test error');
    };

    const root = createRoot(container);
    root.render(
      React.createElement(ErrorBoundary, { 
        name: 'TestBoundary',
        onReset
      },
        React.createElement(BuggyComponent)
      )
    );

    setTimeout(() => {
      const resetButton = container.querySelector('.error-boundary__reset-btn');
      if (resetButton) {
        resetButton.click();
        setTimeout(() => {
          assert.strictEqual(resetCalled, true);
          done();
        }, 50);
      } else {
        done(new Error('Reset button not found'));
      }
    }, 100);
  });

  test('should attempt to log to VS Code', (done) => {
    let messagePosted = false;
    global.acquireVsCodeApi = () => ({
      postMessage: (msg) => {
        if (msg.type === 'logError') {
          messagePosted = true;
        }
      }
    });

    const BuggyComponent = () => {
      throw new Error('VS Code log test');
    };

    const root = createRoot(container);
    root.render(
      React.createElement(ErrorBoundary, { name: 'TestBoundary' },
        React.createElement(BuggyComponent)
      )
    );

    setTimeout(() => {
      assert.strictEqual(messagePosted, true);
      done();
    }, 100);
  });

  test('should handle missing vscode API gracefully', (done) => {
    global.acquireVsCodeApi = undefined;

    const BuggyComponent = () => {
      throw new Error('No vscode API error');
    };

    const root = createRoot(container);
    root.render(
      React.createElement(ErrorBoundary, { name: 'TestBoundary' },
        React.createElement(BuggyComponent)
      )
    );

    setTimeout(() => {
      // Should still render error UI even without vscode API
      assert.ok(container.textContent.includes('TestBoundary Error'));
      done();
    }, 100);
  });
});
