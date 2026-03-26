import React from "react";
import { LanguageProvider } from "../i18n/context";
import { AuthProvider } from "../auth/AuthProvider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </LanguageProvider>
  );
}
