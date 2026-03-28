import React, { lazy, Suspense } from "react";
import { LanguageProvider } from "../i18n/context";
import { AuthProvider } from "../auth/AuthProvider";

const PWAUpdatePrompt = lazy(() => import("../components/PWAUpdatePrompt"));

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <AuthProvider>
        {children}
        <Suspense fallback={null}><PWAUpdatePrompt /></Suspense>
      </AuthProvider>
    </LanguageProvider>
  );
}
