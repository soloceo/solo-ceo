import React, { useState, useEffect } from 'react';
import { Bot, Eye, EyeOff, Check, X, Loader2, ExternalLink, Save, Trash2 } from 'lucide-react';
import { useT } from '../../i18n/context';
import { testApiKey, type AIProvider } from '../../lib/ai-client';

interface AISectionProps {
  settings: Record<string, string> | null;
  save: (key: string, value: string) => Promise<void>;
}

const PROVIDERS: { id: AIProvider; label: string; model: string; keyName: string; applyUrl: string }[] = [
  { id: "gemini", label: "Gemini", model: "gemini-2.5-flash", keyName: "gemini_api_key", applyUrl: "https://aistudio.google.com/apikey" },
  { id: "claude", label: "Claude", model: "claude-sonnet-4-6", keyName: "claude_api_key", applyUrl: "https://console.anthropic.com/settings/keys" },
  { id: "openai", label: "OpenAI", model: "gpt-4.1-mini", keyName: "openai_api_key", applyUrl: "https://platform.openai.com/api-keys" },
];

export default function AISection({ settings, save }: AISectionProps) {
  const { t } = useT();
  const activeProvider = (settings?.ai_provider || "") as AIProvider | "";
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, boolean | null>>({});
  const [localKeys, setLocalKeys] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  // Sync from settings on load
  useEffect(() => {
    if (!settings) return;
    const keys: Record<string, string> = {};
    for (const p of PROVIDERS) {
      keys[p.keyName] = settings[p.keyName] || "";
    }
    setLocalKeys(keys);
  }, [settings]);

  const handleSave = async (keyName: string) => {
    await save(keyName, localKeys[keyName] || "");
    setDirty(p => ({ ...p, [keyName]: false }));
  };

  const handleTest = async (provider: AIProvider, keyName: string) => {
    // Save first, then test
    await handleSave(keyName);
    const key = localKeys[keyName];
    if (!key) return;
    setTesting(provider);
    setTestResult(p => ({ ...p, [provider]: null }));
    const ok = await testApiKey(provider, key);
    setTestResult(p => ({ ...p, [provider]: ok }));
    setTesting(null);
  };

  const handleSelect = async (provider: AIProvider) => {
    await save("ai_provider", provider);
  };

  return (
    <section>
      <h3 className="section-label mb-3">{t("settings.ai" as any)}</h3>
      <div className="card overflow-hidden divide-y divide-[var(--color-line-secondary)]">
        {PROVIDERS.map(({ id, label, model, keyName, applyUrl }) => {
          const currentKey = localKeys[keyName] || "";
          const isActive = activeProvider === id;
          const visible = !!showKey[id];
          const result = testResult[id];
          const isDirty = !!dirty[keyName];

          return (
            <div key={id} className="px-4 py-3">
              {/* Header: provider name + model + apply link + select */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Bot size={16} style={{ color: isActive ? "var(--color-accent)" : "var(--color-text-tertiary)" }} />
                  <span className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                    {label}
                  </span>
                  <span className="text-[12px]" style={{ color: "var(--color-text-quaternary)" }}>{model}</span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[12px] transition-colors hover:opacity-80"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    <ExternalLink size={11} />
                    {t("settings.ai.getKey" as any)}
                  </a>
                  <button
                    onClick={() => handleSelect(id)}
                    className="text-[12px] px-2 py-0.5 rounded-[var(--radius-4)] transition-colors"
                    style={isActive ? {
                      background: "var(--color-accent)", color: "var(--color-brand-text)",
                      fontWeight: "var(--font-weight-medium)",
                    } as React.CSSProperties : {
                      background: "var(--color-bg-tertiary)", color: "var(--color-text-tertiary)",
                      fontWeight: "var(--font-weight-medium)",
                    } as React.CSSProperties}
                  >
                    {isActive ? t("settings.ai.active" as any) : t("settings.ai.select" as any)}
                  </button>
                </div>
              </div>

              {/* Key input + save + test */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={visible ? "text" : "password"}
                    value={currentKey}
                    onChange={e => {
                      setLocalKeys(p => ({ ...p, [keyName]: e.target.value }));
                      setDirty(p => ({ ...p, [keyName]: true }));
                    }}
                    placeholder="API Key"
                    className="input-base w-full px-3 py-2 pr-9 text-[14px]"
                    autoComplete="off"
                  />
                  <button
                    onClick={() => setShowKey(p => ({ ...p, [id]: !p[id] }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 btn-icon-sm"
                  >
                    {visible ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {isDirty && (
                  <button
                    onClick={() => handleSave(keyName)}
                    className="btn-primary compact text-[13px] shrink-0 gap-1"
                  >
                    <Save size={12} />
                    {t("settings.ai.save" as any)}
                  </button>
                )}
                <button
                  onClick={() => handleTest(id, keyName)}
                  disabled={!currentKey || testing === id}
                  className="btn-ghost compact text-[13px] shrink-0 disabled:opacity-40"
                >
                  {testing === id ? <Loader2 size={14} className="animate-spin" /> : t("settings.ai.test" as any)}
                </button>
                {currentKey && !isDirty && (
                  <button
                    onClick={async () => {
                      setLocalKeys(p => ({ ...p, [keyName]: "" }));
                      await save(keyName, "");
                      setTestResult(p => ({ ...p, [id]: null }));
                      if (activeProvider === id) await save("ai_provider", "");
                    }}
                    className="btn-icon-sm shrink-0"
                    aria-label="Clear API key"
                    title={t("settings.ai.clear" as any)}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                {result !== undefined && result !== null && (
                  <span className="shrink-0">
                    {result
                      ? <Check size={14} style={{ color: "var(--color-success)" }} />
                      : <X size={14} style={{ color: "var(--color-danger)" }} />
                    }
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
