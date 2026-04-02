import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../db/supabase-client';
import { useSettingsStore } from '../store/useSettingsStore';
import { invalidateSettingsCache } from '../hooks/useAppSettings';
import { clearQueue } from '../db/offline-queue';
import { clearLocalDb } from '../db/index';
import { resetCachedUserId } from '../db/supabase-api';
import { resetCachedAuth } from '../db/supabase-interceptor';

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  offlineMode: boolean;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  enterOfflineMode: () => void;
  exitOfflineMode: () => void;
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
  exitOfflineMode: () => {},
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
      // If getSession hasn't resolved in 6s, we're likely offline or on slow network
      if (loading) {
        setOfflineMode(true);
        setLoading(false);
      }
    }, 6000);

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
        // Offline fallback: allow app to work with local data
        setOfflineMode(true);
        setLoading(false);
      });

    // Listen for auth state changes
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, s) => {
          if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
            setOfflineMode(true);
          }
          setSession(s);
          setUser(s?.user ?? null);
          if (s?.user) setOfflineMode(false);
          setLoading(false);
        },
      );
      subscriptionRef = subscription;
    } catch (err) {
      // Auth listener setup failed — app continues in offline mode
    }

    // Listen for online/offline to toggle offline mode
    const handleOnline = () => {
      // When back online, try to refresh session first (handles expired tokens)
      supabase.auth.refreshSession()
        .then(({ data: { session: s } }) => {
          if (s) {
            setSession(s);
            setUser(s.user);
            setOfflineMode(false);
          } else {
            // Token couldn't be refreshed — try getSession as fallback
            return supabase.auth.getSession().then(({ data: { session: s2 } }) => {
              if (s2) {
                setSession(s2);
                setUser(s2.user);
                setOfflineMode(false);
              } else {
                // Session expired — user needs to re-login
              }
            });
          }
        })
        .catch(() => { /* Session refresh failed — stays in current mode */ });
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
    // 1. Immediately clear module-level caches to prevent stale routing
    resetCachedUserId();
    resetCachedAuth();

    // 2. Sign out from Supabase (revokes session)
    await supabase.auth.signOut();

    // 3. Clear all user-specific persisted state
    useSettingsStore.getState().resetForSignOut();
    invalidateSettingsCache();

    // 4. Clear offline data (prevents cross-user data leaks)
    clearQueue().catch(() => {});
    clearLocalDb().catch(() => {});

    // 5. Clear user-specific localStorage keys
    localStorage.removeItem('solo-ceo-countdowns');
    localStorage.removeItem('solo-ceo-countdown');
    localStorage.removeItem('solo-ceo-energy-v3');
    // Clear today-focus-skipped keys (date-based, clear all matching)
    try {
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (k.startsWith('today-focus-skipped-')) localStorage.removeItem(k);
      }
    } catch { /* localStorage access may fail in some contexts */ }
  }, []);

  const enterOfflineMode = useCallback(() => {
    setOfflineMode(true);
    setLoading(false);
  }, []);

  const exitOfflineMode = useCallback(() => {
    setOfflineMode(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, offlineMode, signUp, signIn, signOut, enterOfflineMode, exitOfflineMode }}>
      {children}
    </AuthContext.Provider>
  );
}
