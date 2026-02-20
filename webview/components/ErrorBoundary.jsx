import React from 'react';

/**
 * ErrorBoundary - Catches React rendering errors and displays fallback UI
 * 
 * Prevents full webview crashes by isolating errors to specific components.
 * Logs errors to VS Code output channel for debugging.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));

    // Log to VS Code output channel
    this.logErrorToVSCode(error, errorInfo);
  }

  logErrorToVSCode(error, errorInfo) {
    const errorMessage = {
      type: 'logError',
      error: {
        name: error?.name || 'Unknown Error',
        message: error?.message || 'An error occurred',
        stack: error?.stack || '',
        componentStack: errorInfo?.componentStack || ''
      },
      boundaryName: this.props.name || 'ErrorBoundary'
    };

    // Post to VS Code if vscode API is available
    if (typeof acquireVsCodeApi !== 'undefined') {
      try {
        const vscode = acquireVsCodeApi();
        vscode.postMessage(errorMessage);
      } catch (e) {
        console.error('Failed to log error to VS Code:', e);
      }
    }

    // Also log to console for development
    console.error(`[${this.props.name || 'ErrorBoundary'}] Error:`, error);
    console.error('Component Stack:', errorInfo?.componentStack);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    });
    
    // If onReset callback provided, call it
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          retry: this.handleRetry,
          reset: this.handleReset
        });
      }

      // Default fallback UI
      const boundaryName = this.props.name || 'Component';
      const showDetails = this.props.showDetails !== false;

      return (
        <div className="error-boundary">
          <div className="error-boundary__content">
            <div className="error-boundary__icon">⚠️</div>
            <h3 className="error-boundary__title">
              {boundaryName} Error
            </h3>
            <p className="error-boundary__message">
              Something went wrong in this section. The rest of the app should still work.
            </p>
            
            {showDetails && this.state.error && (
              <details className="error-boundary__details">
                <summary>Error Details</summary>
                <div className="error-boundary__details-content">
                  <strong>{this.state.error.name}:</strong> {this.state.error.message}
                  {this.state.error.stack && (
                    <pre className="error-boundary__stack">
                      {this.state.error.stack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            <div className="error-boundary__actions">
              <button 
                className="error-boundary__retry-btn"
                onClick={this.handleRetry}
              >
                🔄 Retry
              </button>
              {this.props.onReset && (
                <button 
                  className="error-boundary__reset-btn"
                  onClick={this.handleReset}
                >
                  ↺ Reset
                </button>
              )}
            </div>

            {this.state.errorCount > 1 && (
              <p className="error-boundary__warning">
                This error has occurred {this.state.errorCount} times.
                Consider refreshing the entire webview if the problem persists.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
