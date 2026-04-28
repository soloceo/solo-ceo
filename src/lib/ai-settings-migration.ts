import { AI_KEY_MAP, getLocalAIKey, setLocalAIKey, type CloudAIProvider } from './ai-client';
import { api } from './api';

export async function migrateLegacyAIKeysFromSettings(settings: Record<string, string>): Promise<Record<string, string>> {
  const cleared: Record<string, string> = {};
  for (const [provider, keyName] of Object.entries(AI_KEY_MAP) as [CloudAIProvider, string][]) {
    const legacyKey = settings[keyName] || "";
    if (!legacyKey) continue;
    if (!getLocalAIKey(provider)) setLocalAIKey(provider, legacyKey);
    cleared[keyName] = "";
  }
  if (Object.keys(cleared).length === 0) return settings;
  try {
    await api.post('/api/settings', cleared);
    return { ...settings, ...cleared };
  } catch (e) {
    console.warn('[ai-settings-migration] legacy AI key cleanup failed', e);
    return settings;
  }
}
