import React, { useState, useEffect } from 'react';
import { Bot, Eye, EyeOff, Check, X, Loader2, ExternalLink, Save, Trash2, Monitor, ChevronDown } from 'lucide-react';
import { useT } from '../../i18n/context';
import {
  testApiKey, fetchOllamaModels, fetchLMStudioModels,
  getDeviceAIProvider, setDeviceAIProvider,
  getOllamaConfig, setOllamaConfig,
  getLMStudioConfig, setLMStudioConfig,
  type AIProvider,
} from '../../lib/ai-client';

interface AISectionProps {
  settings: Record<string, string> | null;
  save: (key: string, value: string) => Promise<void>;
}

const CLOUD_PROVIDERS: { id: AIProvider; label: string; model: string; keyName: string; applyUrl: string }[] = [
  { id: "gemini", label: "Gemini", model: "gemini-2.5-flash", keyName: "gemini_api_key", applyUrl: "https://aistudio.google.com/apikey" },
  { id: "claude", label: "Claude", model: "claude-sonnet-4-6", keyName: "claude_api_key", applyUrl: "https://console.anthropic.com/settings/keys" },
  { id: "openai", label: "OpenAI", model: "gpt-4.1-mini", keyName: "openai_api_key", applyUrl: "https://platform.openai.com/api-keys" },
];

export default function AISection({ settings, save }: AISectionProps) {
  const { t } = useT();

  // Device-level provider (localStorage)
  const [activeProvider, setActiveProvider] = useState<AIProvider | "">(getDeviceAIProvider);

  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, boolean | null>>({});
  const [localKeys, setLocalKeys] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  // Ollama state
  const [ollamaUrl, setOllamaUrl] = useState(() => getOllamaConfig().url);
  const [ollamaModel, setOllamaModel] = useState(() => getOllamaConfig().model);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);

  // LM Studio state
  const [lmsUrl, setLmsUrl] = useState(() => getLMStudioConfig().url);
  const [lmsModel, setLmsModel] = useState(() => getLMStudioConfig().model);
  const [lmsModels, setLmsModels] = useState<string[]>([]);
  const [lmsLoading, setLmsLoading] = useState(false);

  // Sync cloud keys from settings
  useEffect(() => {
    if (!settings) return;
    const keys: Record<string, string> = {};
    for (const p of CLOUD_PROVIDERS) {
      keys[p.keyName] = settings[p.keyName] || "";
    }
    setLocalKeys(keys);
  }, [settings]);

  // Try to discover Ollama models on mount
  useEffect(() => {
    fetchOllamaModels(ollamaUrl).then(m => { if (m.length) setOllamaModels(m); });
  }, [ollamaUrl]);

  // Try to discover LM Studio models on mount
  useEffect(() => {
    fetchLMStudioModels(lmsUrl).then(m => { if (m.length) setLmsModels(m); });
  }, [lmsUrl]);

  const selectProvider = (provider: AIProvider | "") => {
    setActiveProvider(provider);
    setDeviceAIProvider(provider);
  };

  const handleSave = async (keyName: string) => {
    const value = localKeys[keyName] || "";
    await save(keyName, value);
    setDirty(p => ({ ...p, [keyName]: false }));
    if (value && !activeProvider) {
      const matchedProvider = CLOUD_PROVIDERS.find(p => p.keyName === keyName);
      if (matchedProvider) selectProvider(matchedProvider.id);
    }
  };

  const handleTest = async (provider: AIProvider, keyName: string) => {
    await handleSave(keyName);
    const key = localKeys[keyName];
    if (!key) return;
    setTesting(provider);
    setTestResult(p => ({ ...p, [provider]: null }));
    const ok = await testApiKey(provider, key);
    setTestResult(p => ({ ...p, [provider]: ok }));
    setTesting(null);
  };

  const handleTestOllama = async () => {
    setTesting("ollama");
    setTestResult(p => ({ ...p, ollama: null }));
    setOllamaConfig(ollamaUrl, ollamaModel);
    const models = await fetchOllamaModels(ollamaUrl);
    setOllamaModels(models);
    setTestResult(p => ({ ...p, ollama: models.length > 0 }));
    setTesting(null);
  };

  const handleSelectOllama = () => {
    setOllamaConfig(ollamaUrl, ollamaModel);
    selectProvider("ollama");
  };

  const handleTestLMS = async () => {
    setTesting("lmstudio");
    setTestResult(p => ({ ...p, lmstudio: null }));
    setLMStudioConfig(lmsUrl, lmsModel);
    const models = await fetchLMStudioModels(lmsUrl);
    setLmsModels(models);
    setTestResult(p => ({ ...p, lmstudio: models.length > 0 }));
    setTesting(null);
  };

  const handleSelectLMS = () => {
    setLMStudioConfig(lmsUrl, lmsModel);
    selectProvider("lmstudio");
  };

  return (
    <section id="settings-ai">
      <h3 className="section-label mb-3">{t("settings.ai")}</h3>
      <div className="card overflow-hidden divide-y divide-[var(--color-line-secondary)]">
        {/* ── Cloud providers ── */}
        {CLOUD_PROVIDERS.map(({ id, label, model, keyName, applyUrl }) => {
          const currentKey = localKeys[keyName] || "";
          const isActive = activeProvider === id;
          const visible = !!showKey[id];
          const result = testResult[id];
          const isDirty = !!dirty[keyName];

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
                <div className="flex items-center gap-2">
                  <a
                    href={applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[12px] transition-colors hover:opacity-80"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    <ExternalLink size={11} />
                    {t("settings.ai.getKey")}
                  </a>
                  <button
                    onClick={() => selectProvider(isActive ? "" : id)}
                    className="text-[12px] px-2 py-0.5 rounded-[var(--radius-4)] transition-colors"
                    style={isActive ? {
                      background: "var(--color-accent)", color: "var(--color-brand-text)",
                      fontWeight: "var(--font-weight-medium)",
                    } as React.CSSProperties : {
                      background: "var(--color-bg-tertiary)", color: "var(--color-text-tertiary)",
                      fontWeight: "var(--font-weight-medium)",
                    } as React.CSSProperties}
                  >
                    {isActive ? t("settings.ai.disconnect") : t("settings.ai.connect")}
                  </button>
                </div>
              </div>

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
                    {t("settings.ai.save")}
                  </button>
                )}
                <button
                  onClick={() => handleTest(id, keyName)}
                  disabled={!currentKey || testing === id}
                  className="btn-ghost compact text-[13px] shrink-0 disabled:opacity-40"
                >
                  {testing === id ? <Loader2 size={14} className="animate-spin" /> : t("settings.ai.test")}
                </button>
                {currentKey && !isDirty && (
                  <button
                    onClick={async () => {
                      setLocalKeys(p => ({ ...p, [keyName]: "" }));
                      await save(keyName, "");
                      setTestResult(p => ({ ...p, [id]: null }));
                      if (activeProvider === id) selectProvider("");
                    }}
                    className="btn-icon-sm shrink-0"
                    aria-label="Clear API key"
                    title={t("settings.ai.clear")}
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

        {/* ── Ollama (local) ── */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Monitor size={16} style={{ color: activeProvider === "ollama" ? "var(--color-accent)" : "var(--color-text-tertiary)" }} />
              <span className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                Ollama
              </span>
              <span className="text-[12px]" style={{ color: "var(--color-text-quaternary)" }}>
                {t("settings.ai.local")}
              </span>
            </div>
            <button
              onClick={() => activeProvider === "ollama" ? selectProvider("") : handleSelectOllama()}
              className="text-[12px] px-2 py-0.5 rounded-[var(--radius-4)] transition-colors"
              style={activeProvider === "ollama" ? {
                background: "var(--color-accent)", color: "var(--color-brand-text)",
                fontWeight: "var(--font-weight-medium)",
              } as React.CSSProperties : {
                background: "var(--color-bg-tertiary)", color: "var(--color-text-tertiary)",
                fontWeight: "var(--font-weight-medium)",
              } as React.CSSProperties}
            >
              {activeProvider === "ollama" ? t("settings.ai.disconnect") : t("settings.ai.connect")}
            </button>
          </div>

          {/* URL input */}
          <div className="flex items-center gap-2 mb-2">
            <label className="text-[12px] shrink-0" style={{ color: "var(--color-text-tertiary)", width: 64 }}>
              {t("settings.ai.localUrl")}
            </label>
            <input
              type="text"
              value={ollamaUrl}
              onChange={e => setOllamaUrl(e.target.value)}
              placeholder="http://localhost:11434"
              className="input-base flex-1 px-3 py-2 text-[14px]"
            />
          </div>

          {/* Model selector + test */}
          <div className="flex items-center gap-2 mb-1">
            <label className="text-[12px] shrink-0" style={{ color: "var(--color-text-tertiary)", width: 64 }}>
              {t("settings.ai.localModel")}
            </label>
            <div className="relative flex-1">
              {ollamaModels.length > 0 ? (
                <div className="relative">
                  <select
                    value={ollamaModel}
                    onChange={e => {
                      setOllamaModel(e.target.value);
                      setOllamaConfig(ollamaUrl, e.target.value);
                    }}
                    className="input-base w-full px-3 py-2 pr-8 text-[14px] appearance-none"
                  >
                    {ollamaModels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-text-tertiary)" }} />
                </div>
              ) : (
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={e => setOllamaModel(e.target.value)}
                  placeholder="gemma3"
                  className="input-base w-full px-3 py-2 text-[14px]"
                />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2" style={{ paddingLeft: 64 }}>
            <button
              onClick={() => {
                setOllamaLoading(true);
                fetchOllamaModels(ollamaUrl).then(m => {
                  setOllamaModels(m);
                  setOllamaLoading(false);
                  if (m.length && !m.includes(ollamaModel)) {
                    setOllamaModel(m[0]);
                    setOllamaConfig(ollamaUrl, m[0]);
                  }
                }).catch(() => { setOllamaLoading(false); });
              }}
              disabled={ollamaLoading}
              className="btn-ghost compact text-[13px] shrink-0 disabled:opacity-40"
            >
              {ollamaLoading ? <Loader2 size={14} className="animate-spin" /> : t("settings.ai.localRefresh")}
            </button>
            <button
              onClick={handleTestOllama}
              disabled={testing === "ollama"}
              className="btn-ghost compact text-[13px] shrink-0 disabled:opacity-40"
            >
              {testing === "ollama" ? <Loader2 size={14} className="animate-spin" /> : t("settings.ai.test")}
            </button>
            {testResult.ollama !== undefined && testResult.ollama !== null && (
              <span className="shrink-0">
                {testResult.ollama
                  ? <Check size={14} style={{ color: "var(--color-success)" }} />
                  : <X size={14} style={{ color: "var(--color-danger)" }} />
                }
              </span>
            )}
          </div>

          {/* Status hint */}
          {ollamaModels.length > 0 && (
            <p className="text-[12px] mt-1.5" style={{ color: "var(--color-text-quaternary)", paddingLeft: 64 }}>
              {t("settings.ai.localConnected").replace("{count}", String(ollamaModels.length))}
            </p>
          )}
        </div>

        {/* ── LM Studio (local) ── */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Monitor size={16} style={{ color: activeProvider === "lmstudio" ? "var(--color-accent)" : "var(--color-text-tertiary)" }} />
              <span className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                LM Studio
              </span>
              <span className="text-[12px]" style={{ color: "var(--color-text-quaternary)" }}>
                {t("settings.ai.local")}
              </span>
            </div>
            <button
              onClick={() => activeProvider === "lmstudio" ? selectProvider("") : handleSelectLMS()}
              className="text-[12px] px-2 py-0.5 rounded-[var(--radius-4)] transition-colors"
              style={activeProvider === "lmstudio" ? {
                background: "var(--color-accent)", color: "var(--color-brand-text)",
                fontWeight: "var(--font-weight-medium)",
              } as React.CSSProperties : {
                background: "var(--color-bg-tertiary)", color: "var(--color-text-tertiary)",
                fontWeight: "var(--font-weight-medium)",
              } as React.CSSProperties}
            >
              {activeProvider === "lmstudio" ? t("settings.ai.disconnect") : t("settings.ai.connect")}
            </button>
          </div>

          {/* URL input */}
          <div className="flex items-center gap-2 mb-2">
            <label className="text-[12px] shrink-0" style={{ color: "var(--color-text-tertiary)", width: 64 }}>
              {t("settings.ai.localUrl")}
            </label>
            <input
              type="text"
              value={lmsUrl}
              onChange={e => setLmsUrl(e.target.value)}
              placeholder="http://localhost:1234"
              className="input-base flex-1 px-3 py-2 text-[14px]"
            />
          </div>

          {/* Model selector + test */}
          <div className="flex items-center gap-2 mb-1">
            <label className="text-[12px] shrink-0" style={{ color: "var(--color-text-tertiary)", width: 64 }}>
              {t("settings.ai.localModel")}
            </label>
            <div className="relative flex-1">
              {lmsModels.length > 0 ? (
                <div className="relative">
                  <select
                    value={lmsModel}
                    onChange={e => {
                      setLmsModel(e.target.value);
                      setLMStudioConfig(lmsUrl, e.target.value);
                    }}
                    className="input-base w-full px-3 py-2 pr-8 text-[14px] appearance-none"
                  >
                    {lmsModels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-text-tertiary)" }} />
                </div>
              ) : (
                <input
                  type="text"
                  value={lmsModel}
                  onChange={e => setLmsModel(e.target.value)}
                  placeholder="model-name"
                  className="input-base w-full px-3 py-2 text-[14px]"
                />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2" style={{ paddingLeft: 64 }}>
            <button
              onClick={() => {
                setLmsLoading(true);
                fetchLMStudioModels(lmsUrl).then(m => {
                  setLmsModels(m);
                  setLmsLoading(false);
                  if (m.length && !m.includes(lmsModel)) {
                    setLmsModel(m[0]);
                    setLMStudioConfig(lmsUrl, m[0]);
                  }
                }).catch(() => { setLmsLoading(false); });
              }}
              disabled={lmsLoading}
              className="btn-ghost compact text-[13px] shrink-0 disabled:opacity-40"
            >
              {lmsLoading ? <Loader2 size={14} className="animate-spin" /> : t("settings.ai.localRefresh")}
            </button>
            <button
              onClick={handleTestLMS}
              disabled={testing === "lmstudio"}
              className="btn-ghost compact text-[13px] shrink-0 disabled:opacity-40"
            >
              {testing === "lmstudio" ? <Loader2 size={14} className="animate-spin" /> : t("settings.ai.test")}
            </button>
            {testResult.lmstudio !== undefined && testResult.lmstudio !== null && (
              <span className="shrink-0">
                {testResult.lmstudio
                  ? <Check size={14} style={{ color: "var(--color-success)" }} />
                  : <X size={14} style={{ color: "var(--color-danger)" }} />
                }
              </span>
            )}
          </div>

          {/* Status hint */}
          {lmsModels.length > 0 && (
            <p className="text-[12px] mt-1.5" style={{ color: "var(--color-text-quaternary)", paddingLeft: 64 }}>
              {t("settings.ai.localConnected").replace("{count}", String(lmsModels.length))}
            </p>
          )}
        </div>

      </div>
    </section>
  );
}
