import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

/**
 * Shared cache for /api/settings — avoids duplicate calls
 * when DailyProtocol, TodayPrinciple, and Breakthrough
 * each need the same data.
 */
let cache: Record<string, string> | null = null;
let cacheTime = 0;
let inflight: Promise<Record<string, string>> | null = null;
const CACHE_TTL = 10_000; // 10 seconds

async function fetchSettings(): Promise<Record<string, string>> {
  if (cache && Date.now() - cacheTime < CACHE_TTL) return cache;
  if (inflight) return inflight;
  inflight = api.get<Record<string, string>>('/api/settings')
    .then(data => {
      cache = data;
      cacheTime = Date.now();
      inflight = null;
      return data;
    })
    .catch(e => {
      inflight = null;
      throw e;
    });
  return inflight;
}

export function invalidateSettingsCache() {
  cache = null;
  cacheTime = 0;
}

export function useAppSettings() {
  const [settings, setSettings] = useState<Record<string, string> | null>(cache);
  const [loaded, setLoaded] = useState(!!cache);

  const load = useCallback(async () => {
    try {
      const data = await fetchSettings();
      setSettings(data);
      setLoaded(true);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (key: string, value: string) => {
    try {
      await api.post('/api/settings', { [key]: value });
    } catch (e) {
      console.warn('[useAppSettings] save failed', e);
      throw e;
    }
    // Update local cache immediately — create new object to avoid shared mutation
    cache = cache ? { ...cache, [key]: value } : { [key]: value };
    cacheTime = Date.now();
    setSettings(prev => prev ? { ...prev, [key]: value } : { [key]: value });
  }, []);

  return { settings, loaded, save, reload: load };
}
