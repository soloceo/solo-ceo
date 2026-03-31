import { useState, useCallback } from "react";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useUIStore } from "../../store/useUIStore";
import { useT } from "../../i18n/context";
import { generateOutreach, analyzeLeadQuality, AI_KEY_MAP, type AIProvider, type LeadAnalysis } from "../../lib/ai-client";

export type { LeadAnalysis };

interface LeadLike {
  name: string;
  industry?: string;
  needs?: string;
  website?: string;
  [key: string]: unknown;
}

/**
 * Encapsulates all AI-related state and actions for the leads board:
 * outreach generation, single lead analysis, and batch analysis.
 */
export function useLeadAI(lang: string) {
  const { t } = useT();
  const showToast = useUIStore((s) => s.showToast);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const { settings: appSettings } = useAppSettings();

  const [aiTone, setAiTone] = useState<"formal" | "friendly" | "direct">("friendly");
  const [aiLang, setAiLang] = useState<"zh" | "en">(lang as "zh" | "en");
  const [aiDraft, setAiDraft] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<LeadAnalysis | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [leadScores, setLeadScores] = useState<Record<number, LeadAnalysis>>({});
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);

  const getAiConfig = useCallback(() => {
    const provider = appSettings?.ai_provider as AIProvider | undefined;
    const apiKey = provider ? appSettings?.[AI_KEY_MAP[provider]] : undefined;
    return { provider, apiKey };
  }, [appSettings]);

  const requireAiConfig = useCallback(() => {
    const config = getAiConfig();
    if (!config.provider || !config.apiKey) {
      showToast(t("money.ai.noKey" as any), 5000, { label: t("common.goSettings" as any), fn: () => setActiveTab("settings" as any) });
      return null;
    }
    return config as { provider: AIProvider; apiKey: string };
  }, [getAiConfig, showToast, t, setActiveTab]);

  const handleGenerateOutreach = useCallback(async (lead: LeadLike) => {
    const config = requireAiConfig();
    if (!config) return;
    if (!lead.name.trim()) { showToast(t("pipeline.ai.needName" as any)); return; }
    setAiGenerating(true);
    try {
      const draft = await generateOutreach(lead, aiTone, aiLang, config.provider, config.apiKey);
      setAiDraft(draft);
      showToast(`✓ ${t("pipeline.ai.generated" as any)}`);
    } catch {
      showToast(t("pipeline.ai.genFailed" as any));
    } finally {
      setAiGenerating(false);
    }
  }, [requireAiConfig, aiTone, aiLang, showToast, t]);

  const handleAnalyzeLead = useCallback(async (lead: LeadLike) => {
    const config = requireAiConfig();
    if (!config) return;
    if (!lead.name.trim()) { showToast(t("pipeline.ai.needName" as any)); return; }
    setAiAnalyzing(true);
    try {
      const result = await analyzeLeadQuality(lead, lang, config.provider, config.apiKey);
      setAiAnalysis(result);
    } catch {
      showToast(t("pipeline.ai.genFailed" as any));
    } finally {
      setAiAnalyzing(false);
    }
  }, [requireAiConfig, lang, showToast, t]);

  const handleBatchAnalyze = useCallback(async (allLeads: LeadLike[]) => {
    const config = requireAiConfig();
    if (!config) return;
    if (!allLeads.length) return;
    setBatchAnalyzing(true);
    const results: Record<number, LeadAnalysis> = {};
    for (const lead of allLeads) {
      try {
        const result = await analyzeLeadQuality(lead, lang, config.provider, config.apiKey);
        results[(lead as any).id] = result;
      } catch { /* skip failed */ }
    }
    setLeadScores(prev => ({ ...prev, ...results }));
    setBatchAnalyzing(false);
    showToast(t("pipeline.ai.analyzed" as any).replace("{count}", String(Object.keys(results).length)));
  }, [requireAiConfig, lang, showToast, t]);

  const resetForPanel = useCallback((existingDraft?: string) => {
    setAiDraft(existingDraft || "");
    setAiAnalysis(null);
  }, []);

  return {
    // State
    aiTone, aiLang, aiDraft, aiGenerating, aiAnalysis, aiAnalyzing,
    leadScores, batchAnalyzing,
    // Setters
    setAiTone, setAiLang, setAiDraft,
    // Actions
    handleGenerateOutreach, handleAnalyzeLead, handleBatchAnalyze,
    resetForPanel,
  };
}
