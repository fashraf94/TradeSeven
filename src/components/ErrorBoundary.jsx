// ErrorBoundary.jsx - Catches React render errors and shows recovery UI
import React from 'react';
import PropTypes from 'prop-types';
import { doc, setDoc, collection } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Log render errors to Firebase for production visibility.
 * Fire-and-forget — never lets logging errors cascade.
 */
export async function logErrorToFirebase(error, errorInfo, screenName) {
  try {
    const errorRef = doc(collection(db, 'errorLogs'));
    await setDoc(errorRef, {
      screen: screenName || 'unknown',
      message: error?.message || 'Unknown error',
      stack: error?.stack?.substring(0, 1000) || '',
      componentStack: errorInfo?.componentStack?.substring(0, 500) || '',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });
  } catch (e) {
    // Silently fail — never let error logging cause more errors
    console.warn('[ErrorLog] Failed to log to Firebase:', e);
  }
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
 * @param {string} name - Human-readable screen name for error messages and logging
 * @param {React.ReactNode|Function} fallback - Custom fallback UI (component or render function)
 * @param {Function} onError - Callback when error occurs: (error, errorInfo, name)
 * @param {Function} onNavigateDashboard - Called when user clicks "Back to Dashboard"
 *
 * @example
 * <ErrorBoundary name="Battle View" onNavigateDashboard={() => setScreen('dashboard')}>
 *   <BattleViewScreen />
 * </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    console.error(
      `[ErrorBoundary] ${this.props.name || 'Unknown'} crashed:`,
      error,
      errorInfo?.componentStack
    );

    // Log to Firebase for production visibility
    logErrorToFirebase(error, errorInfo, this.props.name);

    try {
      if (this.props.onError) {
        this.props.onError(error, errorInfo, this.props.name);
      }
    } catch (e) {
      console.error('[ErrorBoundary] onError callback failed:', e);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  handleBackToDashboard = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onNavigateDashboard) {
      this.props.onNavigateDashboard();
    }
  };

  render() {
    if (this.state.hasError) {
      const { fallback, name, onNavigateDashboard } = this.props;
      const { error, errorInfo } = this.state;

      // Render function fallback
      if (typeof fallback === 'function') {
        return fallback(error, this.handleReset, errorInfo);
      }

      // React element fallback
      if (React.isValidElement(fallback)) {
        return React.cloneElement(fallback, {
          error,
          errorInfo,
          onRetry: this.handleReset,
        });
      }

      // Default screen-level error UI
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#0d1117',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}>
          <div style={{
            backgroundColor: '#161b22',
            border: '1px solid #ff4757',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{
              color: '#e6edf3',
              fontSize: '20px',
              fontWeight: '700',
              marginBottom: '8px',
            }}>
              Something went wrong
            </h2>
            <p style={{
              color: '#8b949e',
              fontSize: '14px',
              marginBottom: '24px',
              lineHeight: '1.5',
            }}>
              {name
                ? `${name} encountered an error.`
                : 'An unexpected error occurred.'
              }
              {' '}Your data is safe — tap below to continue.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={this.handleReset}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'rgba(0, 217, 255, 0.1)',
                  border: '1px solid #00d9ff',
                  borderRadius: '10px',
                  color: '#00d9ff',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Try Again
              </button>
              {onNavigateDashboard && (
                <button
                  onClick={this.handleBackToDashboard}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid #21262d',
                    borderRadius: '10px',
                    color: '#8b949e',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Back to Dashboard
                </button>
              )}
            </div>

            {/* Show error details in dev mode */}
            {process.env.NODE_ENV === 'development' && error && (
              <details style={{
                marginTop: '20px',
                textAlign: 'left',
                color: '#8b949e',
                fontSize: '12px',
              }}>
                <summary style={{ cursor: 'pointer', color: '#ff4757' }}>
                  Error Details
                </summary>
                <pre style={{
                  marginTop: '8px',
                  padding: '12px',
                  backgroundColor: '#0d1117',
                  borderRadius: '8px',
                  overflow: 'auto',
                  maxHeight: '200px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {error.toString()}
                  {errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  name: PropTypes.string,
  fallback: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
  onError: PropTypes.func,
  onRetry: PropTypes.func,
  onNavigateDashboard: PropTypes.func,
};

export default ErrorBoundary;
