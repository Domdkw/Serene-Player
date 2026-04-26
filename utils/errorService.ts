type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

interface ErrorLog {
  timestamp: Date;
  error: Error;
  context: string;
  severity: ErrorSeverity;
  userAgent?: string;
  url?: string;
}

class ErrorServiceClass {
  private static instance: ErrorServiceClass;
  private errorLogs: ErrorLog[] = [];
  private maxLogs: number = 100;
  private onErrorCallback?: (error: ErrorLog) => void;

  private constructor() {}

  static getInstance(): ErrorServiceClass {
    if (!ErrorServiceClass.instance) {
      ErrorServiceClass.instance = new ErrorServiceClass();
    }
    return ErrorServiceClass.instance;
  }

  handleError(error: Error, context: string, severity: ErrorSeverity = 'medium'): void {
    const errorLog: ErrorLog = {
      timestamp: new Date(),
      error,
      context,
      severity,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    this.errorLogs.push(errorLog);

    if (this.errorLogs.length > this.maxLogs) {
      this.errorLogs.shift();
    }

    console.error(`[${context}]`, error);

    if (this.onErrorCallback) {
      this.onErrorCallback(errorLog);
    }

    if (severity === 'critical') {
      this.handleCriticalError(errorLog);
    }
  }

  private handleCriticalError(errorLog: ErrorLog): void {
    console.error('CRITICAL ERROR:', errorLog);
  }

  setOnErrorCallback(callback: (error: ErrorLog) => void): void {
    this.onErrorCallback = callback;
  }

  getErrorLogs(): ErrorLog[] {
    return [...this.errorLogs];
  }

  clearErrorLogs(): void {
    this.errorLogs = [];
  }

  getRecentErrors(count: number = 10): ErrorLog[] {
    return this.errorLogs.slice(-count);
  }

  getErrorsByContext(context: string): ErrorLog[] {
    return this.errorLogs.filter(log => log.context === context);
  }

  getErrorsBySeverity(severity: ErrorSeverity): ErrorLog[] {
    return this.errorLogs.filter(log => log.severity === severity);
  }

  createUserFriendlyMessage(error: Error, context: string): string {
    const errorName = error.name.toLowerCase();
    const errorMessage = error.message.toLowerCase();

    if (errorName.includes('network') || errorMessage.includes('network')) {
      return '网络连接失败，请检查您的网络设置';
    }

    if (errorName.includes('abort')) {
      return '操作已取消';
    }

    if (context.includes('Load') || context.includes('Fetch')) {
      return '加载数据失败，请稍后重试';
    }

    if (context.includes('Playback') || context.includes('Play')) {
      return '播放失败，请尝试其他歌曲';
    }

    if (context.includes('Upload')) {
      return '文件上传失败，请检查文件格式';
    }

    return '操作失败，请稍后重试';
  }
}

export const ErrorService = ErrorServiceClass.getInstance();
export type { ErrorLog, ErrorSeverity };
