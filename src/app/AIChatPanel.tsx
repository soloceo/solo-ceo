import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X, Send, Loader2, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useT } from "../i18n/context";
import { useAppSettings } from "../hooks/useAppSettings";
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

function buildSystemPrompt(dashboard: Record<string, unknown> | null, lang: string): string {
  if (!dashboard) {
    return lang === "zh"
      ? "你是 Solo CEO 的 AI 助手。帮助用户管理业务、回答问题、提供建议。用简洁专业的语气回答。"
      : "You are Solo CEO's AI assistant. Help the user manage their business, answer questions, and provide advice. Be concise and professional.";
  }

  const d = dashboard as Record<string, unknown>;
  const lines: string[] = [];

  if (lang === "zh") {
    lines.push("你是 Solo CEO 的 AI 助手，以下是用户当前的业务数据：");
    if (d.mrr != null) lines.push(`- MRR（月经常性收入）：¥${Number(d.mrr).toLocaleString()}`);
    if (d.ytdRevenue != null) lines.push(`- 年度累计收入：¥${Number(d.ytdRevenue).toLocaleString()}`);
    if (d.monthlyIncome != null) lines.push(`- 本月收入：¥${Number(d.monthlyIncome).toLocaleString()}`);
    if (d.todayIncome != null && Number(d.todayIncome) > 0) lines.push(`- 今日收入：¥${Number(d.todayIncome).toLocaleString()}`);
    if (d.clientsCount != null) lines.push(`- 活跃客户：${d.clientsCount} 个`);
    if (d.activeTasks != null) lines.push(`- 进行中任务：${d.activeTasks} 个（待办 ${d.todoCount || 0}，进行中 ${d.inProgressCount || 0}）`);
    if (d.leadsCount != null) lines.push(`- 线索管道：共 ${d.leadsCount} 条（新 ${d.leadsNew || 0} / 跟进 ${d.leadsContacted || 0} / 提案 ${d.leadsProposal || 0}）`);
    if (Array.isArray(d.urgentTasks) && d.urgentTasks.length > 0) {
      lines.push(`- 紧急任务：${d.urgentTasks.map((t: { title: string }) => t.title).join("、")}`);
    }
    if (Array.isArray(d.receivables) && d.receivables.length > 0) {
      lines.push(`- 待收款：${d.receivables.length} 笔`);
    }
    lines.push("");
    lines.push("根据以上数据回答用户问题。用简洁专业的中文回答，不要重复列出所有数据，只回答用户问的部分。");
  } else {
    lines.push("You are Solo CEO's AI assistant. Here is the user's current business data:");
    if (d.mrr != null) lines.push(`- MRR: $${Number(d.mrr).toLocaleString()}`);
    if (d.ytdRevenue != null) lines.push(`- YTD Revenue: $${Number(d.ytdRevenue).toLocaleString()}`);
    if (d.monthlyIncome != null) lines.push(`- This month's income: $${Number(d.monthlyIncome).toLocaleString()}`);
    if (d.clientsCount != null) lines.push(`- Active clients: ${d.clientsCount}`);
    if (d.activeTasks != null) lines.push(`- Active tasks: ${d.activeTasks} (todo ${d.todoCount || 0}, in progress ${d.inProgressCount || 0})`);
    if (d.leadsCount != null) lines.push(`- Leads pipeline: ${d.leadsCount} total (new ${d.leadsNew || 0} / contacted ${d.leadsContacted || 0} / proposal ${d.leadsProposal || 0})`);
    lines.push("");
    lines.push("Answer based on this data. Be concise and professional. Only address what the user asks.");
  }

  return lines.join("\n");
}

interface AIChatPanelProps {
  open: boolean;
  onClose: () => void;
}

export function AIChatPanel({ open, onClose }: AIChatPanelProps) {
  const { t, lang } = useT();
  const { settings } = useAppSettings();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch dashboard data when panel opens
  useEffect(() => {
    if (open && !dashboard) {
      api.get("/api/dashboard").then((d) => setDashboard(d as Record<string, unknown>)).catch(() => {});
    }
  }, [open, dashboard]);

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

  const handleClose = () => {
    if (abortRef.current) abortRef.current.abort();
    onClose();
    setMessages([]);
    setInput("");
    setIsStreaming(false);
    setDashboard(null);
  };

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const aiConfig = getAIConfig(settings);
    if (!aiConfig) {
      setMessages(prev => [...prev,
        { role: "user", content: text },
        { role: "assistant", content: t("ai.chat.noProvider") },
      ]);
      setInput("");
      return;
    }

    const userMsg: Message = { role: "user", content: text };
    const assistantMsg: Message = { role: "assistant", content: "", streaming: true };
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsStreaming(true);

    // Build messages array for API
    const systemPrompt = buildSystemPrompt(dashboard, lang);
    const chatHistory: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      // Include recent history (last 10 messages) for context
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
  }, [input, isStreaming, settings, dashboard, lang, messages, t]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
                  onClick={() => { setMessages([]); setDashboard(null); }}
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
              <div className="flex flex-col items-center justify-center h-full gap-2 opacity-50">
                <MessageCircle size={32} style={{ color: "var(--color-text-quaternary)" }} />
                <p className="text-[13px] text-center" style={{ color: "var(--color-text-tertiary)" }}>
                  {t("ai.chat.welcome")}
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap"
                  style={msg.role === "user" ? {
                    background: "var(--color-accent)",
                    color: "var(--color-brand-text)",
                    borderBottomRightRadius: 6,
                  } : {
                    background: "var(--color-bg-secondary)",
                    color: "var(--color-text-primary)",
                    borderBottomLeftRadius: 6,
                  }}
                >
                  {msg.content || (msg.streaming ? (
                    <Loader2 size={14} className="animate-spin" style={{ color: "var(--color-text-tertiary)" }} />
                  ) : null)}
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
                onChange={e => setInput(e.target.value)}
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
