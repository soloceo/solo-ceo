import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../db/supabase-client';

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  offlineMode: boolean;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  enterOfflineMode: () => void;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  offlineMode: false,
  signUp: async () => ({}),
  signIn: async () => ({}),
  signOut: async () => {},
  enterOfflineMode: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    let subscriptionRef: { unsubscribe: () => void } | null = null;

    // Get initial session — with timeout + error handling for offline
    const sessionTimeout = setTimeout(() => {
      // If getSession hasn't resolved in 2.5s, we're likely offline
      if (loading) {
        console.warn('[Auth] Session check timed out — entering offline mode');
        setOfflineMode(true);
        setLoading(false);
      }
    }, 2500);

    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        clearTimeout(sessionTimeout);
        setSession(s);
        setUser(s?.user ?? null);
        // If offline and no session, enable offline mode instead of blocking
        if (!s && !navigator.onLine) {
          setOfflineMode(true);
        }
        setLoading(false);
      })
      .catch((err) => {
        clearTimeout(sessionTimeout);
        console.warn('[Auth] Failed to get session (likely offline):', err);
        // Offline fallback: allow app to work with local data
        setOfflineMode(true);
        setLoading(false);
      });

    // Listen for auth state changes
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event, s) => {
          setSession(s);
          setUser(s?.user ?? null);
          if (s?.user) setOfflineMode(false);
          setLoading(false);
        },
      );
      subscriptionRef = subscription;
    } catch (err) {
      console.warn('[Auth] Failed to set up auth listener:', err);
    }

    // Listen for online/offline to toggle offline mode
    const handleOnline = () => {
      // When back online, try to restore session
      supabase.auth.getSession()
        .then(({ data: { session: s } }) => {
          if (s) {
            setSession(s);
            setUser(s.user);
            setOfflineMode(false);
          }
        })
        .catch(() => { /* still offline or session expired */ });
    };
    const handleOffline = () => {
      if (!user) setOfflineMode(true);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearTimeout(sessionTimeout);
      subscriptionRef?.unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const enterOfflineMode = useCallback(() => {
    setOfflineMode(true);
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, offlineMode, signUp, signIn, signOut, enterOfflineMode }}>
      {children}
    </AuthContext.Provider>
  );
}
