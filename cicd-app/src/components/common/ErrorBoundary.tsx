import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
    console.error('Uncaught error in component tree:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#FAF7F3] text-[#2D2926] flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-white rounded-2xl border border-[#E5DED6] shadow-xl p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-[#C34A4A]/10 border border-[#C34A4A]/30 flex items-center justify-center text-[#C34A4A]">
                <span className="material-symbols-outlined text-2xl">warning</span>
              </div>
              <div>
                <h2 className="text-xl font-bold font-headline-lg text-[#2D2926]">
                  Component Render Error
                </h2>
                <p className="text-xs text-[#6B625B] mt-0.5">
                  SentinelOps caught an unhandled view exception and prevented a system freeze.
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="p-4 rounded-xl bg-[#201B18] font-mono text-xs text-[#F2EDE6] overflow-x-auto border border-[#3E3835] space-y-1">
                <p className="text-[#fca5a5] font-semibold">{this.state.error.name}: {this.state.error.message}</p>
                {this.state.error.stack && (
                  <pre className="text-[11px] text-[#A89F91] whitespace-pre-wrap max-h-36 overflow-y-auto mt-2">
                    {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                  </pre>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="px-5 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#99462A] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                <span>Reload Application</span>
              </button>
              <button
                onClick={() => {
                  window.location.hash = '#/dashboard';
                  window.location.reload();
                }}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#FAF7F3] border border-[#E5DED6] text-[#2D2926] text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">dashboard</span>
                <span>Back to Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
