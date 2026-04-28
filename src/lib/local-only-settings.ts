export const LOCAL_ONLY_SETTING_KEYS = new Set([
  'gemini_api_key',
  'claude_api_key',
  'openai_api_key',
]);

export function sanitizeSettingValue(key: string, value: unknown): string {
  return LOCAL_ONLY_SETTING_KEYS.has(key) ? '' : String(value ?? '');
}
