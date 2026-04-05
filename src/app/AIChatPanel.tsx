import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X, Send, Loader2, Trash2, Copy, Check, Settings } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useT } from "../i18n/context";
import { useAppSettings } from "../hooks/useAppSettings";
import { useUIStore } from "../store/useUIStore";
import { api } from "../lib/api";
import {
  getAIConfig,
  streamChat,
  type AIProvider,
  type ChatMessage,
} from "../lib/ai-client";

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

/* ── Page-aware context builder ─────────────────────────────── */

function buildSystemPrompt(
  dashboard: Record<string, unknown> | null,
  pageContext: Record<string, unknown> | null,
  activeTab: string,
  lang: string,
): string {
  const lines: string[] = [];

  if (lang === "zh") {
    lines.push("你是 Solo CEO 的 AI 助手。");
    if (dashboard) {
      const d = dashboard;
      lines.push("", "## 业务概览");
      if (d.mrr != null) lines.push(`- MRR（月经常性收入）：¥${Number(d.mrr).toLocaleString()}`);
      if (d.ytdRevenue != null) lines.push(`- 年度累计收入：¥${Number(d.ytdRevenue).toLocaleString()}`);
      if (d.monthlyIncome != null) lines.push(`- 本月收入：¥${Number(d.monthlyIncome).toLocaleString()}`);
      if (d.todayIncome != null && Number(d.todayIncome) > 0) lines.push(`- 今日收入：¥${Number(d.todayIncome).toLocaleString()}`);
      if (d.clientsCount != null) lines.push(`- 活跃客户：${d.clientsCount} 个`);
      if (d.activeTasks != null) lines.push(`- 进行中任务：${d.activeTasks} 个（待办 ${d.todoCount || 0}，进行中 ${d.inProgressCount || 0}）`);
      if (d.leadsCount != null) lines.push(`- 线索管道：共 ${d.leadsCount} 条（新 ${d.leadsNew || 0} / 跟进 ${d.leadsContacted || 0} / 提案 ${d.leadsProposal || 0}）`);
      if (Array.isArray(d.urgentTasks) && d.urgentTasks.length > 0) {
        lines.push(`- 紧急/逾期任务：${d.urgentTasks.map((t: { title: string }) => t.title).join("、")}`);
      }
      if (Array.isArray(d.receivables) && d.receivables.length > 0) {
        lines.push(`- 待收款：${d.receivables.length} 笔`);
      }
    }
    // Page-specific context
    if (pageContext) {
      const tabNames: Record<string, string> = { work: "任务", leads: "线索", clients: "客户", finance: "收支" };
      lines.push("", `## 当前页面：${tabNames[activeTab] || activeTab}`);
      if (Array.isArray(pageContext.items)) {
        lines.push(`共 ${pageContext.items.length} 条记录：`);
        pageContext.items.slice(0, 15).forEach((item: Record<string, unknown>) => {
          const parts = [item.title || item.name || item.description || ""];
          if (item.column) parts.push(`[${item.column}]`);
          if (item.status) parts.push(`(${item.status})`);
          if (item.amount != null) parts.push(`¥${Number(item.amount).toLocaleString()}`);
          if (item.due) parts.push(`截止 ${item.due}`);
          lines.push(`- ${parts.join(" ")}`);
        });
        if (pageContext.items.length > 15) lines.push(`- ...还有 ${pageContext.items.length - 15} 条`);
      }
    }
    lines.push("", "根据以上数据回答用户问题。用简洁专业的中文回答，善用 Markdown 格式（列表、加粗等）让回复更清晰。不要重复列出所有数据，只回答用户问的部分。");
  } else {
    lines.push("You are Solo CEO's AI assistant.");
    if (dashboard) {
      const d = dashboard;
      lines.push("", "## Business Overview");
      if (d.mrr != null) lines.push(`- MRR: $${Number(d.mrr).toLocaleString()}`);
      if (d.ytdRevenue != null) lines.push(`- YTD Revenue: $${Number(d.ytdRevenue).toLocaleString()}`);
      if (d.monthlyIncome != null) lines.push(`- This month: $${Number(d.monthlyIncome).toLocaleString()}`);
      if (d.clientsCount != null) lines.push(`- Active clients: ${d.clientsCount}`);
      if (d.activeTasks != null) lines.push(`- Active tasks: ${d.activeTasks} (todo ${d.todoCount || 0}, in progress ${d.inProgressCount || 0})`);
      if (d.leadsCount != null) lines.push(`- Leads: ${d.leadsCount} total (new ${d.leadsNew || 0} / contacted ${d.leadsContacted || 0} / proposal ${d.leadsProposal || 0})`);
    }
    if (pageContext && Array.isArray(pageContext.items)) {
      lines.push("", `## Current Page: ${activeTab}`);
      lines.push(`${pageContext.items.length} items:`);
      pageContext.items.slice(0, 15).forEach((item: Record<string, unknown>) => {
        const parts = [item.title || item.name || item.description || ""];
        if (item.column) parts.push(`[${item.column}]`);
        if (item.status) parts.push(`(${item.status})`);
        if (item.amount != null) parts.push(`$${Number(item.amount).toLocaleString()}`);
        lines.push(`- ${parts.join(" ")}`);
      });
    }
    lines.push("", "Answer concisely using Markdown formatting. Only address what the user asks.");
  }

  return lines.join("\n");
}

/* ── Page context fetcher ──────────────────────────────────── */
const PAGE_API: Record<string, string> = {
  work: "/api/tasks",
  leads: "/api/leads",
  clients: "/api/clients",
  finance: "/api/finance",
};

async function fetchPageContext(tab: string): Promise<Record<string, unknown> | null> {
  const endpoint = PAGE_API[tab];
  if (!endpoint) return null;
  try {
    const data = await api.get(endpoint);
    return { items: Array.isArray(data) ? data : [] };
  } catch {
    return null;
  }
}

/* ── Quick prompts per page ──────────────────────────────────── */
function getQuickPrompts(tab: string, lang: string): { label: string; prompt: string }[] {
  if (lang === "zh") {
    const common = [
      { label: "📊 本月收入", prompt: "本月收入情况怎么样？和上月比如何？" },
      { label: "⏰ 逾期任务", prompt: "有哪些任务逾期了？帮我排个优先级" },
    ];
    const pageSpecific: Record<string, { label: string; prompt: string }[]> = {
      home: [
        { label: "📈 业务总览", prompt: "帮我总结一下目前的业务状况" },
        { label: "💡 今日建议", prompt: "根据我的数据，今天应该优先做什么？" },
      ],
      work: [
        { label: "📋 任务分析", prompt: "帮我分析当前任务的分布情况" },
        { label: "🎯 优先排序", prompt: "帮我按紧急程度排一下任务优先级" },
      ],
      leads: [
        { label: "🔥 跟进建议", prompt: "哪些线索需要优先跟进？给我建议" },
        { label: "📈 转化分析", prompt: "我的线索转化情况怎么样？" },
      ],
      clients: [
        { label: "👥 客户概况", prompt: "帮我概括一下活跃客户的情况" },
        { label: "💰 收入结构", prompt: "我的客户收入结构是怎样的？" },
      ],
      finance: [
        { label: "💰 收支分析", prompt: "帮我分析本月的收支情况" },
        { label: "📊 趋势预测", prompt: "根据目前的数据，预估一下本月总收入" },
      ],
    };
    return [...(pageSpecific[tab] || pageSpecific.home!), ...common];
  }

  const common = [
    { label: "📊 Revenue", prompt: "How's my revenue this month compared to last?" },
    { label: "⏰ Overdue", prompt: "Which tasks are overdue? Help me prioritize." },
  ];
  const pageSpecific: Record<string, { label: string; prompt: string }[]> = {
    home: [
      { label: "📈 Overview", prompt: "Give me a business status summary." },
      { label: "💡 Today", prompt: "What should I focus on today?" },
    ],
    work: [
      { label: "📋 Tasks", prompt: "Analyze my current task distribution." },
      { label: "🎯 Priority", prompt: "Help me prioritize my tasks by urgency." },
    ],
    leads: [
      { label: "🔥 Follow-up", prompt: "Which leads should I follow up on first?" },
      { label: "📈 Conversion", prompt: "How's my lead conversion rate?" },
    ],
    clients: [
      { label: "👥 Clients", prompt: "Summarize my active client situation." },
      { label: "💰 Revenue mix", prompt: "What does my client revenue structure look like?" },
    ],
    finance: [
      { label: "💰 P&L", prompt: "Analyze my income and expenses this month." },
      { label: "📊 Forecast", prompt: "Based on current data, estimate this month's total revenue." },
    ],
  };
  return [...(pageSpecific[tab] || pageSpecific.home!), ...common];
}

/* ── Copy button ──────────────────────────────────────────── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--color-bg-tertiary)]"
      style={{ color: "var(--color-text-quaternary)" }}
      aria-label="Copy"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

/* ── Markdown renderer for assistant messages ──────────────── */
const MarkdownContent = React.memo(({ content }: { content: string }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
      ul: ({ children }) => <ul className="list-disc pl-4 mb-2 last:mb-0 space-y-0.5">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 last:mb-0 space-y-0.5">{children}</ol>,
      li: ({ children }) => <li>{children}</li>,
      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
      code: ({ children, className }) => {
        const isBlock = className?.includes("language-");
        if (isBlock) {
          return (
            <pre className="rounded-lg px-3 py-2 my-2 text-[13px] overflow-x-auto" style={{ background: "var(--color-bg-tertiary)" }}>
              <code>{children}</code>
            </pre>
          );
        }
        return (
          <code className="px-1 py-0.5 rounded text-[13px]" style={{ background: "var(--color-bg-tertiary)" }}>
            {children}
          </code>
        );
      },
      pre: ({ children }) => <>{children}</>,
      h1: ({ children }) => <h3 className="font-semibold text-[15px] mb-1 mt-2">{children}</h3>,
      h2: ({ children }) => <h3 className="font-semibold text-[15px] mb-1 mt-2">{children}</h3>,
      h3: ({ children }) => <h3 className="font-semibold text-[14px] mb-1 mt-2">{children}</h3>,
      a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--color-accent)" }}>
          {children}
        </a>
      ),
      blockquote: ({ children }) => (
        <blockquote className="border-l-2 pl-3 my-2 opacity-80" style={{ borderColor: "var(--color-text-quaternary)" }}>
          {children}
        </blockquote>
      ),
    }}
  >
    {content}
  </ReactMarkdown>
));

/* ── Main component ────────────────────────────────────────── */
interface AIChatPanelProps {
  open: boolean;
  onClose: () => void;
}

export function AIChatPanel({ open, onClose }: AIChatPanelProps) {
  const { t, lang } = useT();
  const { settings } = useAppSettings();
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [pageContext, setPageContext] = useState<Record<string, unknown> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const hasAI = !!getAIConfig(settings);

  // Fetch dashboard + page context when panel opens
  useEffect(() => {
    if (open && !dashboard) {
      api.get("/api/dashboard").then((d) => setDashboard(d as Record<string, unknown>)).catch(() => {});
      fetchPageContext(activeTab).then(setPageContext);
    }
  }, [open, dashboard, activeTab]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Textarea auto-resize
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const handleClose = () => {
    if (abortRef.current) abortRef.current.abort();
    onClose();
    setMessages([]);
    setInput("");
    setIsStreaming(false);
    setDashboard(null);
    setPageContext(null);
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const aiConfig = getAIConfig(settings);
    if (!aiConfig) {
      setMessages(prev => [...prev,
        { role: "user", content: text },
        { role: "assistant", content: t("ai.chat.noProvider") },
      ]);
      return;
    }

    const userMsg: Message = { role: "user", content: text };
    const assistantMsg: Message = { role: "assistant", content: "", streaming: true };
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    const systemPrompt = buildSystemPrompt(dashboard, pageContext, activeTab, lang);
    const chatHistory: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-10).map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: text },
    ];

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      await streamChat(
        aiConfig.provider as AIProvider,
        aiConfig.apiKey,
        chatHistory,
        (chunk) => {
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === "assistant") {
              updated[updated.length - 1] = { ...last, content: last.content + chunk };
            }
            return updated;
          });
        },
        abort.signal,
      );
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === "assistant" && !last.content) {
          updated[updated.length - 1] = { ...last, content: t("ai.chat.error") };
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
      setMessages(prev => prev.map(m => ({ ...m, streaming: false })));
      abortRef.current = null;
    }
  }, [isStreaming, settings, dashboard, pageContext, activeTab, lang, messages, t]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = "auto";
    sendMessage(text);
  }, [input, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickPrompts = getQuickPrompts(activeTab, lang);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed z-[var(--layer-dialog)] flex flex-col"
          style={{
            bottom: 0,
            right: 0,
            width: "100%",
            height: "100%",
            maxWidth: "min(480px, 100%)",
            maxHeight: "min(680px, 100%)",
            background: "var(--color-bg-primary)",
            borderLeft: "1px solid var(--color-line-secondary)",
            boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 shrink-0"
            style={{
              height: 52,
              borderBottom: "1px solid var(--color-line-secondary)",
            }}
          >
            <div className="flex items-center gap-2">
              <MessageCircle size={18} style={{ color: "var(--color-accent)" }} />
              <span className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
                {t("ai.chat.title")}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => { setMessages([]); setDashboard(null); setPageContext(null); }}
                  className="btn-icon-sm"
                  aria-label={t("ai.chat.clear")}
                  title={t("ai.chat.clear")}
                >
                  <Trash2 size={15} />
                </button>
              )}
              <button onClick={handleClose} className="btn-icon-sm" aria-label={t("common.close")}>
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
            style={{ overscrollBehavior: "contain" }}
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                {hasAI ? (
                  <>
                    <div className="flex flex-col items-center gap-2 opacity-50">
                      <MessageCircle size={32} style={{ color: "var(--color-text-quaternary)" }} />
                      <p className="text-[13px] text-center" style={{ color: "var(--color-text-tertiary)" }}>
                        {t("ai.chat.welcome")}
                      </p>
                    </div>
                    {/* Quick prompts */}
                    <div className="flex flex-wrap gap-2 justify-center max-w-[320px]">
                      {quickPrompts.map((qp, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(qp.prompt)}
                          className="px-3 py-1.5 rounded-full text-[13px] transition-colors hover:opacity-80 press-feedback"
                          style={{
                            background: "var(--color-bg-secondary)",
                            color: "var(--color-text-secondary)",
                            border: "1px solid var(--color-line-tertiary)",
                          }}
                        >
                          {qp.label}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  /* No AI configured — guide to settings */
                  <div className="flex flex-col items-center gap-3 opacity-60">
                    <Settings size={32} style={{ color: "var(--color-text-quaternary)" }} />
                    <p className="text-[13px] text-center" style={{ color: "var(--color-text-tertiary)" }}>
                      {t("ai.chat.noProvider")}
                    </p>
                    <button
                      onClick={() => { setActiveTab("settings"); handleClose(); }}
                      className="px-4 py-1.5 rounded-full text-[13px] transition-colors"
                      style={{
                        background: "var(--color-accent)",
                        color: "var(--color-brand-text)",
                      }}
                    >
                      {t("common.goSettings")}
                    </button>
                  </div>
                )}
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed ${msg.role === "assistant" ? "group relative" : ""}`}
                  style={msg.role === "user" ? {
                    background: "var(--color-accent)",
                    color: "var(--color-brand-text)",
                    borderBottomRightRadius: 6,
                    whiteSpace: "pre-wrap",
                  } : {
                    background: "var(--color-bg-secondary)",
                    color: "var(--color-text-primary)",
                    borderBottomLeftRadius: 6,
                  }}
                >
                  {msg.role === "assistant" ? (
                    msg.content ? (
                      <>
                        <MarkdownContent content={msg.content} />
                        {!msg.streaming && (
                          <div className="flex justify-end mt-1 -mb-1 -mr-1">
                            <CopyButton text={msg.content} />
                          </div>
                        )}
                      </>
                    ) : msg.streaming ? (
                      <Loader2 size={14} className="animate-spin" style={{ color: "var(--color-text-tertiary)" }} />
                    ) : null
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div
            className="shrink-0 px-3 pb-3 pt-2"
            style={{
              borderTop: "1px solid var(--color-line-secondary)",
              paddingBottom: "max(12px, env(safe-area-inset-bottom))",
            }}
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={t("ai.chat.placeholder")}
                rows={1}
                className="input-base flex-1 px-3 py-2.5 text-[14px] resize-none"
                style={{ maxHeight: 120, minHeight: 40 }}
                disabled={isStreaming}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                className="shrink-0 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
                style={{
                  width: 40,
                  height: 40,
                  background: "var(--color-accent)",
                  color: "var(--color-brand-text)",
                }}
                aria-label={t("ai.chat.send")}
              >
                {isStreaming ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
