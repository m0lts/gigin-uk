// components/ErrorBoundary.tsx
import React from 'react';
import { logClientError } from '@services/client-side/errors';
import { AppCrashFallback } from './AppCrashFallback';

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
        const Crash = Fallback || AppCrashFallback;
        return <Crash onRetry={this.handleRetry} />;
      }
  
      return this.props.children;
    }
  }