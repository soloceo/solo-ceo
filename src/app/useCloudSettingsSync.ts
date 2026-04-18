import { useEffect } from 'react';
import { api } from '../lib/api';
import { useSettingsStore, PROFILE_SYNC_KEYS } from '../store/useSettingsStore';
import { useUIStore } from '../store/useUIStore';
import { useWidgetStore } from '../features/home/widgets/useWidgetStore';

type User = { id?: string } | null | undefined;

/**
 * On sign-in, pull `/api/settings` and hydrate the various client stores
 * from it. This used to live as a single 30-line useEffect inside App()
 * that touched seven different stores and two localStorage keys; lifting
 * it into a named hook makes App.tsx easier to follow and lets the sync
 * logic be swapped or tested independently of layout.
 *
 * Keeps the exact original behaviour:
 *   - cloud value overwrites local (we assume the user's most recent
 *     device is the source of truth on login)
 *   - `COUNTDOWNS` / `ENERGY_DATA` localStorage blobs are only seeded from
 *     cloud when the local key is missing (don't clobber fresh offline edits)
 *   - any error is swallowed — profile sync is non-critical, app still usable
 */
export function useCloudSettingsSync(
  user: User,
  onStreakLoaded: (raw: string | null) => void,
): void {
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    api.get<Record<string, string>>('/api/settings')
      .then((s) => {
        if (cancelled) return;
        hydrateProfileFields(s);
        hydratePreferences(s);
        hydrateTheme(s);
        hydrateWidgets(s);
        if (s.protocol_streak) onStreakLoaded(s.protocol_streak);
      })
      .catch(() => { /* profile sync failed — non-critical */ });

    return () => { cancelled = true; };
    // onStreakLoaded is deliberately omitted: callers should pass a stable
    // setState setter; if they pass an inline arrow, we don't want to
    // re-fetch settings on every App render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
}

function hydrateProfileFields(s: Record<string, string>): void {
  const store = useSettingsStore.getState();
  store.setOperator(s.OPERATOR_NAME || '', s.OPERATOR_AVATAR || '');
  for (const [field, key] of Object.entries(PROFILE_SYNC_KEYS)) {
    if (field === 'operatorName' || field === 'operatorAvatar') continue; // handled above
    if (s[key] != null) {
      store.setProfileField(field as keyof typeof PROFILE_SYNC_KEYS, s[key]);
    }
  }
}

function hydratePreferences(s: Record<string, string>): void {
  const settings = useSettingsStore.getState();
  if (s.CURRENCY) settings.setCurrency(s.CURRENCY);
  if (s.TIMEZONE) settings.setTimezone(s.TIMEZONE);
}

function hydrateTheme(s: Record<string, string>): void {
  const ui = useUIStore.getState();
  if (s.THEME_MODE && s.THEME_MODE !== ui.themeMode) {
    ui.setThemeMode(s.THEME_MODE as 'light' | 'dark' | 'auto');
  }
  if (s.STYLE_ID && s.STYLE_ID !== ui.styleId) ui.setStyleId(s.STYLE_ID);
  if (s.PALETTE_ID && s.PALETTE_ID !== ui.paletteId) ui.setPaletteId(s.PALETTE_ID);
}

function hydrateWidgets(s: Record<string, string>): void {
  if (s.WIDGET_LAYOUT) {
    try { useWidgetStore.getState().setLayout(JSON.parse(s.WIDGET_LAYOUT)); } catch { /* malformed — ignore */ }
  }
  // Only seed from cloud when the local copy is missing, otherwise we'd
  // overwrite in-progress offline edits the user hasn't synced back yet.
  if (s.COUNTDOWNS && !localStorage.getItem('solo-ceo-countdowns')) {
    try { localStorage.setItem('solo-ceo-countdowns', s.COUNTDOWNS); } catch { /* quota exceeded */ }
  }
  if (s.ENERGY_DATA && !localStorage.getItem('solo-ceo-energy-v3')) {
    try { localStorage.setItem('solo-ceo-energy-v3', s.ENERGY_DATA); } catch { /* quota exceeded */ }
  }
}
