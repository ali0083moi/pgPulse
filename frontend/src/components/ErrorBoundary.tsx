import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 m-4 rounded-2xl bg-rose-950/80 border border-rose-900 text-rose-100 space-y-4 max-w-2xl mx-auto shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-rose-200">
                {this.props.fallbackTitle || 'Component Render Error'}
              </h3>
              <p className="text-xs text-rose-300 font-mono">{this.state.error?.toString()}</p>
            </div>
          </div>

          {this.state.errorInfo && (
            <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-rose-300 text-xs font-mono overflow-auto max-h-48 whitespace-pre-wrap">
              {this.state.errorInfo.componentStack}
            </pre>
          )}

          <button
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Dismiss & Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
