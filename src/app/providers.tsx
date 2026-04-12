import React, { lazy, Suspense } from "react";
import { MotionConfig } from "motion/react";
import { LanguageProvider } from "../i18n/context";
import { AuthProvider } from "../auth/AuthProvider";

const PWAUpdatePrompt = lazy(() => import("../components/PWAUpdatePrompt"));

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      // fallback: CSS vars not available — hardcoded colors are intentional
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, fontFamily: 'system-ui', color: '#999' }}>
          <p style={{ fontSize: 18, fontWeight: 600 }}>Something went wrong</p>
          <p style={{ fontSize: 14 }}>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()} style={{ padding: '8px 24px', borderRadius: 8, background: '#f5c518', color: '#1a1a1a', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Reload App</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <LanguageProvider>
          <AuthProvider>
            {children}
            <Suspense fallback={null}><PWAUpdatePrompt /></Suspense>
          </AuthProvider>
        </LanguageProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}
