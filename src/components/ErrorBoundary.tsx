// @ts-nocheck — React 19 class components need @types/react for proper typing
import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  key?: React.Key;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Detect language from localStorage (can't use hooks in class components)
const getLabel = (zh: string, en: string) => {
  try {
    return localStorage.getItem("APP_LANGUAGE") === "en" ? en : zh;
  } catch {
    return zh;
  }
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: "color-mix(in srgb, var(--color-danger) 15%, transparent)" }}
          >
            <AlertTriangle size={24} style={{ color: "var(--color-danger)" }} />
          </div>
          <div>
            <h3 className="text-base mb-1" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
              {getLabel("页面加载出错", "Page Load Error")}
            </h3>
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              {this.state.error?.message || getLabel("发生了未知错误", "An unknown error occurred")}
            </p>
          </div>
          <button
            onClick={this.handleRetry}
            className="btn-primary text-[15px]"
          >
            <RefreshCw size={16} />
            {getLabel("重新加载", "Reload")}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
