// ErrorBoundary.jsx - Catches React render errors and shows component stack
import React from 'react';

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
  }

  render() {
    if (this.state.hasError) {
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
              {this.state.error?.toString()}
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
              {this.state.errorInfo?.componentStack}
            </pre>
          </div>

          <button
            onClick={() => window.location.reload()}
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

    return this.props.children;
  }
}

export default ErrorBoundary;
