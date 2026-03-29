// @ts-nocheck — React 19 class components need @types/react for proper typing
import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
  pageName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const getLabel = (zh: string, en: string) => {
  try {
    return localStorage.getItem("APP_LANGUAGE") === "en" ? en : zh;
  } catch {
    return zh;
  }
};

/**
 * Page-level error boundary — wraps each feature page independently
 * so a crash in one page doesn't take down the entire app.
 */
export class PageErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[PageErrorBoundary${this.props.pageName ? `:${this.props.pageName}` : ""}]`, error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 p-8 text-center">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "color-mix(in srgb, var(--color-danger) 15%, transparent)" }}
          >
            <AlertTriangle size={20} style={{ color: "var(--color-danger)" }} />
          </div>
          <div>
            <h3 className="text-sm mb-1" style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>
              {getLabel("模块加载出错", "Module Load Error")}
              {this.props.pageName && ` — ${this.props.pageName}`}
            </h3>
            <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
              {this.state.error?.message || getLabel("发生了未知错误", "An unknown error occurred")}
            </p>
          </div>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors"
            style={{
              background: "var(--color-accent)",
              color: "var(--color-brand-text)",
            }}
          >
            <RefreshCw size={12} />
            {getLabel("重试", "Retry")}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
