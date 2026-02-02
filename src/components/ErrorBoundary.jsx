// ErrorBoundary.jsx - Catches React render errors and shows component stack
import React from 'react';
import PropTypes from 'prop-types';

/**
 * Default error fallback UI
 */
function DefaultErrorFallback({ error, errorInfo, onRetry }) {
  return (
    <div style={{
      padding: 20,
      background: '#1a1a2e',
      color: '#ff6b6b',
      minHeight: '100vh',
      fontFamily: 'monospace'
    }}>
      <h2 style={{ color: '#ff6b6b', marginBottom: 20 }}>
        🔴 Something went wrong
      </h2>

      <div style={{ marginBottom: 20 }}>
        <strong>Error:</strong>
        <pre style={{
          background: '#0d0d1a',
          padding: 10,
          borderRadius: 8,
          overflow: 'auto',
          color: '#ffd93d'
        }}>
          {error?.toString()}
        </pre>
      </div>

      <div>
        <strong>Component Stack (look for the component causing the issue):</strong>
        <pre style={{
          background: '#0d0d1a',
          padding: 10,
          borderRadius: 8,
          overflow: 'auto',
          color: '#6bcb77',
          fontSize: '12px',
          lineHeight: '1.5'
        }}>
          {errorInfo?.componentStack}
        </pre>
      </div>

      <button
        onClick={onRetry || (() => window.location.reload())}
        style={{
          marginTop: 20,
          padding: '10px 20px',
          background: '#4361ee',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 16
        }}
      >
        Reload Page
      </button>
    </div>
  );
}

/**
 * Compact error fallback for inline components
 */
export function CompactErrorFallback({ error, onRetry, message }) {
  return (
    <div style={{
      padding: '16px 20px',
      background: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      borderRadius: 8,
      textAlign: 'center',
    }}>
      <p style={{
        color: '#ef4444',
        fontSize: '14px',
        fontWeight: 500,
        margin: '0 0 12px 0',
      }}>
        {message || 'Something went wrong loading this section.'}
      </p>
      <button
        onClick={onRetry || (() => window.location.reload())}
        style={{
          padding: '8px 16px',
          background: '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 600,
        }}
      >
        Reload
      </button>
    </div>
  );
}

CompactErrorFallback.propTypes = {
  error: PropTypes.object,
  onRetry: PropTypes.func,
  message: PropTypes.string,
};

/**
 * ErrorBoundary - Catches React render errors
 *
 * @param {React.ReactNode} children - Child components to wrap
 * @param {React.ReactNode|Function} fallback - Fallback UI (component or render function)
 * @param {Function} onError - Callback when error occurs
 * @param {Function} onRetry - Callback for retry button
 *
 * @example
 * // With default fallback
 * <ErrorBoundary>
 *   <BaggerBombBattleView />
 * </ErrorBoundary>
 *
 * // With compact fallback
 * <ErrorBoundary fallback={<CompactErrorFallback message="Failed to load battle" />}>
 *   <BaggerBombBattleView />
 * </ErrorBoundary>
 *
 * // With render function fallback
 * <ErrorBoundary fallback={(error, retry) => <CustomError error={error} onRetry={retry} />}>
 *   <BaggerBombBattleView />
 * </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('🔴 ERROR BOUNDARY CAUGHT:', error);
    console.error('🔴 ERROR MESSAGE:', error?.message);
    console.error('🔴 COMPONENT STACK:', errorInfo?.componentStack);

    // Also log to help identify the issue
    if (error?.message?.includes('filter')) {
      console.error('🔴 THIS IS THE FILTER CRASH!');
      console.error('🔴 Look at the component stack above to find the culprit');
    }

    this.setState({ error, errorInfo });

    // Call onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      const { error, errorInfo } = this.state;

      // Render function fallback
      if (typeof fallback === 'function') {
        return fallback(error, this.handleRetry, errorInfo);
      }

      // React element fallback
      if (React.isValidElement(fallback)) {
        return React.cloneElement(fallback, {
          error,
          errorInfo,
          onRetry: this.handleRetry,
        });
      }

      // Default fallback
      return (
        <DefaultErrorFallback
          error={error}
          errorInfo={errorInfo}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  fallback: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
  onError: PropTypes.func,
  onRetry: PropTypes.func,
};

ErrorBoundary.defaultProps = {
  fallback: null,
  onError: null,
  onRetry: null,
};

export default ErrorBoundary;
