import React, { useState } from 'react';
import { Bot, Eye, EyeOff, Check, X, Loader2 } from 'lucide-react';
import { useT } from '../../i18n/context';
import { testApiKey, type AIProvider } from '../../lib/ai-client';

interface AISectionProps {
  settings: Record<string, string> | null;
  save: (key: string, value: string) => Promise<void>;
}

const PROVIDERS: { id: AIProvider; label: string; model: string; keyName: string }[] = [
  { id: "gemini", label: "Gemini", model: "gemini-2.5-flash", keyName: "gemini_api_key" },
  { id: "claude", label: "Claude", model: "claude-sonnet-4-6", keyName: "claude_api_key" },
  { id: "openai", label: "OpenAI", model: "gpt-4.1-mini", keyName: "openai_api_key" },
];

export default function AISection({ settings, save }: AISectionProps) {
  const { t } = useT();
  const activeProvider = (settings?.ai_provider || "") as AIProvider | "";
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, boolean | null>>({});

  const handleTest = async (provider: AIProvider, keyName: string) => {
    const key = settings?.[keyName];
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
        {PROVIDERS.map(({ id, label, model, keyName }) => {
          const currentKey = settings?.[keyName] || "";
          const isActive = activeProvider === id;
          const visible = !!showKey[id];
          const result = testResult[id];

          return (
            <div key={id} className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Bot size={16} style={{ color: isActive ? "var(--color-accent)" : "var(--color-text-tertiary)" }} />
                  <span className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                    {label}
                  </span>
                  <span className="text-[12px]" style={{ color: "var(--color-text-quaternary)" }}>{model}</span>
                </div>
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
                  {isActive ? (t("settings.ai.active" as any)) : (t("settings.ai.select" as any))}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={visible ? "text" : "password"}
                    value={currentKey}
                    onChange={async (e) => { await save(keyName, e.target.value); }}
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
                <button
                  onClick={() => handleTest(id, keyName)}
                  disabled={!currentKey || testing === id}
                  className="btn-ghost compact text-[13px] shrink-0 disabled:opacity-40"
                >
                  {testing === id ? <Loader2 size={14} className="animate-spin" /> : t("settings.ai.test" as any)}
                </button>
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
