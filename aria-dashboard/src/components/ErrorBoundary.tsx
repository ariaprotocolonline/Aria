import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ARIA] Unhandled error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg flex items-center justify-center px-6">
          <div className="max-w-md w-full border border-soft bg-card rounded-sm p-8 text-center">
            <h1 className="font-serif text-2xl text-text-primary mb-3">Something went wrong</h1>
            <p className="text-text-secondary text-sm mb-6 leading-relaxed">
              ARIA encountered an unexpected error. Your funds are safe. This is a UI issue only.
            </p>
            <p className="font-mono text-xs text-text-secondary bg-bg-soft border border-soft rounded-sm px-4 py-3 mb-6 text-left break-all">
              {this.state.error?.message ?? 'Unknown error'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-accent text-white font-semibold rounded-sm hover:opacity-90 transition-opacity text-sm"
            >
              Reload Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
