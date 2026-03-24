import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles, Loader2, Copy, Check, Linkedin, FileText, Send, Instagram,
  TrendingUp, Mail, Megaphone, MessageSquare, BookOpen, Image as ImageIcon,
  Download, PenTool, Save, Trash2, RotateCcw, AlertCircle, X,
  PanelRightClose, Music, Youtube,
} from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import { useT } from '../i18n/context';
import { useRealtimeRefresh } from "../hooks/useRealtimeRefresh";
import { useIsMobile } from "../hooks/useIsMobile";
import { useToast } from "../hooks/useToast";

/* ── Helpers ─────────────────────────────────────────────────────── */
const getAIClient = (customKey?: string) => {
  const storedKey = customKey || localStorage.getItem("GEMINI_API_KEY");
  const apiKey = storedKey || import.meta.env.VITE_GEMINI_API_KEY;
  return new GoogleGenAI({ apiKey });
};

// For AI prompts — always Chinese (best AI performance)
const getPlatformLabel = (platform: string) => {
  const labels: Record<string, string> = {
    x: "X / Twitter", linkedin: "LinkedIn", newsletter: "Newsletter",
    cold_email: "Cold Email", instagram: "Instagram", wechat: "微信朋友圈",
    xiaohongshu: "小红书", blog: "Blog", tiktok: "TikTok / 抖音",
    youtube_shorts: "YouTube Shorts",
  };
  return labels[platform] || platform;
};

// For UI display — bilingual
const getPlatformDisplayLabel = (platform: string, t: (k: any) => string) => {
  const keyMap: Record<string, string> = {
    x: "create.platform.twitter", linkedin: "create.platform.linkedin",
    newsletter: "create.platform.newsletter", cold_email: "create.platform.coldEmail",
    instagram: "create.platform.instagram", wechat: "create.platform.wechat",
    xiaohongshu: "create.platform.xiaohongshu", blog: "create.platform.blog",
    tiktok: "create.platform.tiktok", youtube_shorts: "create.platform.youtubeShorts",
  };
  const key = keyMap[platform];
  return key ? t(key as any) : platform;
};

const cleanGeneratedText = (text: string, platform: string) => {
  let c = (text || "")
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ""))
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^[-*]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (platform === "newsletter" || platform === "cold_email")
    c = c.replace(/^(主题|Subject)\s*[:：]\s*/im, "主题：");
  if (platform === "wechat")
    c = c.replace(/^标题[:：].*$/gim, "").replace(/^文案[:：]\s*/gim, "").replace(/\n{3,}/g, "\n\n").trim();
  if (platform === "xiaohongshu")
    c = c.replace(/^标题[:：]\s*/im, "").replace(/\n{3,}/g, "\n\n").trim();
  if (platform === "blog")
    c = c.replace(/^大纲[:：]\s*/gim, "").replace(/\n{3,}/g, "\n\n").trim();
  return c;
};

const renderFormattedContent = (content: string, platform: string, subjectLabel?: string) => {
  const paragraphs = content.split(/\n\n+/);

  const formatInline = (text: string) => {
    const parts: (string | React.ReactNode)[] = [];
    const regex = /((?:^|\s)(#[\w\u4e00-\u9fff\u3400-\u4dbf]+))|((?:^|\s)(@[\w\u4e00-\u9fff]+))/g;
    let lastIndex = 0;
    let match;
    let k = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
      if (match[1]) parts.push(<span key={`t-${k++}`} style={{ color: "var(--accent)" }} className="font-medium">{match[1]}</span>);
      else if (match[3]) parts.push(<span key={`a-${k++}`} className="font-medium text-blue-500">{match[3]}</span>);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts.length > 0 ? parts : [text];
  };

  return (
    <div className="space-y-2.5">
      {paragraphs.map((para, i) => {
        const trimmed = para.trim();
        if (!trimmed) return null;

        if (i === 0 && (platform === "newsletter" || platform === "cold_email") && /^(主题|Subject)\s*[:：]/i.test(trimmed)) {
          const subjectText = trimmed.replace(/^(主题|Subject)\s*[:：]\s*/i, "");
          return (
            <div key={i} className="rounded-lg px-3 py-2" style={{ background: "var(--accent-light)" }}>
              <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--accent)" }}>{subjectLabel || (platform === "cold_email" ? "Subject" : "主题行")}</div>
              <div className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{subjectText}</div>
            </div>
          );
        }

        if (i === 0 && platform === "xiaohongshu")
          return <p key={i} className="text-[15px] font-semibold leading-snug" style={{ color: "var(--text)" }}>{formatInline(trimmed)}</p>;

        const lines = trimmed.split("\n");
        const isList = lines.every((l) => /^[•\-]\s/.test(l.trim()) || /^\d+[.、]\s/.test(l.trim()));
        if (isList) {
          return (
            <ul key={i} className="space-y-1 pl-1">
              {lines.map((line, j) => (
                <li key={j} className="flex gap-2 text-[13px] leading-relaxed">
                  <span className="shrink-0 mt-0.5" style={{ color: "var(--text-secondary)" }}>{/^\d/.test(line.trim()) ? line.trim().match(/^\d+[.、]/)?.[0] : "•"}</span>
                  <span>{formatInline(line.trim().replace(/^[•\-]\s+/, "").replace(/^\d+[.、]\s*/, ""))}</span>
                </li>
              ))}
            </ul>
          );
        }

        return <p key={i} className="text-[13px] leading-relaxed">{formatInline(trimmed)}</p>;
      })}
    </div>
  );
};

/* ── Types ────────────────────────────────────────────────────────── */
type MessageType = "user" | "copy" | "visual" | "image" | "system";

interface ChatMessage {
  id: string;
  type: MessageType;
  content: string;
  platform?: string;
  timestamp: Date;
}

const PLATFORMS = [
  { id: "x", icon: <span className="font-bold text-[13px] leading-none">𝕏</span>, labelKey: "create.platform.twitter" },
  { id: "linkedin", icon: <Linkedin size={16} />, labelKey: "create.platform.linkedin" },
  { id: "newsletter", icon: <Mail size={16} />, labelKey: "create.platform.newsletter" },
  { id: "cold_email", icon: <Megaphone size={16} />, labelKey: "create.platform.coldEmail" },
  { id: "instagram", icon: <Instagram size={16} />, labelKey: "create.platform.instagram" },
  { id: "wechat", icon: <MessageSquare size={16} />, labelKey: "create.platform.wechat" },
  { id: "xiaohongshu", icon: <BookOpen size={16} />, labelKey: "create.platform.xiaohongshu" },
  { id: "blog", icon: <FileText size={16} />, labelKey: "create.platform.blog" },
  { id: "tiktok", icon: <Music size={16} />, labelKey: "create.platform.tiktok" },
  { id: "youtube_shorts", icon: <Youtube size={16} />, labelKey: "create.platform.youtubeShorts" },
];

/* ── Prompt builders ─────────────────────────────────────────────── */
const buildCopyPrompt = ({ platform, language, topic, useTrending }: { platform: string; language: string; topic: string; useTrending: boolean }) => {
  const langText = language === "en" ? "English" : "中文";
  const base = `你是一位顶级销售文案专家、品牌策略顾问和增长型内容操盘手。
你的任务不是写"好看"的文字，而是写出能够让潜在客户产生信任、兴趣和咨询动作的内容。

写作原则：
1. 用真正懂销售的人会写的方式写，不说空话，不堆概念。
2. 先抓痛点，再给判断，再给例子，再轻轻推动行动。
3. 语气要像有实战经验的创始人/设计顾问，不像 AI，不像公众号腔，不像培训老师。
4. 尽量写得自然、可直接复制发布。
5. 除非我明确要求，否则不要输出 Markdown 标记。
6. 如果适合，用真实感的小例子或微场景增强说服力。
7. 最终目的是吸引需要专业品牌设计、平面设计外包、设计订阅服务的企业创始人或市场负责人。`;

  const platformGuide = `平台要求：
- x：thread，句子短、观点清晰、带钩子。
- linkedin：专业长文，商业洞察、案例感。
- newsletter：完整邮件，包含主题、正文、CTA。
- cold_email：短而锋利的开发信。
- instagram：配图文案，视觉感、节奏感、标签。
- wechat：80-220 字朋友圈，自然、有观点、有现场感。
- xiaohongshu：笔记文案，标题抓人，正文分点，标签。
- blog：博客正文草稿。
- tiktok：15-60秒短视频脚本，开头3秒抓注意力，节奏快，口语化，带钩子。
- youtube_shorts：60秒以内竖屏短视频脚本，开头即高潮，信息密度高，留悬念。`;

  const formatRules = `输出格式要求：
- 只输出最终可用正文。
- 不要用 markdown 符号。
- 段落间空一行。
- 列表用 "- " 开头。
- newsletter/cold_email 第一行写"主题：xxx"。
- xiaohongshu 第一行写标题，最后放标签。
- 语言：${langText}。`;

  if (useTrending) {
    return `${base}\n\n请执行以下任务：\n1. 搜索今天商业、创业、科技或设计领域的热门话题。\n2. 选择一个最适合做销售内容切入的话题。\n3. 为 ${getPlatformLabel(platform)} 生成一篇高转化内容。\n\n${platformGuide}\n\n${formatRules}`;
  }
  return `${base}\n\n内容主题：${topic}\n目标平台：${getPlatformLabel(platform)}\n\n${platformGuide}\n\n${formatRules}`;
};

const buildVisualPrompt = ({ platform, language, topic, draft }: { platform: string; language: string; topic: string; draft: string }) => {
  const langText = language === "en" ? "English" : "中文";
  return `你是一位顶级创意总监和商业内容视觉策划。
基于下面这篇内容，输出一份"封面建议 + 配图方向 + 高质量图片生成提示词"。

目标平台：${getPlatformLabel(platform)}
内容主题：${topic || "未填写"}
文案正文：
${draft}

要求：
1. 封面方向（1-2种方案）。
2. 正文配图方向。
3. 1 条高质量图片生成提示词（主体、场景、构图、光线、情绪、色彩、镜头/质感、风格）。
4. 朋友圈首图：真实工作现场、个人状态、生活化高级感。
5. 小红书封面：利于点击、主体集中、标题感强。
6. 不要 markdown 符号。
7. 语言：${langText}，图片提示词可附英文版。`;
};

/* ═══════════════════════════════════════════════════════════════════
   Create — main component
   ═══════════════════════════════════════════════════════════════════ */
export default function Create() {
  const { t, lang } = useT();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [platform, setPlatform] = useState("x");
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [toast, showToast] = useToast();
  const [savedDrafts, setSavedDrafts] = useState<any[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const isMobile = useIsMobile();
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  const fetchDrafts = async () => {
    try { setSavedDrafts(await (await fetch("/api/content-drafts")).json()); }
    catch (e) { console.error("Failed to load drafts:", e); }
  };

  useEffect(() => { fetchDrafts(); }, []);
  useRealtimeRefresh(['content_drafts'], fetchDrafts);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("mobile-nav-visibility", { detail: { hidden: isMobile && showDrafts } }));
    return () => window.dispatchEvent(new CustomEvent("mobile-nav-visibility", { detail: { hidden: false } }));
  }, [showDrafts, isMobile]);

  const addMsg = (type: MessageType, content: string, extra?: Partial<ChatMessage>) => {
    const m: ChatMessage = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, content, timestamp: new Date(), ...extra };
    setMessages((prev) => [...prev, m]);
    return m.id;
  };

  const latestCopy = (): ChatMessage | undefined => [...messages].reverse().find((m) => m.type === "copy");

  /* ── Actions ─── */
  const handleSend = async (useTrending = false) => {
    const topic = inputText.trim();
    if (!useTrending && !topic) return;

    addMsg("user", useTrending ? t("create.autoSearch" as any) : topic);
    if (!useTrending) setInputText("");
    setLoading(true);
    setLoadingType("copy");

    try {
      const ai = getAIClient();
      const config: any = useTrending ? { tools: [{ googleSearch: {} }] } : {};
      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: buildCopyPrompt({ platform, language: lang, topic: useTrending ? "" : topic, useTrending }),
        config,
      });
      addMsg("copy", cleanGeneratedText(res.text || t("create.genFailed" as any), platform), { platform });
    } catch (error: any) {
      const em = error.message || "";
      if (em.includes("503") || em.includes("UNAVAILABLE")) addMsg("system", t("create.apiError.serverBusy" as any));
      else if (em.includes("429") || em.includes("quota")) addMsg("system", t("create.apiError.rateLimit" as any));
      else addMsg("system", (t("create.apiError.generic" as any) as string).replace("{message}", em || t("create.apiError.checkConnection" as any)));
    } finally { setLoading(false); setLoadingType(""); }
  };

  const handleVisual = async () => {
    const lc = latestCopy();
    if (!lc) { showToast(t("create.needCopyFirst" as any)); return; }
    setLoading(true);
    setLoadingType("visual");
    try {
      const ai = getAIClient();
      const userMsg = [...messages].reverse().find((m) => m.type === "user");
      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: buildVisualPrompt({ platform, language: lang, topic: userMsg?.content || "", draft: lc.content }),
      });
      addMsg("visual", cleanGeneratedText(res.text || t("create.genFailed" as any), platform));
    } catch (error: any) { addMsg("system", (t("create.coverGenFailed" as any) as string).replace("{message}", error.message || t("create.checkNetwork" as any))); }
    finally { setLoading(false); setLoadingType(""); }
  };

  const handleImage = async () => {
    const lc = latestCopy();
    if (!lc) { showToast(t("create.needCopyFirst" as any)); return; }
    setLoading(true);
    setLoadingType("image");

    const imageModel = localStorage.getItem("IMAGE_MODEL") || "imagen-4.0-generate-001";
    const dedicatedKey = localStorage.getItem("IMAGE_API_KEY") || "";
    const geminiKey = localStorage.getItem("GEMINI_API_KEY") || "";
    const visualMsg = [...messages].reverse().find((m) => m.type === "visual");
    const userMsg = [...messages].reverse().find((m) => m.type === "user");

    const imagePrompt = `Create one premium marketing image for ${getPlatformLabel(platform)}.
Topic: ${userMsg?.content || "Design subscription service"}
Copy context:
${lc.content}
Visual guidance:
${visualMsg?.content || "Modern, premium, editorial, minimalist."}
Requirements:
- One high-quality image only.
- Style: modern international minimalism, polished lighting, tasteful composition.`;

    try {
      const key = dedicatedKey || geminiKey;
      if (!key) throw new Error(t("create.needApiKey" as any));
      const ai = getAIClient(key);
      const response: any = await ai.models.generateImages({
        model: imageModel,
        prompt: imagePrompt,
        config: {
          numberOfImages: 1,
          aspectRatio: platform === "wechat" ? "4:3" : platform === "xiaohongshu" ? "3:4" : "1:1",
          imageSize: "2K",
        },
      });
      const bytes = response?.generatedImages?.[0]?.image?.imageBytes;
      if (!bytes) throw new Error(t("create.noImageData" as any));
      addMsg("image", `data:image/png;base64,${bytes}`);
    } catch (error: any) {
      const msg = String(error?.message || error || t("create.imageGenFailed" as any));
      if (msg.includes("only available on paid plans") || msg.includes("INVALID_ARGUMENT")) addMsg("system", t("create.imagenLimit" as any));
      else addMsg("system", msg);
    } finally { setLoading(false); setLoadingType(""); }
  };

  const saveDraft = async (content: string) => {
    try {
      const userMsg = [...messages].reverse().find((m) => m.type === "user");
      await fetch("/api/content-drafts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: userMsg?.content || "", platform, language: lang, content }),
      });
      showToast(t("create.draftSaved" as any));
      fetchDrafts();
    } catch { showToast(t("create.saveFailed" as any)); }
  };

  const loadDraft = (item: any) => {
    setPlatform(item.platform || "x");
    setMessages([
      { id: `lu-${Date.now()}`, type: "user", content: item.topic || t("create.draftLoaded" as any), timestamp: new Date() },
      { id: `lc-${Date.now()}`, type: "copy", content: item.content || "", platform: item.platform, timestamp: new Date() },
    ]);
    setShowDrafts(false);
    showToast(t("create.draftLoaded" as any));
  };

  const deleteDraft = async (id: number) => {
    try { await fetch(`/api/content-drafts/${id}`, { method: "DELETE" }); showToast(t("create.draftDeleted" as any)); fetchDrafts(); }
    catch { showToast(t("create.deleteFailed" as any)); }
  };

  const clip = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopied(msgId);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadImage = (dataUrl: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `soloceo-${platform}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const hasCopy = messages.some((m) => m.type === "copy");

  return (
    <div className="mobile-page flex flex-col h-full relative">
      <style>{`
        @keyframes msgIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .hide-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 px-5 py-2.5 rounded-lg z-[9999] flex items-center gap-2" style={{ background: "var(--text)", color: "var(--bg)", boxShadow: "var(--shadow-md)" }}>
          <Check size={16} className="text-emerald-400" />
          <span className="text-[13px] font-medium">{toast}</span>
        </div>
      )}

      {/* ── Header bar ─── */}
      <div className="shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        {/* Desktop title */}
        <div className="hidden md:flex items-center justify-between px-6 pt-5 pb-1">
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>{t("create.pageTitle" as any)}</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowDrafts(!showDrafts)} className="btn-ghost text-[11px] px-2.5 py-1.5 rounded-md gap-1.5" style={showDrafts ? { background: "var(--accent-light)", color: "var(--accent)" } : {}}>
              <Save size={16} /> {t("create.drafts" as any)}
              {savedDrafts.length > 0 && <span className="text-[11px] font-bold rounded-full px-1.5 py-0.5" style={{ background: "var(--accent)", color: "#fff" }}>{savedDrafts.length}</span>}
            </button>
          </div>
        </div>

        {/* Platform selector */}
        <div className="flex items-center gap-1 px-3 md:px-6 py-2.5 overflow-x-auto hide-scroll">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPlatform(p.id)}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-[6px] rounded-lg text-[13px] font-medium transition-all active:scale-95"
              style={platform === p.id
                ? { background: "var(--surface)", color: "var(--text)", boxShadow: "var(--shadow-xs)", border: "1px solid var(--border)" }
                : { color: "var(--text-secondary)" }}
            >
              {p.icon} {t(p.labelKey as any)}
            </button>
          ))}
          {/* Mobile extras */}
          <div className="shrink-0 w-px h-4 mx-1 md:hidden" style={{ background: "var(--border)" }} />
          <button onClick={() => setShowDrafts(!showDrafts)} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-[6px] rounded-lg text-[13px] font-medium md:hidden" style={showDrafts ? { color: "var(--accent)" } : { color: "var(--text-secondary)" }}>
            <Save size={16} /> {t("create.drafts" as any)}
          </button>
        </div>
      </div>

      {/* ── Messages area ─── */}
      <div className="flex-1 overflow-y-auto ios-scroll" style={{ background: "var(--bg)" }}>
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-5 md:py-8 space-y-4">
          {/* Empty state */}
          {messages.length === 0 && !showDrafts && (
            <div className="flex flex-col items-center justify-center text-center min-h-[calc(100vh-220px)]">
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "var(--accent)", boxShadow: "var(--shadow-md)" }}>
                  <PenTool size={28} className="text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "var(--surface)", boxShadow: "var(--shadow-sm)" }}>
                  <Sparkles size={16} style={{ color: "var(--accent)" }} />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ color: "var(--text)" }}>{t("create.emptyTitle" as any)}</h3>
              <p className="text-[13px] max-w-md leading-relaxed mb-1" style={{ color: "var(--text-secondary)" }}>
                {(t("create.emptyDesc" as any) as string).split("{platform}")[0]}<span className="font-semibold" style={{ color: "var(--accent)" }}>{getPlatformDisplayLabel(platform, t)}</span>{(t("create.emptyDesc" as any) as string).split("{platform}")[1]}
              </p>
              <p className="text-[11px] mb-8" style={{ color: "var(--text-secondary)" }}>{t("create.emptySubtext" as any)}</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button onClick={() => textareaRef.current?.focus()} className="btn-primary gap-2 text-[13px]">
                  <Sparkles size={16} /> {t("create.emptyBtn1" as any)}
                </button>
                <button onClick={() => handleSend(true)} className="btn-ghost gap-2 text-[13px]" style={{ border: "1px solid var(--border)" }}>
                  <TrendingUp size={16} /> {t("create.emptyBtn2" as any)}
                </button>
              </div>
            </div>
          )}

          {/* Chat messages */}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`} style={{ animation: "msgIn 0.25s ease-out forwards" }}>
              {msg.type === "user" ? (
                <div className="max-w-[85%] md:max-w-[70%]">
                  <div className="rounded-2xl rounded-br-sm px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap" style={{ background: "var(--accent)", color: "#fff" }}>
                    {msg.content}
                  </div>
                </div>
              ) : msg.type === "copy" ? (
                <div className="max-w-[92%] md:max-w-[82%] w-full">
                  <div className="card rounded-2xl rounded-bl-sm overflow-hidden">
                    <div className="px-4 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                      <span className="text-[11px] font-medium flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                        {PLATFORMS.find((p) => p.id === (msg.platform || platform))?.icon}
                        <span>{getPlatformDisplayLabel(msg.platform || platform, t)}</span>
                      </span>
                      <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>{lang === "zh" ? t("create.langToggle.zh" as any) : t("create.langToggle.en" as any)}</span>
                    </div>
                    <div className="px-4 py-3.5 max-h-[420px] overflow-y-auto" style={{ color: "var(--text)" }}>
                      {renderFormattedContent(msg.content, msg.platform || platform, t("create.subjectLine" as any))}
                    </div>
                    <div className="px-3 py-2 flex flex-wrap items-center gap-0.5" style={{ borderTop: "1px solid var(--border)" }}>
                      <MsgBtn icon={copied === msg.id ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />} label={copied === msg.id ? t("create.copied" as any) : t("create.copy" as any)} onClick={() => clip(msg.content, msg.id)} />
                      <MsgBtn icon={<Save size={16} />} label={t("create.saveDraft" as any)} onClick={() => saveDraft(msg.content)} />
                      <MsgBtn icon={<ImageIcon size={16} />} label={t("create.cover" as any)} onClick={handleVisual} disabled={loading} />
                      <MsgBtn icon={<ImageIcon size={16} />} label={t("create.image" as any)} onClick={handleImage} disabled={loading} />
                      <div className="flex-1" />
                      <MsgBtn icon={<RotateCcw size={16} />} label={t("create.regenerate" as any)} onClick={() => {
                        const um = [...messages].reverse().find((m) => m.type === "user");
                        if (um) { setInputText(um.content); handleSend(); }
                      }} disabled={loading} />
                    </div>
                  </div>
                </div>
              ) : msg.type === "visual" ? (
                <div className="max-w-[92%] md:max-w-[82%] w-full">
                  <div className="card rounded-2xl rounded-bl-sm overflow-hidden">
                    <div className="px-4 py-2 flex items-center gap-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
                      <span className="text-[11px] font-medium flex items-center gap-1.5" style={{ color: "var(--success)" }}>
                        <ImageIcon size={16} /> {t("create.coverTitle" as any)}
                      </span>
                    </div>
                    <div className="px-4 py-3.5 max-h-[420px] overflow-y-auto" style={{ color: "var(--text)" }}>
                      {renderFormattedContent(msg.content, msg.platform || platform, t("create.subjectLine" as any))}
                    </div>
                    <div className="px-3 py-2 flex gap-0.5" style={{ borderTop: "1px solid var(--border)" }}>
                      <MsgBtn icon={copied === msg.id ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />} label={copied === msg.id ? t("create.copied" as any) : t("create.copy" as any)} onClick={() => clip(msg.content, msg.id)} />
                    </div>
                  </div>
                </div>
              ) : msg.type === "image" ? (
                <div className="max-w-[92%] md:max-w-[82%] w-full">
                  <div className="card rounded-2xl rounded-bl-sm overflow-hidden">
                    <div className="px-4 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                      <span className="text-[11px] font-medium flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
                        <ImageIcon size={16} /> {t("create.aiImage" as any)}
                      </span>
                    </div>
                    <div className="p-3">
                      <img src={msg.content} alt="AI generated" className="w-full max-h-[520px] object-contain rounded-lg" style={{ background: "var(--surface-alt)" }} />
                    </div>
                    <div className="px-3 py-2 flex gap-0.5" style={{ borderTop: "1px solid var(--border)" }}>
                      <MsgBtn icon={<Download size={16} />} label={t("create.downloadImage" as any)} onClick={() => downloadImage(msg.content)} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="max-w-[90%] md:max-w-[80%]">
                  <div className="rounded-2xl rounded-bl-sm px-4 py-3 text-[13px] leading-relaxed flex items-start gap-2" style={{ background: "var(--warning-light)", color: "var(--warning)" }}>
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{msg.content}</span>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Loading */}
          {loading && (
            <div className="flex justify-start" style={{ animation: "msgIn 0.25s ease-out forwards" }}>
              <div className="card rounded-2xl rounded-bl-sm overflow-hidden max-w-xs">
                <div className="h-[2px] w-full" style={{ background: "linear-gradient(90deg, var(--accent), var(--accent-light), var(--accent))", backgroundSize: "200% 100%", animation: "shimmer 1.5s linear infinite" }} />
                <div className="px-4 py-3 flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--accent)", animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--accent)", animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--accent)", animationDelay: "300ms" }} />
                  </div>
                  <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                    {loadingType === "copy" ? (t("create.generating" as any) as string).replace("{platform}", getPlatformDisplayLabel(platform, t)) : loadingType === "visual" ? t("create.generatingCover" as any) : loadingType === "image" ? t("create.generatingImage" as any) : t("create.processing" as any)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {/* ── Input area ─── */}
      <div className="shrink-0" style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
        <div className="max-w-3xl mx-auto w-full px-3 md:px-5 py-3 pb-safe space-y-2">
          {hasCopy && !loading && (
            <div className="flex gap-1.5 overflow-x-auto hide-scroll">
              <button onClick={handleVisual} className="btn-ghost shrink-0 rounded-md px-2.5 py-1.5 text-[11px] gap-1.5" style={{ border: "1px solid var(--border)" }}><ImageIcon size={16} /> {t("create.coverSuggestion" as any)}</button>
              <button onClick={handleImage} className="btn-ghost shrink-0 rounded-md px-2.5 py-1.5 text-[11px] gap-1.5" style={{ border: "1px solid var(--border)" }}><ImageIcon size={16} /> {t("create.genImage" as any)}</button>
            </div>
          )}
          <div className="flex items-end gap-2 rounded-lg p-1.5 pl-3 transition-all" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("create.inputPlaceholder" as any)}
              rows={1}
              className="flex-1 bg-transparent text-[13px] focus:outline-none resize-none max-h-32 overflow-y-auto py-2"
              style={{ color: "var(--text)", minHeight: "36px" }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "36px";
                el.style.height = Math.min(el.scrollHeight, 128) + "px";
              }}
            />
            <div className="flex gap-1 shrink-0">
              <button onClick={() => handleSend(true)} disabled={loading} title={t("create.searchTopics" as any)} className="flex h-8 w-8 items-center justify-center rounded-md transition-all active:scale-95 disabled:opacity-40" style={{ color: "var(--text-secondary)" }}>
                <TrendingUp size={16} />
              </button>
              <button
                onClick={() => handleSend()}
                disabled={loading || !inputText.trim()}
                className="flex h-8 w-8 items-center justify-center rounded-md transition-all active:scale-95"
                style={inputText.trim() && !loading ? { background: "var(--accent)", color: "#fff" } : { background: "var(--border)", color: "var(--text-secondary)" }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Drafts side panel (desktop) / fullscreen (mobile) ─── */}
      <AnimatePresence>
        {showDrafts && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50"
              style={{ background: isMobile ? "var(--bg)" : "rgba(0,0,0,0.2)" }}
              onClick={() => !isMobile && setShowDrafts(false)}
            />
            <motion.div
              initial={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
              animate={{ x: 0, y: 0 }}
              exit={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className={isMobile
                ? "fixed inset-0 z-50 flex flex-col"
                : "fixed top-0 right-0 z-50 h-full w-full max-w-[400px] border-l flex flex-col"
              }
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--accent-light)", color: "var(--accent)" }}><Save size={16} /></div>
                  <div>
                    <h3 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{t("create.drafts.title" as any)}</h3>
                    <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{(t("create.drafts.count" as any) as string).replace("{count}", String(savedDrafts.length))}</p>
                  </div>
                </div>
                <button onClick={() => setShowDrafts(false)} className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}>
                  {isMobile ? <X size={20} /> : <PanelRightClose size={20} />}
                </button>
              </div>

              {/* Drafts list */}
              <div className="flex-1 overflow-y-auto ios-scroll">
                {savedDrafts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-2">
                    <Save size={24} style={{ color: "var(--text-secondary)" }} />
                    <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{t("create.drafts.empty" as any)}</p>
                  </div>
                ) : (
                  savedDrafts.map((item) => (
                    <div key={item.id} className="list-item px-5 py-3 flex items-center gap-3 group cursor-pointer" onClick={() => loadDraft(item)}>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium truncate" style={{ color: "var(--text)" }}>{item.topic || t("create.drafts.untitled" as any)}</div>
                        <div className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                          {getPlatformDisplayLabel(item.platform, t)} · {item.language === "en" ? t("create.langToggle.en" as any) : t("create.langToggle.zh" as any)}
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteDraft(item.id); }} className="p-1.5 rounded-lg transition-colors md:opacity-0 md:group-hover:opacity-100" style={{ color: "var(--text-secondary)" }} aria-label={t("common.delete" as any)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Message action button ──────────────────────────────────────── */
function MsgBtn({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all active:scale-95 disabled:opacity-40 hover:bg-[var(--surface-alt)]" style={{ color: "var(--text-secondary)" }}>
      {icon} {label}
    </button>
  );
}
