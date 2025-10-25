// components/ErrorBoundary.tsx
import React from 'react';
import { logClientError } from '@services/client-side/errors';

export class ErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false };
    }
  
    static getDerivedStateFromError() {
      return { hasError: true };
    }
  
    async componentDidCatch(error, info) {
      await logClientError({
        message: error?.message || 'Unknown error',
        stack: error?.stack || null,
        componentStack: info?.componentStack || null,
        userId: this.props.user?.uid || null,
        email: this.props.user?.email || null,
        path:
          typeof window !== 'undefined'
            ? window.location.pathname + window.location.search
            : undefined,
        userAgent:
          typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      });
    }
  
    handleRetry = () => {
      window.location.href = '/';
    };
  
    render() {
      const { hasError } = this.state;
      const { Fallback } = this.props;
  
      if (hasError) {
        return Fallback ? (
          <Fallback onRetry={this.handleRetry} />
        ) : (
          <div className='crash-screen'>
            <h1>Something went wrong</h1>
            <p>We’ve logged the error and are looking into it.</p>
            <button className="btn primary" onClick={this.handleRetry}>
              Go to Home
            </button>
          </div>
        );
      }
  
      return this.props.children;
    }
  }