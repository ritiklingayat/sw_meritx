import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Meritx Platform Caught Unhandled Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetStorage = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error('Failed to clear storage:', e);
    }
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          fontFamily: 'DM Sans, system-ui, -apple-system, sans-serif',
          padding: '24px'
        }}>
          <div style={{
            maxWidth: '600px',
            width: '100%',
            background: '#1e293b',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            border: '1px solid #334155'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: '#ef4444',
                display: 'grid',
                placeItems: 'center',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '20px'
              }}>!</div>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>Platform Recovery Alert</h2>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Client-Side Online Examination Platform</div>
              </div>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
              An unexpected render issue was caught. You can try refreshing or resetting local state to reload the official mock assessments.
            </p>

            <div style={{
              background: '#090d16',
              padding: '14px 16px',
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: '13px',
              color: '#f87171',
              marginBottom: '24px',
              wordBreak: 'break-word',
              border: '1px solid #7f1d1d'
            }}>
              {this.state.error?.toString() || 'Unknown Error'}
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Reload Platform
              </button>
              <button
                type="button"
                onClick={this.handleResetStorage}
                style={{
                  background: '#334155',
                  color: '#f8fafc',
                  border: '1px solid #475569',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Reset Demo Storage & Home
              </button>
            </div>

            {this.state.errorInfo?.componentStack && (
              <details style={{ marginTop: '24px', color: '#64748b', fontSize: '11px' }}>
                <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>View Component Stack Trace</summary>
                <pre style={{
                  background: '#090d16',
                  padding: '12px',
                  borderRadius: '6px',
                  overflowX: 'auto',
                  color: '#94a3b8',
                  maxHeight: '200px'
                }}>
                  {this.state.errorInfo.componentStack}
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
export default ErrorBoundary;
