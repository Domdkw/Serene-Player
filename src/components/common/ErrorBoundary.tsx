import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
          <div className="w-full backdrop-blur-sm p-8 text-center">
            
            <h2 className="text-xl font-bold text-white mb-2">
              出现了一些问题
            </h2>
            
            <p className="text-white/60 mb-6">
              应用遇到了一个错误，请尝试刷新页面或重试
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="bg-black/30 rounded-lg text-left">
                <p className="text-red-400 text-sm font-mono break-all mb-3">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <pre className="text-sm mt-2 overflow-auto max-h-96 whitespace-pre-wrap break-words">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <p className="text-yellow-400 mb-4">更多信息查看浏览器控制台</p>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-white text-black rounded-xl hover:bg-white/90 transition-colors font-medium"
              >
                刷新页面
              </button>
            </div>
          </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
