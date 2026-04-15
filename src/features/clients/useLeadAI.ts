import { useState, useCallback, useEffect, useRef } from "react";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useUIStore } from "../../store/useUIStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useT } from "../../i18n/context";
import { generateOutreach, analyzeLeadQuality, getAIConfig, type AIProvider, type LeadAnalysis } from "../../lib/ai-client";

export type { LeadAnalysis };

interface LeadLike {
  id: number;
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
  const businessDescription = useSettingsStore((s) => s.businessDescription);

  const [aiTone, setAiTone] = useState<"formal" | "friendly" | "direct">("friendly");
  const [aiLang, setAiLang] = useState<"zh" | "en">(lang as "zh" | "en");
  const [aiDraft, setAiDraft] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<LeadAnalysis | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [leadScores, setLeadScores] = useState<Record<number, LeadAnalysis>>({});
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const requireAiConfig = useCallback(() => {
    const config = getAIConfig(appSettings);
    if (!config) {
      showToast(t("money.ai.noKey"), 5000, { label: t("common.goSettings"), fn: () => setActiveTab("settings") });
      return null;
    }
    return config;
  }, [appSettings, showToast, t, setActiveTab]);

  const handleGenerateOutreach = useCallback(async (lead: LeadLike) => {
    const config = requireAiConfig();
    if (!config) return;
    if (!lead.name.trim()) { showToast(t("pipeline.ai.needName")); return; }
    setAiGenerating(true);
    try {
      const draft = await generateOutreach(lead, aiTone, aiLang, config.provider, config.apiKey, businessDescription);
      setAiDraft(draft);
      showToast(`✓ ${t("pipeline.ai.generated")}`);
    } catch (e) {
      console.warn('[useLeadAI] generateOutreach', e);
      showToast(t("pipeline.ai.genFailed"));
    } finally {
      setAiGenerating(false);
    }
  }, [requireAiConfig, aiTone, aiLang, showToast, t, businessDescription]);

  const handleAnalyzeLead = useCallback(async (lead: LeadLike) => {
    const config = requireAiConfig();
    if (!config) return;
    if (!lead.name.trim()) { showToast(t("pipeline.ai.needName")); return; }
    setAiAnalyzing(true);
    try {
      const result = await analyzeLeadQuality(lead, lang, config.provider, config.apiKey, businessDescription);
      setAiAnalysis(result);
    } catch (e) {
      console.warn('[useLeadAI] analyzeLead', e);
      showToast(t("pipeline.ai.genFailed"));
    } finally {
      setAiAnalyzing(false);
    }
  }, [requireAiConfig, lang, showToast, t, businessDescription]);

  const handleBatchAnalyze = useCallback(async (allLeads: LeadLike[]) => {
    const config = requireAiConfig();
    if (!config) return;
    if (!allLeads.length) return;
    setBatchAnalyzing(true);
    const results: Record<number, LeadAnalysis> = {};
    let failed = 0;
    for (const lead of allLeads) {
      if (!mountedRef.current) break; // stop if component unmounted
      try {
        const result = await analyzeLeadQuality(lead, lang, config.provider, config.apiKey, businessDescription);
        results[lead.id] = result;
      } catch (e) {
        failed++;
        console.warn('[useLeadAI] batch analyze skip', lead.id, e);
      }
    }
    if (mountedRef.current) {
      setLeadScores(prev => ({ ...prev, ...results }));
      setBatchAnalyzing(false);
      showToast(t("pipeline.ai.analyzed").replace("{count}", String(Object.keys(results).length)));
    }
  }, [requireAiConfig, lang, showToast, t, businessDescription]);

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
