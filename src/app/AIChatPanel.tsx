import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Send, Loader2, Trash2, Copy, Check, Settings, Plus, ChevronLeft, MessagesSquare, Zap, CheckCircle2, XCircle, Square } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useT } from "../i18n/context";
import { useAppSettings } from "../hooks/useAppSettings";
import { useUIStore } from "../store/useUIStore";
import { api } from "../lib/api";
import { todayDateKey } from "../lib/date-utils";
import { useSettingsStore } from "../store/useSettingsStore";
import {
  getAIConfig,
  getDeviceAIProvider,
  getOllamaConfig,
  streamChat,
  type AIProvider,
  type ChatMessage,
  type StreamResult,
  type NativeToolDef,
} from "../lib/ai-client";
import {
  AGENT_TOOLS,
  buildToolsPrompt,
  buildFilteredToolsPrompt,
  buildConfirmInfo,
  executeTool,
  TOOL_SAFETY,
  type ToolCall,
  type ToolConfirmInfo,
} from "./ai-tools";
import { useAgents } from "../hooks/useAgents";
import type { AgentConfig } from "../lib/agent-types";

interface Message {
  role: "user" | "assistant";
  content: string;
  agentId?: number | null;
  streaming?: boolean;
  timestamp?: number;
  /** Tool confirmation pending user action */
  toolConfirm?: ToolConfirmInfo;
  /** Tool execution result */
  toolResult?: { success: boolean; message: string };
}

/** Color palette for agent identity in group chats */
const AGENT_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4'];

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  agentId: number | null;
  agentIds?: number[];
  createdAt: number;
  updatedAt: number;
}

/** Get all agent IDs for a conversation (handles legacy + new format) */
function getConvAgentIds(conv: Conversation): number[] {
  if (conv.agentIds && conv.agentIds.length > 0) return conv.agentIds;
  if (conv.agentId != null) return [conv.agentId];
  return [];
}
function isGroupChat(conv: Conversation): boolean {
  return getConvAgentIds(conv).length > 1;
}

/* ── Conversation storage (API + localStorage cache) ────── */
const LS_CONVERSATIONS = "solo_ai_conversations";
const LS_ACTIVE_CONV = "solo_ai_active_conversation";
const LS_ACTIVE_AGENT = "solo_ai_active_agent";
const LS_ACTIVE_AGENTS = "solo_ai_active_agents";

function loadConversations(): Conversation[] {
  try {
    const saved = localStorage.getItem(LS_CONVERSATIONS);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

/** Trim messages for storage (keep last 100 per conversation) */
function trimConv(c: Conversation) {
  return {
    ...c,
    messages: c.messages.slice(-100).map(m => ({
      role: m.role, content: m.content,
      ...(m.agentId != null ? { agentId: m.agentId } : {}),
      ...(m.timestamp ? { timestamp: m.timestamp } : {}),
    })),
  };
}

function saveConversationsLocal(convs: Conversation[]) {
  const trimmed = convs.slice(0, 50).map(trimConv);
  localStorage.setItem(LS_CONVERSATIONS, JSON.stringify(trimmed));
}

/** Sync a single conversation to the API (debounced per conversation) */
const pendingSyncs = new Map<string, ReturnType<typeof setTimeout>>();
function syncConversationToAPI(conv: Conversation) {
  // Debounce per conversation — wait 1.5s after last change before saving
  const existing = pendingSyncs.get(conv.id);
  if (existing) clearTimeout(existing);
  pendingSyncs.set(conv.id, setTimeout(async () => {
    pendingSyncs.delete(conv.id);
    const trimmed = trimConv(conv);
    try {
      await api.put(`/api/conversations/${conv.id}`, {
        title: trimmed.title,
        messages: trimmed.messages,
        agent_id: trimmed.agentId,
        agent_ids: trimmed.agentIds || [],
        updated_at: new Date().toISOString(),
      });
    } catch { /* offline — localStorage is the fallback */ }
  }, 1500));
}

function generateId(): string {
  return crypto.randomUUID();
}

function generateTitle(messages: Message[], lang: string): string {
  const firstUser = messages.find(m => m.role === "user");
  if (!firstUser) return lang === "zh" ? "新对话" : "New chat";
  const text = firstUser.content.trim();
  return text.length > 30 ? text.slice(0, 30) + "..." : text;
}

/* ── Page-aware context builder ─────────────────────────────── */

function formatItemDetail(item: Record<string, unknown>, activeTab: string, currency: string): string {
  const parts: string[] = [];
  const name = (item.title || item.name || item.description || "") as string;
  parts.push(name);

  if (activeTab === "work") {
    if (item.column) parts.push(`[${item.column}]`);
    if (item.priority) parts.push(`P:${item.priority}`);
    if (item.client) parts.push(`@${item.client}`);
    if (item.due) parts.push(`due:${item.due}`);
    if (item.scope) parts.push(`(${item.scope})`);
  } else if (activeTab === "leads") {
    if (item.column) parts.push(`[${item.column}]`);
    if (item.industry) parts.push(`${item.industry}`);
    if (item.needs) parts.push(`needs:${item.needs}`);
    if (item.source) parts.push(`via:${item.source}`);
  } else if (activeTab === "clients") {
    if (item.status) parts.push(`(${item.status})`);
    if (item.billing_type) parts.push(`[${item.billing_type}]`);
    if (item.mrr != null && Number(item.mrr) > 0) parts.push(`MRR:${currency}${Number(item.mrr).toLocaleString()}`);
    if (item.project_fee != null && Number(item.project_fee) > 0) parts.push(`fee:${currency}${Number(item.project_fee).toLocaleString()}`);
    if (item.plan_tier) parts.push(`plan:${item.plan_tier}`);
  } else if (activeTab === "finance") {
    if (item.type) parts.push(`[${item.type}]`);
    if (item.category) parts.push(`${item.category}`);
    if (item.amount != null) parts.push(`${currency}${Number(item.amount).toLocaleString()}`);
    if (item.date) parts.push(`${item.date}`);
    if (item.status) parts.push(`(${item.status})`);
  } else {
    if (item.column) parts.push(`[${item.column}]`);
    if (item.status) parts.push(`(${item.status})`);
    if (item.amount != null) parts.push(`${currency}${Number(item.amount).toLocaleString()}`);
  }

  return parts.join(" ");
}

function buildAggregateStats(items: Record<string, unknown>[], activeTab: string): string[] {
  if (!items.length) return [];
  const stats: string[] = [];

  if (activeTab === "work") {
    const byCol: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let overdue = 0;
    const today = new Date().toISOString().slice(0, 10);
    for (const t of items) {
      const col = (t.column as string) || "unknown";
      byCol[col] = (byCol[col] || 0) + 1;
      const pri = (t.priority as string) || "Medium";
      byPriority[pri] = (byPriority[pri] || 0) + 1;
      if (t.due && (t.due as string).slice(0, 10) < today && col !== "done") overdue++;
    }
    stats.push(`Distribution: ${Object.entries(byCol).map(([k, v]) => `${k}=${v}`).join(", ")}`);
    stats.push(`Priority: ${Object.entries(byPriority).map(([k, v]) => `${k}=${v}`).join(", ")}`);
    if (overdue > 0) stats.push(`Overdue: ${overdue}`);
  } else if (activeTab === "leads") {
    const byCol: Record<string, number> = {};
    for (const l of items) {
      const col = (l.column as string) || "new";
      byCol[col] = (byCol[col] || 0) + 1;
    }
    stats.push(`Pipeline: ${Object.entries(byCol).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  } else if (activeTab === "finance") {
    let totalIncome = 0, totalExpense = 0;
    for (const tx of items) {
      const amt = Number(tx.amount) || 0;
      if (tx.type === "income") totalIncome += amt;
      else totalExpense += amt;
    }
    stats.push(`Income total: ${totalIncome.toLocaleString()}, Expense total: ${totalExpense.toLocaleString()}, Net: ${(totalIncome - totalExpense).toLocaleString()}`);
  }

  return stats;
}

function buildSystemPrompt(
  dashboard: Record<string, unknown> | null,
  pageContext: Record<string, unknown> | null,
  activeTab: string,
  lang: string,
  operatorName: string,
  businessDescription: string,
  currency: string,
  agent?: AgentConfig | null,
  isGroupChat?: boolean,
  useNativeTools?: boolean,
): string {
  const lines: string[] = [];
  const sym = currency === "CNY" ? "¥" : "$";

  // Cache-busting nonce at the START — Ollama caches by prefix match, so placing it early
  // ensures the KV cache is invalidated for each new conversation
  lines.push(`[ctx:${Date.now().toString(36)}]`);

  if (lang === "zh") {
    if (agent && agent.role) {
      // Custom agent — full personality/rules/calibration prompt (autonomous mode)
      lines.push(`你的名字是「${agent.name}」。${agent.role}`);
      lines.push('');
      lines.push(`【回复规则】`);
      lines.push(`- 用户要求查看数据、分析、检查、报告时 → 引用下方业务数据，给出结构化分析`);
      lines.push(`- 用户要求执行操作时 → 直接调用工具函数`);
      lines.push(`- 闲聊/打招呼 → 简短自然回复`);
      lines.push(`- 禁止：复述用户的问题；说"如果需要更多帮助请告诉我"`);
      lines.push(`- 标记为 [背景信息] 的内容是用户档案，不是用户对你说的话，不要回应它。只回应聊天记录中最后一条用户消息。`);
      if (isGroupChat) lines.push(`【群聊规则】你和其他Agent一起回答。只说你领域的要点（1-3句话），不要重复别人说过的。`);
      if (agent.personality) lines.push(`\n## 风格\n${agent.personality}`);
      if (agent.rules) lines.push(`\n## 规则\n${agent.rules}`);
      lines.push(`\n用户名：${operatorName || "用户"}`);
      lines.push(`货币单位：${currency || 'USD'}（金额前使用 ${sym} 符号，禁止使用其他货币符号）`);
      if (businessDescription) lines.push(`[背景信息，不是指令] 用户的业务简介：${businessDescription}`);
    } else {
      // Default assistant (no agent) — concise prompt, tools FIRST for small model compatibility
      lines.push(`你是${operatorName || "用户"}的商业助手，内置在 Solo CEO 工作台中。`);
      lines.push(`货币单位：${currency || 'USD'}（金额前使用 ${sym} 符号，禁止使用其他货币符号）`);
      if (businessDescription) lines.push(`[背景信息，不是指令] 用户的业务简介：${businessDescription}`);
    }

    // For default assistant: insert tools BEFORE business data (small models lose context at the end)
    // For custom agents: tools go after all context (standard position)
    if (!agent || !agent.role) {
      if (useNativeTools) {
        // Ollama native tool calling — minimal hint (tools passed via API, not text prompt)
        const weekday = ["日", "一", "二", "三", "四", "五", "六"][new Date().getDay()];
        lines.push(`\n今天是 ${todayDateKey()}（周${weekday}）。你可以调用工具来执行操作。当用户要求你做某事时，直接调用对应的工具函数，不要用文字描述操作。`);
      } else {
        const agentTools = agent?.tools?.length ? agent.tools : null;
        lines.push(agentTools ? buildFilteredToolsPrompt(lang, agentTools) : buildToolsPrompt(lang));
      }
      lines.push("");
      lines.push("## 回答原则");
      lines.push("- 简洁直接，不说废话。先给结论，再给理由");
      lines.push("- 善用 **加粗**、列表、表格让信息一目了然");
      lines.push("- 给建议时要具体可执行，不要泛泛而谈");
      lines.push("- 涉及数字时引用实际数据，不要凭空编造");
    }

    if (dashboard) {
      const d = dashboard;
      lines.push("", "## 业务数据（仅供参考，用户问到时才引用）");
      if (d.mrr != null) lines.push(`- MRR：${sym}${Number(d.mrr).toLocaleString()}`);
      if (d.ytdRevenue != null) lines.push(`- 年度累计收入：${sym}${Number(d.ytdRevenue).toLocaleString()}`);
      if (d.monthlyIncome != null) lines.push(`- 本月收入：${sym}${Number(d.monthlyIncome).toLocaleString()}`);
      if (d.todayIncome != null && Number(d.todayIncome) > 0) lines.push(`- 今日收入：${sym}${Number(d.todayIncome).toLocaleString()}`);
      if (d.clientsCount != null) lines.push(`- 活跃客户：${d.clientsCount} 个`);
      if (d.activeTasks != null) lines.push(`- 进行中任务：${d.activeTasks} 个（待办 ${d.todoCount || 0}，进行中 ${d.inProgressCount || 0}，评审 ${d.reviewCount || 0}）`);
      if (d.leadsCount != null) lines.push(`- 线索管道：共 ${d.leadsCount} 条（新线索 ${d.leadsNew || 0} / 已联系 ${d.leadsContacted || 0} / 提案中 ${d.leadsProposal || 0} / 成交 ${d.leadsWon || 0}）`);
      if (Array.isArray(d.urgentTasks) && d.urgentTasks.length > 0) {
        lines.push(`- ⚠️ 紧急/逾期：${d.urgentTasks.map((t: { title: string }) => t.title).join("、")}`);
      }
      if (Array.isArray(d.receivables) && d.receivables.length > 0) {
        const total = d.receivables.reduce((s: number, r: { amount?: number }) => s + (r.amount || 0), 0);
        lines.push(`- 待收款：${d.receivables.length} 笔，合计 ${sym}${total.toLocaleString()}`);
      }
    }

    if (pageContext && Array.isArray(pageContext.items) && pageContext.items.length > 0) {
      const tabNames: Record<string, string> = { work: "任务", leads: "线索", clients: "客户", finance: "收支" };
      lines.push("", `## 当前页面：${tabNames[activeTab] || activeTab}（共 ${pageContext.items.length} 条）`);
      const agg = buildAggregateStats(pageContext.items as Record<string, unknown>[], activeTab);
      if (agg.length) lines.push(agg.join(" | "));
      lines.push("");
      pageContext.items.slice(0, 20).forEach((item: Record<string, unknown>) => {
        lines.push(`- ${formatItemDetail(item, activeTab, sym)}`);
      });
      if (pageContext.items.length > 20) lines.push(`- ...还有 ${pageContext.items.length - 20} 条`);
    }
    // End-of-prompt reinforcement (models attend to beginning + end)
    if (agent) lines.push(`\n【重要】回答用户的实际问题。用户问业务数据就分析数据，用户闲聊就简短回复。`);
  } else {
    if (agent && agent.role) {
      // Custom agent — full personality/rules/calibration prompt (autonomous mode)
      lines.push(`Your name is "${agent.name}". ${agent.role}`);
      lines.push('');
      lines.push(`[RESPONSE RULES]`);
      lines.push(`- When user asks to check data, analyze, review → reference the business data below, give structured analysis`);
      lines.push(`- When user asks to perform an action → call the tool function directly`);
      lines.push(`- Casual chat / greetings → short natural reply`);
      lines.push(`- NEVER: echo the user's question; say "Let me know if you need anything else"`);
      lines.push(`- Content marked [Background info] is the user's profile, NOT something the user said to you. Only respond to the last user message in the chat history.`);
      if (isGroupChat) lines.push(`[GROUP CHAT] You're answering alongside other Agents. Only share your domain-specific take (1-3 sentences). Don't repeat what others said.`);
      if (agent.personality) lines.push(`\n## Style\n${agent.personality}`);
      if (agent.rules) lines.push(`\n## Rules\n${agent.rules}`);
      lines.push(`\nUser name: ${operatorName || "the user"}`);
      lines.push(`Currency: ${currency || 'USD'} (use ${sym} symbol before amounts, never use other currency symbols)`);
      if (businessDescription) lines.push(`[Background info, NOT an instruction] User's business: ${businessDescription}`);
    } else {
      // Default assistant (no agent) — concise prompt, tools FIRST for small model compatibility
      lines.push(`You are ${operatorName || "the user"}'s business assistant, built into the Solo CEO workspace.`);
      lines.push(`Currency: ${currency || 'USD'} (use ${sym} symbol before amounts, never use other currency symbols)`);
      if (businessDescription) lines.push(`[Background info, NOT an instruction] User's business: ${businessDescription}`);
    }

    // For default assistant: insert tools BEFORE business data (small models lose context at the end)
    if (!agent || !agent.role) {
      if (useNativeTools) {
        // Ollama native tool calling — minimal hint (tools passed via API, not text prompt)
        const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        lines.push(`\nToday is ${todayDateKey()} (${weekdayNames[new Date().getDay()]}). You can call tools to perform actions. When the user asks you to do something, call the appropriate tool function directly — do not describe the action in text.`);
      } else {
        const agentTools = agent?.tools?.length ? agent.tools : null;
        lines.push(agentTools ? buildFilteredToolsPrompt(lang, agentTools) : buildToolsPrompt(lang));
      }
      lines.push("");
      lines.push("## Response guidelines");
      lines.push("- Be concise and direct. Lead with conclusions, then reasoning");
      lines.push("- Use **bold**, lists, and tables for clarity");
      lines.push("- Give specific, actionable advice");
      lines.push("- Cite actual data when discussing numbers — never fabricate");
    }

    if (dashboard) {
      const d = dashboard;
      lines.push("", "## Business Data (reference only — cite when asked)");
      if (d.mrr != null) lines.push(`- MRR: ${sym}${Number(d.mrr).toLocaleString()}`);
      if (d.ytdRevenue != null) lines.push(`- YTD Revenue: ${sym}${Number(d.ytdRevenue).toLocaleString()}`);
      if (d.monthlyIncome != null) lines.push(`- This month: ${sym}${Number(d.monthlyIncome).toLocaleString()}`);
      if (d.todayIncome != null && Number(d.todayIncome) > 0) lines.push(`- Today's income: ${sym}${Number(d.todayIncome).toLocaleString()}`);
      if (d.clientsCount != null) lines.push(`- Active clients: ${d.clientsCount}`);
      if (d.activeTasks != null) lines.push(`- Active tasks: ${d.activeTasks} (todo ${d.todoCount || 0}, in progress ${d.inProgressCount || 0}, review ${d.reviewCount || 0})`);
      if (d.leadsCount != null) lines.push(`- Leads: ${d.leadsCount} total (new ${d.leadsNew || 0} / contacted ${d.leadsContacted || 0} / proposal ${d.leadsProposal || 0} / won ${d.leadsWon || 0})`);
      if (Array.isArray(d.urgentTasks) && d.urgentTasks.length > 0) {
        lines.push(`- ⚠️ Urgent/overdue: ${d.urgentTasks.map((t: { title: string }) => t.title).join(", ")}`);
      }
      if (Array.isArray(d.receivables) && d.receivables.length > 0) {
        const total = d.receivables.reduce((s: number, r: { amount?: number }) => s + (r.amount || 0), 0);
        lines.push(`- Receivables: ${d.receivables.length} pending, total ${sym}${total.toLocaleString()}`);
      }
    }

    if (pageContext && Array.isArray(pageContext.items) && pageContext.items.length > 0) {
      lines.push("", `## Current Page: ${activeTab} (${pageContext.items.length} items)`);
      const agg = buildAggregateStats(pageContext.items as Record<string, unknown>[], activeTab);
      if (agg.length) lines.push(agg.join(" | "));
      lines.push("");
      pageContext.items.slice(0, 20).forEach((item: Record<string, unknown>) => {
        lines.push(`- ${formatItemDetail(item, activeTab, sym)}`);
      });
      if (pageContext.items.length > 20) lines.push(`- ...and ${pageContext.items.length - 20} more`);
    }
    // End-of-prompt reinforcement (models attend to beginning + end)
    if (agent) lines.push(lang === 'zh'
      ? `\n【重要】回答用户的实际问题。用户问业务数据就分析数据，用户闲聊就简短回复。`
      : `\n[IMPORTANT] Answer the user's actual question. If they ask about business data, analyze the data. If they're chatting casually, reply briefly.`);
  }

  // Append agent tools — only for custom agents (default assistant already inserted tools earlier)
  if (agent && agent.role) {
    if (useNativeTools) {
      // Ollama native tool calling — include weekday + date parsing hint
      const td = todayDateKey();
      const weekdayZh = ["日", "一", "二", "三", "四", "五", "六"][new Date().getDay()];
      const weekdayEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];
      const hint = lang === "zh"
        ? `\n今天是 ${td}（周${weekdayZh}）。用户提到"明天""下周五""月底"等相对日期时，请推算出具体 YYYY-MM-DD。你可以调用工具来执行操作。用户要求做某事时，直接调用工具函数。`
        : `\nToday is ${td} (${weekdayEn}). Calculate YYYY-MM-DD for relative dates like "tomorrow", "next Friday". You can call tools to perform actions. When asked, call the tool function directly.`;
      lines.push(hint);
    } else {
      const agentTools = agent.tools?.length ? agent.tools : null;
      lines.push(agentTools ? buildFilteredToolsPrompt(lang, agentTools) : buildToolsPrompt(lang));
    }
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
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for non-HTTPS or restricted environments
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="lg:opacity-0 lg:group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-[var(--color-bg-tertiary)]"
      style={{ color: "var(--color-text-quaternary)" }}
      aria-label="Copy"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
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
      a: ({ href, children }) => {
        const safeHref = /^\s*(javascript|data|vbscript):/i.test(href ?? "") ? "#" : href;
        return (
          <a href={safeHref} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--color-accent)" }}>
            {children}
          </a>
        );
      },
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

/* ── AI connection status ─────────────────────────────────── */
const PROVIDER_LABELS: Record<string, string> = {
  gemini: "Gemini",
  claude: "Claude",
  openai: "OpenAI",
  ollama: "Ollama",
};

function AIConnectionStatus({ settings }: { settings: Record<string, string> | null }) {
  const config = getAIConfig(settings);
  const connected = !!config;
  const label = (() => {
    if (!config) return '未连接';
    if (config.provider === 'ollama') {
      const { model } = getOllamaConfig();
      return model;
    }
    return PROVIDER_LABELS[config.provider] || config.provider;
  })();

  return (
    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--color-text-quaternary)' }}>
      <span
        className="inline-block w-[5px] h-[5px] rounded-full shrink-0"
        style={{ background: connected ? 'var(--color-success)' : 'var(--color-text-quaternary)' }}
      />
      <span className="truncate">{label}</span>
    </div>
  );
}

/* ── Conversation list view ───────────────────────────────── */
function ConversationList({
  conversations,
  activeId,
  onSelect,
  onDelete,
  onNew,
  lang,
  agents,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  lang: string;
  agents: AgentConfig[];
}) {
  const agentMap = React.useMemo(() => {
    const m = new Map<number, AgentConfig>();
    agents.forEach(a => m.set(a.id, a));
    return m;
  }, [agents]);
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString(lang === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit" });
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return lang === "zh" ? "昨天" : "Yesterday";
    return d.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-3 py-2 shrink-0">
        <button
          onClick={onNew}
          className="ai-chat-new-btn w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[14px] transition-colors press-feedback"
          style={{
            background: "var(--color-accent)",
            color: "var(--color-brand-text)",
          }}
        >
          <Plus size={16} />
          <span>{lang === "zh" ? "新对话" : "New chat"}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 opacity-40">
            <MessagesSquare size={24} style={{ color: "var(--color-text-quaternary)" }} />
            <p className="text-[13px]" style={{ color: "var(--color-text-tertiary)" }}>
              {lang === "zh" ? "还没有对话" : "No conversations yet"}
            </p>
          </div>
        ) : (
          conversations.map((conv) => {
            const convAgentIds = getConvAgentIds(conv);
            const convAgents = convAgentIds.map(id => agentMap.get(id)).filter(Boolean);
            const convIsGroup = convAgents.length > 1;
            return (
            <div
              key={conv.id}
              className={`ai-chat-conv-item group flex items-center gap-2.5 px-3.5 py-3 rounded-xl cursor-pointer transition-all ${conv.id === activeId ? 'ai-chat-conv-active' : 'ai-chat-conv-inactive'}`}
              style={{
                background: conv.id === activeId ? "var(--color-bg-tertiary)" : "var(--color-bg-secondary)",
                border: conv.id === activeId ? "1px solid var(--color-accent)" : "1px solid var(--color-line-tertiary)",
              }}
              onClick={() => onSelect(conv.id)}
            >
              {convIsGroup ? (
                /* Stacked avatars for group chat */
                <div className="shrink-0 relative" style={{ width: 32, height: 32 }}>
                  {convAgents.slice(0, 3).map((a, idx) => (
                    <span
                      key={a!.id}
                      className="absolute flex items-center justify-center rounded-full text-[11px]"
                      style={{
                        width: 20,
                        height: 20,
                        background: conv.id === activeId ? "var(--color-accent)" : "var(--color-bg-tertiary)",
                        border: "2px solid var(--color-bg-secondary)",
                        top: idx * 6,
                        left: idx * 6,
                        zIndex: 3 - idx,
                      }}
                    >
                      {a!.avatar}
                    </span>
                  ))}
                </div>
              ) : (
                <div
                  className="shrink-0 flex items-center justify-center rounded-lg text-[15px]"
                  style={{
                    width: 32,
                    height: 32,
                    background: conv.id === activeId ? "var(--color-accent)" : "var(--color-bg-tertiary)",
                  }}
                >
                  <span>{convAgents[0]?.avatar || '🤖'}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                {/* Agent/Group name — Teams style */}
                <p className="text-[13px] truncate" style={{ color: "var(--color-text-primary)", fontWeight: conv.id === activeId ? 600 : 500 }}>
                  {convIsGroup
                    ? (convAgents.length <= 3
                        ? convAgents.map(a => a!.name).join(", ")
                        : `${convAgents.slice(0, 2).map(a => a!.name).join(", ")} +${convAgents.length - 2}`)
                    : convAgents[0]?.name || (lang === "zh" ? "AI 助手" : "Assistant")
                  }
                </p>
                {/* Last message preview or topic */}
                <p className="text-[12px] truncate mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
                  {conv.title}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-quaternary)" }}>
                  {conv.messages.length} {lang === "zh" ? "条消息" : "msgs"} · {formatTime(conv.updatedAt)}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                className="lg:opacity-0 lg:group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-[var(--color-bg-primary)]"
                style={{ color: "var(--color-text-quaternary)" }}
                aria-label="Delete"
              >
                <Trash2 size={13} />
              </button>
            </div>
          );})
        )}
      </div>
    </div>
  );
}

/* ── Tool call parser ──────────────────────────────────────── */

/** Try to extract a tool_call JSON from the AI response text */
function parseToolCall(text: string): ToolCall | null {
  try {
    // Try direct parse
    const direct = JSON.parse(text.trim());
    if (direct?.tool_call?.name) return direct.tool_call;
  } catch { /* not pure JSON */ }

  // Try extracting from markdown code fence
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (parsed?.tool_call?.name) return parsed.tool_call;
    } catch { /* skip */ }
  }

  // Try extracting any {"tool_call": ...} block (greedy to catch nested objects)
  const jsonMatch = text.match(/\{\s*"tool_call"\s*:\s*\{[^}]*"name"\s*:\s*"[^"]+"\s*,\s*"args"\s*:\s*\{[^}]*\}\s*\}\s*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed?.tool_call?.name) return parsed.tool_call;
    } catch { /* skip */ }
  }

  // Fallback: broader regex for any {"tool_call": {...}} pattern
  const broadMatch = text.match(/\{\s*"tool_call"\s*:\s*\{[\s\S]*?\}\s*\}/);
  if (broadMatch) {
    try {
      const parsed = JSON.parse(broadMatch[0]);
      if (parsed?.tool_call?.name) return parsed.tool_call;
    } catch { /* skip */ }
  }

  return null;
}

/* ── Tool confirmation card ──────────────────────────────── */

function ToolConfirmCard({
  confirm,
  onConfirm,
  onReject,
  onUpdateArgs,
  lang,
  executing,
  result,
}: {
  confirm: ToolConfirmInfo;
  onConfirm: () => void;
  onReject: () => void;
  onUpdateArgs?: (args: Record<string, unknown>) => void;
  lang: string;
  executing: boolean;
  result?: { success: boolean; message: string } | null;
}) {
  const isZh = lang === "zh";
  const isTransaction = confirm.toolName === "record_transaction";
  const scope = (confirm.args.scope as string) || "business";

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: "1px solid var(--color-line-secondary)",
        background: "var(--color-bg-secondary)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{
          background: "var(--color-accent-tint)",
          borderBottom: "1px solid var(--color-line-tertiary)",
        }}
      >
        <Zap size={14} style={{ color: "var(--color-accent)" }} />
        <span className="text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>
          {confirm.label}
        </span>
      </div>

      {/* Details */}
      <div className="px-3 py-2 space-y-0.5">
        {confirm.details.map((d, i) => (
          <p key={i} className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
            {d}
          </p>
        ))}
      </div>

      {/* Scope selector for transactions */}
      {isTransaction && !result && onUpdateArgs && (
        <div className="px-3 pb-2 flex items-center gap-2">
          <span className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
            {isZh ? "归属：" : "Scope:"}
          </span>
          <div className="page-tabs" style={{ fontSize: 12 }}>
            {(["business", "personal"] as const).map(s => (
              <button
                key={s}
                data-active={scope === s}
                onClick={() => {
                  const personalCats = new Set(["餐饮", "交通", "房租", "娱乐", "个人其他"]);
                  const curCat = confirm.args.category as string || "";
                  const isPersonal = s === "personal";
                  // Auto-fix category if it doesn't match the new scope
                  let newCat = curCat;
                  if (isPersonal && !personalCats.has(curCat)) {
                    newCat = confirm.args.type === "income" ? "个人其他" : "餐饮";
                  } else if (!isPersonal && personalCats.has(curCat)) {
                    newCat = confirm.args.type === "income" ? "收入" : "其他支出";
                  }
                  onUpdateArgs({ ...confirm.args, scope: s, category: newCat });
                }}
                className="px-2 py-1"
                style={{ fontSize: 12 }}
              >
                {s === "business" ? (isZh ? "公司" : "Business") : (isZh ? "个人" : "Personal")}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions or result */}
      {result ? (
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{
            borderTop: "1px solid var(--color-line-tertiary)",
            color: result.success ? "var(--color-success)" : "var(--color-danger)",
          }}
        >
          {result.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          <span className="text-[13px]">{result.success ? (isZh ? "已执行" : "Done") : (isZh ? "失败" : "Failed")}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2" style={{ borderTop: "1px solid var(--color-line-tertiary)" }}>
          <button
            onClick={onConfirm}
            disabled={executing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50"
            style={{
              background: "var(--color-accent)",
              color: "var(--color-brand-text)",
            }}
          >
            {executing ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            {isZh ? "确认执行" : "Confirm"}
          </button>
          <button
            onClick={onReject}
            disabled={executing}
            className="px-3 py-1.5 rounded-lg text-[13px] transition-colors disabled:opacity-50"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {isZh ? "取消" : "Cancel"}
          </button>
        </div>
      )}
    </div>
  );
}

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
  const operatorName = useSettingsStore((s) => s.operatorName);
  const operatorAvatar = useSettingsStore((s) => s.operatorAvatar);
  const businessDesc = useSettingsStore((s) => {
    const parts: string[] = [];
    if (s.businessTitle) parts.push(s.businessTitle);
    if (s.businessName) parts.push(`@${s.businessName}`);
    if (s.businessLocation) parts.push(`📍${s.businessLocation}`);
    if (s.businessDescription) parts.push(`— ${s.businessDescription}`);
    return parts.join(' ') || s.businessDescription;
  });
  const currency = useSettingsStore((s) => s.currency);

  // Agents
  const { agents, loading: agentsLoading, seedDefaults, seedMissing } = useAgents();
  const [activeAgentIds, setActiveAgentIds] = useState<number[]>(() => {
    const savedMulti = localStorage.getItem(LS_ACTIVE_AGENTS);
    if (savedMulti) { try { return JSON.parse(savedMulti); } catch { /* fall through */ } }
    const savedSingle = localStorage.getItem(LS_ACTIVE_AGENT);
    return savedSingle ? [Number(savedSingle)] : [];
  });
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const activeAgents = agents.filter(a => activeAgentIds.includes(a.id));
  const activeAgent = activeAgents[0] || null; // primary agent (backward compat)
  const isMultiAgent = activeAgents.length > 1;
  const agentMap = React.useMemo(() => {
    const m = new Map<number, AgentConfig>();
    agents.forEach(a => m.set(a.id, a));
    return m;
  }, [agents]);

  // Seed default agents for first-time users + seed missing templates on upgrade
  // Module-level flag ensures seeding runs AT MOST ONCE per page load session,
  // preventing race conditions where resetAll/delete triggers re-seeding.
  const seededOnceRef = useRef(false);
  useEffect(() => {
    if (agentsLoading || seededOnceRef.current) return;
    seededOnceRef.current = true; // lock BEFORE async — no second entry possible
    const l = (lang as 'zh' | 'en') || 'en';
    if (agents.length === 0 && !localStorage.getItem('solo_agents_seeded')) {
      // True first-time user — seed defaults
      seedDefaults(l).then(() => {
        localStorage.setItem('solo_agents_seeded', '1');
      }).catch(() => {});
    } else if (agents.length > 0) {
      // Existing user — seed any new templates added in updates
      seedMissing(l, agents).catch(() => {});
    }
  }, [agentsLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // First-ever use (null = never set): persist empty array → default assistant mode
  useEffect(() => {
    const saved = localStorage.getItem(LS_ACTIVE_AGENTS);
    if (saved === null && agents.length > 0) {
      // Explicitly save empty = default assistant chosen
      localStorage.setItem(LS_ACTIVE_AGENTS, '[]');
    }
  }, [agents]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up stale agent IDs when agents load
  useEffect(() => {
    if (agents.length > 0 && activeAgentIds.length > 0) {
      const validIds = activeAgentIds.filter(id => agents.some(a => a.id === id));
      if (validIds.length !== activeAgentIds.length) {
        // Remove stale IDs; if all were stale, fall back to empty (default assistant mode)
        setActiveAgentIds(validIds);
      }
    }
  }, [agents]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist active agents (empty array = explicit "default assistant" choice)
  useEffect(() => {
    localStorage.setItem(LS_ACTIVE_AGENTS, JSON.stringify(activeAgentIds));
    if (activeAgentIds.length > 0) {
      localStorage.setItem(LS_ACTIVE_AGENT, String(activeAgentIds[0]));
    } else {
      localStorage.removeItem(LS_ACTIVE_AGENT);
    }
  }, [activeAgentIds]);

  // Ref for reading fresh conversations inside async loops
  const conversationsRef = useRef<Conversation[]>([]);

  // Multi-conversation state
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [activeConvId, setActiveConvId] = useState<string | null>(() => {
    return localStorage.getItem(LS_ACTIVE_CONV) || null;
  });
  const [showList, setShowList] = useState(false);

  const activeConv = conversations.find(c => c.id === activeConvId) || null;
  const messages = activeConv?.messages || [];
  const activeConvAgentIds = activeConv ? getConvAgentIds(activeConv) : [];
  const isGroupConv = activeConvAgentIds.length > 1;

  const [input, setInput] = useState("");
  const [streamingConvId, setStreamingConvId] = useState<string | null>(null);
  const isStreaming = streamingConvId !== null;
  const isStreamingHere = streamingConvId !== null && streamingConvId === activeConvId; // only block THIS conversation
  const [executingTool, setExecutingTool] = useState(false);
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [pageContext, setPageContext] = useState<Record<string, unknown> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const hasAI = !!getAIConfig(settings);

  // Persist conversations (also update ref for async loops)
  // IMPORTANT: Update ref OUTSIDE setConversations to guarantee synchronous visibility.
  // React 18 may batch state updaters and defer them to the render phase, so code that
  // reads conversationsRef.current immediately after updateConversations() would see stale data.
  const updateConversations = useCallback((updater: (prev: Conversation[]) => Conversation[]) => {
    const next = updater(conversationsRef.current);
    conversationsRef.current = next;
    saveConversationsLocal(next);
    setConversations(prev => {
      // Re-apply updater to React's prev state (may differ from ref due to batching)
      const stateNext = updater(prev);
      conversationsRef.current = stateNext;
      // Sync changed conversations to API
      const prevIds = new Set(prev.map(c => `${c.id}:${c.updatedAt}:${c.messages.length}`));
      stateNext.forEach(c => {
        if (!prevIds.has(`${c.id}:${c.updatedAt}:${c.messages.length}`)) {
          syncConversationToAPI(c);
        }
      });
      return stateNext;
    });
  }, []);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  // Abort any in-flight streaming request on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // Load conversations from API on mount (merge with localStorage cache)
  const apiLoadedRef = useRef(false);
  useEffect(() => {
    if (apiLoadedRef.current) return;
    apiLoadedRef.current = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api.get<any[]>('/api/conversations').then(rawConvs => {
      if (!Array.isArray(rawConvs) || rawConvs.length === 0) return;
      // Map snake_case API fields → camelCase Conversation interface
      const apiConvs: Conversation[] = rawConvs.map(r => ({
        id: r.id,
        title: r.title || '',
        messages: Array.isArray(r.messages) ? r.messages : [],
        agentId: r.agent_id ?? r.agentId ?? null,
        agentIds: Array.isArray(r.agent_ids) ? r.agent_ids : (Array.isArray(r.agentIds) ? r.agentIds : undefined),
        createdAt: r.created_at ? new Date(r.created_at).getTime() : (r.createdAt || Date.now()),
        updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : (r.updatedAt || Date.now()),
      }));
      setConversations(prev => {
        // Merge: API wins for existing, keep local-only ones
        const apiMap = new Map(apiConvs.map(c => [c.id, c]));
        const merged = [...apiConvs];
        for (const local of prev) {
          if (!apiMap.has(local.id)) {
            merged.push(local);
            // Push local-only to API
            api.post('/api/conversations', {
              id: local.id, title: local.title,
              agent_id: local.agentId, agent_ids: local.agentIds || [],
              messages: local.messages, created_at: new Date(local.createdAt).toISOString(),
            }).catch(() => {});
          }
        }
        merged.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        const final = merged.slice(0, 50);
        conversationsRef.current = final;
        saveConversationsLocal(final);
        return final;
      });
    }).catch(() => { /* offline — localStorage is the fallback */ });
  }, []);

  // Persist active conversation id
  useEffect(() => {
    if (activeConvId) {
      localStorage.setItem(LS_ACTIVE_CONV, activeConvId);
    } else {
      localStorage.removeItem(LS_ACTIVE_CONV);
    }
  }, [activeConvId]);

  // Fetch dashboard when panel opens
  // Refresh dashboard & page context each time panel opens or tab changes
  const dashboardFetchRef = useRef(0);
  useEffect(() => {
    if (!open) return;
    const now = Date.now();
    // Refresh dashboard if stale (>30s) or first load
    if (!dashboard || now - dashboardFetchRef.current > 30_000) {
      dashboardFetchRef.current = now;
      api.get("/api/dashboard").then((d) => setDashboard(d as Record<string, unknown>)).catch(() => {});
    }
    fetchPageContext(activeTab).then(setPageContext);
  }, [open, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened or switched conversation; clear stale UI states; sync picker
  useEffect(() => {
    if (open && !showList) setTimeout(() => inputRef.current?.focus(), 100);
    setMentionQuery(null);
    setShowAgentPicker(false);
    // Sync agent picker to current conversation's agents (on mount + switch)
    if (activeConvId) {
      const conv = conversationsRef.current.find(c => c.id === activeConvId);
      if (conv) {
        const convAgentIds = getConvAgentIds(conv);
        if (convAgentIds.length > 0) setActiveAgentIds(convAgentIds);
      }
    }
  }, [open, showList, activeConvId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Textarea auto-resize
  // @mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionAgents = React.useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    const convIds = activeConv ? getConvAgentIds(activeConv) : activeAgentIds;
    return agents.filter(a => convIds.includes(a.id) && (q === "" || a.name.toLowerCase().includes(q)));
  }, [mentionQuery, agents, activeConv, activeAgentIds]);

  // Reset mention index when list changes
  useEffect(() => { setMentionIndex(0); }, [mentionAgents.length]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";

    // Detect @mention — look for @ followed by partial name at cursor
    const cursor = el.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursor);
    const atMatch = textBeforeCursor.match(/@([^\s@]*)$/);
    if (atMatch && (activeConv ? isGroupChat(activeConv) : isMultiAgent)) {
      setMentionQuery(atMatch[1]);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (agent: AgentConfig) => {
    const cursor = inputRef.current?.selectionStart || input.length;
    const textBefore = input.slice(0, cursor);
    const textAfter = input.slice(cursor);
    const atPos = textBefore.lastIndexOf("@");
    const newText = textBefore.slice(0, atPos) + `@${agent.name} ` + textAfter;
    setInput(newText);
    setMentionQuery(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleClose = () => {
    if (abortRef.current) abortRef.current.abort();
    onClose();
    setInput("");
    setStreamingConvId(null);
    setDashboard(null);
    setPageContext(null);
    setShowList(false);
  };

  const handleNewConversation = () => {
    const newConv: Conversation = {
      id: generateId(),
      title: lang === "zh" ? "新对话" : "New chat",
      messages: [],
      agentId: activeAgentIds[0] || null,
      agentIds: activeAgentIds.length > 0 ? [...activeAgentIds] : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    updateConversations(prev => [newConv, ...prev]);
    setActiveConvId(newConv.id);
    setShowList(false);
    // Create on API
    api.post('/api/conversations', {
      id: newConv.id, title: newConv.title,
      agent_id: newConv.agentId, agent_ids: newConv.agentIds || [],
      messages: [],
    }).catch(() => {});
  };

  const handleSelectConversation = (id: string) => {
    setActiveConvId(id);
    setShowList(false);
    // Sync agent picker to show THIS conversation's agents
    const conv = conversationsRef.current.find(c => c.id === id);
    if (conv) {
      const convAgentIds = getConvAgentIds(conv);
      if (convAgentIds.length > 0) {
        setActiveAgentIds(convAgentIds);
      }
    }
  };

  const handleDeleteConversation = (id: string) => {
    // Abort streaming if deleting the actively streaming conversation
    if (streamingConvId === id) {
      abortRef.current?.abort();
      setStreamingConvId(null);
    }
    updateConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvId === id) {
      setActiveConvId(null);
    }
    // Delete from API
    api.del(`/api/conversations/${id}`).catch(() => {});
  };

  /**
   * Autonomous agent execution loop.
   * Agent can chain up to MAX_STEPS tool calls (search → create → etc.) in one turn.
   * Reads tool call from AI response → executes → feeds result back → repeats.
   */
  const MAX_AGENT_STEPS = 6;

  const streamOneAgent = useCallback(async (
    convId: string, agent: AgentConfig | null, aiConfig: { provider: string; apiKey: string },
    abort: AbortController,
  ) => {
    const conv = conversationsRef.current.find(c => c.id === convId);
    const currentMsgs = conv?.messages || [];
    const isGroup = conv ? isGroupChat(conv) : false;

    // Build system prompt for THIS agent
    const useNativeTools = aiConfig.provider === "ollama";
    const sym = currency === "CNY" ? "¥" : "$";
    const systemPrompt = buildSystemPrompt(dashboard, pageContext, activeTab, lang, operatorName, businessDesc, currency, agent, isGroup, useNativeTools);

    // Build chat history — skip cancelled tool confirmations, prefix group agent names
    const chatHistory: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...currentMsgs
        .filter(m => !m.streaming && !m.toolConfirm) // exclude pending confirmations
        .filter(m => !(m.toolResult && !m.toolResult.success && m.content.startsWith('~~'))) // exclude skipped confirmations
        .slice(-20)
        .map(m => {
          if (isGroup && m.role === "assistant" && m.agentId && m.agentId !== agent?.id) {
            const otherName = agentMap.get(m.agentId)?.name || 'Assistant';
            return { role: m.role as "user" | "assistant", content: `[${otherName}]: ${m.content}` };
          }
          return { role: m.role as "user" | "assistant", content: m.content };
        }),
    ];

    // Add placeholder for this agent
    const placeholder: Message = { role: "assistant", content: "", streaming: true, agentId: agent?.id || null, timestamp: Date.now() };
    updateConversations(prev => prev.map(c => {
      if (c.id !== convId) return c;
      return { ...c, messages: [...c.messages, placeholder], updatedAt: Date.now() };
    }));

    // Track executed actions for this turn
    const executedActions: string[] = [];
    let stepCount = 0;

    // --- Autonomous execution loop ---
    while (stepCount < MAX_AGENT_STEPS && !abort.signal.aborted) {
      stepCount++;

      // For Ollama, pass native tool definitions for reliable function calling
      const allowedToolNames = agent?.tools?.length ? agent.tools : null;
      const nativeTools: NativeToolDef[] | undefined = aiConfig.provider === "ollama"
        ? (allowedToolNames
            ? AGENT_TOOLS.filter(t => allowedToolNames.includes(t.name))
            : AGENT_TOOLS
          )
        : undefined;

      const result = await streamChat(
        aiConfig.provider as AIProvider,
        aiConfig.apiKey,
        chatHistory,
        (chunk) => {
          updateConversations(prev => prev.map(c => {
            if (c.id !== convId) return c;
            const msgs = [...c.messages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === "assistant" && last.streaming) {
              msgs[msgs.length - 1] = { ...last, content: last.content + chunk };
            }
            return { ...c, messages: msgs, updatedAt: Date.now() };
          }));
        },
        abort.signal,
        nativeTools,
      );

      // Check native tool calls first (from Ollama's function calling), then fall back to text parsing
      const toolCall: ToolCall | null = result.toolCalls?.[0]
        ? { name: result.toolCalls[0].name, args: result.toolCalls[0].args }
        : parseToolCall(result.text);

      if (!toolCall) {
        // No tool call — agent is done (final text response)
        if (result.truncated) {
          const hint = lang === "zh" ? "\n\n---\n⚠️ *回答已达长度限制，发送「继续」可接着生成。*" : "\n\n---\n⚠️ *Response was truncated. Send \"continue\" to keep generating.*";
          updateConversations(prev => prev.map(c => {
            if (c.id !== convId) return c;
            const msgs = [...c.messages]; const last = msgs[msgs.length - 1];
            if (last && last.role === "assistant") msgs[msgs.length - 1] = { ...last, content: last.content + hint };
            return { ...c, messages: msgs };
          }));
        }
        break; // Exit loop — agent finished naturally
      }

      // --- Tool call detected — execute it ---
      // Enforce agent tool permissions (prevent AI hallucinating unauthorized tools)
      const allowedNames = agent?.tools?.length ? agent.tools : null;
      if (allowedNames && !allowedNames.includes(toolCall.name)) {
        // Agent called a tool it doesn't have — feed error back and continue
        chatHistory.push({ role: "assistant" as const, content: result.text });
        chatHistory.push({ role: "user" as const, content: `[System: tool "${toolCall.name}" is not available to you. Your tools are: ${allowedNames.join(', ')}. Answer the user directly or use an available tool.]` });
        updateConversations(prev => prev.map(c => {
          if (c.id !== convId) return c;
          const msgs = [...c.messages]; const last = msgs[msgs.length - 1];
          if (last && last.role === "assistant") msgs[msgs.length - 1] = { ...last, content: "", streaming: true };
          return { ...c, messages: msgs };
        }));
        continue;
      }
      const safety = TOOL_SAFETY[toolCall.name] || "write";
      const isRead = safety === "read";

      // Extract any text the agent wrote BEFORE the tool call JSON
      // Use non-greedy match to avoid stripping legitimate content after the JSON
      const textBeforeCall = result.text.replace(/```json[\s\S]*?```/g, '').replace(/\{\s*"tool_call"\s*:[\s\S]*?\}\s*\}\s*\}/g, '').trim();

      // All write/destructive tools require user confirmation (prevents wrong auto-execution)
      if (!isRead) {
        const confirmInfo = buildConfirmInfo(toolCall, lang, sym);
        updateConversations(prev => prev.map(c => {
          if (c.id !== convId) return c;
          const msgs = [...c.messages]; const last = msgs[msgs.length - 1];
          if (last && last.role === "assistant") {
            msgs[msgs.length - 1] = { ...last, content: textBeforeCall || confirmInfo.label, toolConfirm: confirmInfo, streaming: false };
          }
          return { ...c, messages: msgs, updatedAt: Date.now() };
        }));
        break; // Exit loop — wait for user to confirm/cancel
      }

      // Show inline execution status
      const statusEmoji = isRead ? "🔍" : "⚡";
      const statusLabel = isRead
        ? (lang === "zh" ? `${statusEmoji} 正在搜索...` : `${statusEmoji} Searching...`)
        : (lang === "zh" ? `${statusEmoji} 正在执行: ${buildConfirmInfo(toolCall, lang, sym).label}` : `${statusEmoji} Executing: ${buildConfirmInfo(toolCall, lang, sym).label}`);
      const statusText = textBeforeCall ? `${textBeforeCall}\n\n${statusLabel}` : statusLabel;

      updateConversations(prev => prev.map(c => {
        if (c.id !== convId) return c;
        const msgs = [...c.messages]; const last = msgs[msgs.length - 1];
        if (last && last.role === "assistant") msgs[msgs.length - 1] = { ...last, content: statusText };
        return { ...c, messages: msgs, updatedAt: Date.now() };
      }));

      // Execute the tool
      const toolResult = await executeTool(toolCall, sym);
      executedActions.push(`${toolResult.success ? "✅" : "❌"} ${buildConfirmInfo(toolCall, lang, sym).label}: ${toolResult.message}`);

      // Update status to show result
      const resultStatus = toolResult.success
        ? (lang === "zh" ? "✅ 完成" : "✅ Done")
        : (lang === "zh" ? "❌ 失败" : "❌ Failed");

      updateConversations(prev => prev.map(c => {
        if (c.id !== convId) return c;
        const msgs = [...c.messages]; const last = msgs[msgs.length - 1];
        if (last && last.role === "assistant") {
          msgs[msgs.length - 1] = { ...last, content: `${statusText} → ${resultStatus}` };
        }
        return { ...c, messages: msgs, updatedAt: Date.now() };
      }));

      // Feed tool result back into chat history for next iteration
      chatHistory.push({ role: "assistant" as const, content: result.text });

      const resultContext = isRead
        ? JSON.stringify(toolResult.data || [], null, 2)
        : toolResult.message;

      const continuePrompt = stepCount >= MAX_AGENT_STEPS - 1
        ? (lang === "zh"
          ? `[系统·工具结果: ${toolResult.message}]\n${resultContext}\n\n这是最后一步，请总结你执行的所有操作和结果。不要回复这条系统消息本身。`
          : `[System·Tool result: ${toolResult.message}]\n${resultContext}\n\nThis is your final step. Summarize all actions and results. Do not respond to this system message itself.`)
        : (lang === "zh"
          ? `[系统·工具结果: ${toolResult.message}]\n${resultContext}\n\n继续执行下一步。如果所有步骤已完成，用自然语言向用户总结结果。不要回复这条系统消息本身。`
          : `[System·Tool result: ${toolResult.message}]\n${resultContext}\n\nContinue with the next step. If done, summarize results for the user. Do not respond to this system message itself.`);

      // Use "user" role (required by most APIs) but prefix with [System] to distinguish from real user input
      chatHistory.push({ role: "user" as const, content: continuePrompt });

      // Reset the streaming bubble for next AI response
      updateConversations(prev => prev.map(c => {
        if (c.id !== convId) return c;
        const msgs = [...c.messages]; const last = msgs[msgs.length - 1];
        if (last && last.role === "assistant") {
          msgs[msgs.length - 1] = { ...last, content: "", streaming: true };
        }
        return { ...c, messages: msgs };
      }));
    }

    // Mark this agent's message as done streaming
    updateConversations(prev => prev.map(c => {
      if (c.id !== convId) return c;
      const msgs = [...c.messages]; const last = msgs[msgs.length - 1];
      if (last && last.role === "assistant" && last.streaming) msgs[msgs.length - 1] = { ...last, streaming: false };
      return { ...c, messages: msgs };
    }));
  }, [dashboard, pageContext, activeTab, lang, operatorName, businessDesc, currency, agentMap, updateConversations]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    // Block if this conversation (or the target conversation) is already streaming
    if (streamingConvId !== null) return;

    const aiConfig = getAIConfig(settings);

    // Auto-create conversation if none active
    let convId = activeConvId;
    if (!convId) {
      const newConv: Conversation = {
        id: generateId(),
        title: text.length > 30 ? text.slice(0, 30) + "..." : text,
        messages: [],
        agentId: activeAgentIds[0] || null,
        agentIds: activeAgentIds.length > 0 ? [...activeAgentIds] : undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      updateConversations(prev => [newConv, ...prev]);
      convId = newConv.id;
      setActiveConvId(convId);
      // Create on API
      api.post('/api/conversations', {
        id: newConv.id, title: newConv.title,
        agent_id: newConv.agentId, agent_ids: newConv.agentIds || [],
        messages: [],
      }).catch(() => {});
    }

    if (!aiConfig) {
      updateConversations(prev => prev.map(c => {
        if (c.id !== convId) return c;
        const newMsgs = [...c.messages, { role: "user" as const, content: text, timestamp: Date.now() }, { role: "assistant" as const, content: t("ai.chat.noProvider"), timestamp: Date.now() }];
        return { ...c, messages: newMsgs, title: generateTitle(newMsgs, lang), updatedAt: Date.now() };
      }));
      return;
    }

    // Auto-cancel any pending tool confirmations before adding new message
    // (prevents stale tool context from polluting AI's next response)
    updateConversations(prev => prev.map(c => {
      if (c.id !== convId) return c;
      const hasUnresolved = c.messages.some(m => m.toolConfirm);
      if (!hasUnresolved) return c;
      return {
        ...c,
        messages: c.messages.map(m =>
          m.toolConfirm
            ? { ...m, content: `~~${m.content}~~ *(${lang === "zh" ? "已跳过" : "skipped"})*`, toolConfirm: undefined, toolResult: { success: false, message: lang === "zh" ? "用户发送了新消息" : "User sent a new message" } }
            : m
        ),
      };
    }));

    // Add user message
    updateConversations(prev => prev.map(c => {
      if (c.id !== convId) return c;
      const newMsgs = [...c.messages, { role: "user" as const, content: text, timestamp: Date.now() }];
      return { ...c, messages: newMsgs, title: generateTitle(newMsgs, lang), updatedAt: Date.now() };
    }));
    setStreamingConvId(convId);

    // Determine responding agents — @mention routing
    const conv = conversationsRef.current.find(c => c.id === convId);
    const convAgentIds = conv ? getConvAgentIds(conv) : activeAgentIds;
    const resolved = convAgentIds.length > 0
      ? convAgentIds.map(id => agentMap.get(id) || null).filter(Boolean)
      : [];
    let respondingAgents: (AgentConfig | null)[] = resolved.length > 0
      ? resolved
      : (activeAgent ? [activeAgent] : [null]); // fallback to default assistant

    // Parse @mentions — if found, only those agents respond
    const mentionPattern = /@(\S+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionPattern.exec(text)) !== null) mentions.push(match[1]);
    if (mentions.length > 0 && convAgentIds.length > 0) {
      const mentioned = respondingAgents.filter(a =>
        a && mentions.some(m => a.name.toLowerCase().startsWith(m.toLowerCase()))
      );
      if (mentioned.length > 0) respondingAgents = mentioned;
    }

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      // Sequential loop — each agent responds in turn (per-agent error handling)
      for (const agent of respondingAgents) {
        if (abort.signal.aborted) break;
        try {
          await streamOneAgent(convId, agent, aiConfig, abort);
        } catch (agentErr) {
          if ((agentErr as Error).name === "AbortError") break;
          // Show error for this specific agent, continue to next
          updateConversations(prev => prev.map(c => {
            if (c.id !== convId) return c;
            const msgs = [...c.messages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === "assistant" && last.streaming) {
              msgs[msgs.length - 1] = { ...last, content: lang === 'zh' ? '(连接超时，请重试)' : '(Connection timed out)', streaming: false };
            }
            return { ...c, messages: msgs };
          }));
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      updateConversations(prev => prev.map(c => {
        if (c.id !== convId) return c;
        const msgs = [...c.messages];
        const last = msgs[msgs.length - 1];
        if (last && last.role === "assistant" && !last.content) {
          msgs[msgs.length - 1] = { ...last, content: t("ai.chat.error") };
        }
        return { ...c, messages: msgs };
      }));
    } finally {
      setStreamingConvId(null);
      updateConversations(prev => prev.map(c => {
        if (c.id !== convId) return c;
        return { ...c, messages: c.messages.map(m => ({ ...m, streaming: false })) };
      }));
      abortRef.current = null;
    }
  }, [streamingConvId, settings, dashboard, pageContext, activeTab, lang, activeConvId, activeAgentIds, activeAgent, agents, t, operatorName, businessDesc, currency, updateConversations, agentMap, streamOneAgent]);

  /** Execute a confirmed tool call */
  const handleToolConfirm = useCallback(async (msgIndex: number) => {
    if (!activeConvId) return;
    const conv = conversations.find(c => c.id === activeConvId);
    if (!conv) return;
    const msg = conv.messages[msgIndex];
    if (!msg?.toolConfirm) return;

    setExecutingTool(true);
    try {
      const sym = currency === "CNY" ? "¥" : "$";
      const result = await executeTool({ name: msg.toolConfirm.toolName, args: msg.toolConfirm.args }, sym);
      updateConversations(prev => prev.map(c => {
        if (c.id !== activeConvId) return c;
        const msgs = [...c.messages];
        msgs[msgIndex] = { ...msgs[msgIndex], toolResult: result, toolConfirm: undefined };
        // Add a follow-up assistant message
        const successText = lang === "zh"
          ? (result.success ? `✅ ${result.message}` : `❌ ${result.message}`)
          : (result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
        msgs.push({ role: "assistant", content: successText });
        return { ...c, messages: msgs, updatedAt: Date.now() };
      }));
    } catch {
      updateConversations(prev => prev.map(c => {
        if (c.id !== activeConvId) return c;
        const msgs = [...c.messages];
        msgs[msgIndex] = { ...msgs[msgIndex], toolResult: { success: false, message: "Execution failed" }, toolConfirm: undefined };
        return { ...c, messages: msgs };
      }));
    } finally {
      setExecutingTool(false);
    }
  }, [activeConvId, conversations, lang, updateConversations]);

  /** Reject/cancel a tool call */
  const handleToolReject = useCallback((msgIndex: number) => {
    if (!activeConvId) return;
    const cancelText = lang === "zh" ? "已取消操作。" : "Action cancelled.";
    updateConversations(prev => prev.map(c => {
      if (c.id !== activeConvId) return c;
      const msgs = [...c.messages];
      msgs[msgIndex] = { ...msgs[msgIndex], content: cancelText, toolConfirm: undefined };
      return { ...c, messages: msgs, updatedAt: Date.now() };
    }));
  }, [activeConvId, lang, updateConversations]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || streamingConvId !== null) return; // Don't clear input if can't send
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    sendMessage(text);
  }, [input, sendMessage, streamingConvId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // @mention keyboard navigation
    if (mentionQuery !== null && mentionAgents.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(prev => (prev + 1) % mentionAgents.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(prev => (prev - 1 + mentionAgents.length) % mentionAgents.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(mentionAgents[mentionIndex]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setMentionQuery(null); return; }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  // Use agent starters if available, otherwise page-specific prompts
  const quickPrompts = isMultiAgent
    ? (lang === 'zh'
      ? [{ label: '📊 业务全面分析', prompt: '从你们各自的专业角度，分析一下我的业务状况' },
         { label: '🎯 本周重点', prompt: '各位助手，帮我规划本周的工作重点' },
         { label: '💡 头脑风暴', prompt: '一起帮我想想，有什么可以改进的地方' }]
      : [{ label: '📊 Full analysis', prompt: 'From each of your specialties, analyze my business' },
         { label: '🎯 Weekly plan', prompt: 'Help me plan this week from your perspectives' },
         { label: '💡 Brainstorm', prompt: 'Brainstorm improvement ideas together' }])
    : activeAgent?.conversation_starters?.length
      ? activeAgent.conversation_starters.map(s => ({ label: s, prompt: s }))
      : getQuickPrompts(activeTab, lang);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — desktop only */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[var(--layer-dialog)] hidden lg:block"
            style={{ background: "var(--color-overlay-primary)" }}
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="ai-chat-panel fixed z-[var(--layer-dialog)] flex flex-col overflow-hidden
              inset-0
              lg:inset-y-1 lg:right-1 lg:left-auto lg:w-[88%] lg:max-w-[1280px] lg:rounded-[var(--radius-16)]"
            style={{
              background: "var(--color-bg-primary)",
              boxShadow: "var(--shadow-high)",
              border: "1px solid var(--color-line-secondary)",
            }}
          >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 shrink-0"
            style={{
              height: 52,
              paddingTop: "max(0px, env(safe-area-inset-top, 0px))",
              borderBottom: "1px solid var(--color-line-secondary)",
            }}
          >
            <div className="flex items-center gap-1 min-w-0">
              {showList ? (
                <div className="w-1 lg:hidden" />
              ) : activeConvId ? (
                <div className="lg:hidden">
                  <button
                    onClick={() => setShowList(true)}
                    className="btn-icon-sm"
                    aria-label={t("ai.chat.conversations")}
                  >
                    <ChevronLeft size={18} />
                  </button>
                </div>
              ) : (
                <div className="w-1 lg:hidden" />
              )}
              {/* Show title text only when in list view on mobile or no agents exist */}
              {(showList || agents.length === 0) && (
                <span className={`text-[15px] truncate ${showList ? 'lg:hidden' : ''}`} style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
                  {showList ? t("ai.chat.conversations") : t("ai.chat.title")}
                </span>
              )}
              {!showList && agents.length > 0 && (
                <div className="relative shrink-0">
                  <button
                    onClick={() => setShowAgentPicker(!showAgentPicker)}
                    aria-expanded={showAgentPicker}
                    aria-haspopup="listbox"
                    className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[12px]"
                    style={{
                      background: activeAgentIds.length > 0 ? 'var(--color-accent-tint)' : 'var(--color-bg-tertiary)',
                      color: activeAgentIds.length > 0 ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                      border: '1px solid var(--color-border-translucent)',
                    }}
                  >
                    {isMultiAgent ? (
                      <>
                        <span className="flex -space-x-1">{activeAgents.slice(0, 3).map(a => <span key={a.id}>{a.avatar}</span>)}</span>
                        {activeAgents.length > 3 && <span className="ml-0.5">+{activeAgents.length - 3}</span>}
                      </>
                    ) : (
                      <>
                        <span>{activeAgent?.avatar || '🤖'}</span>
                        <span className="max-w-[80px] truncate ml-0.5">{activeAgent?.name || t("ai.chat.defaultAssistant")}</span>
                      </>
                    )}
                  </button>
                  {showAgentPicker && (
                    <>
                      <div className="fixed inset-0" style={{ zIndex: 'var(--layer-popover, 600)' } as React.CSSProperties} onClick={() => setShowAgentPicker(false)} />
                      <div
                        className="absolute top-full left-0 mt-1 rounded-[var(--radius-12)] py-1.5 min-w-[220px] overflow-y-auto"
                        style={{
                          background: 'var(--color-bg-secondary)',
                          border: '1px solid var(--color-border-translucent)',
                          boxShadow: 'var(--shadow-high)',
                          zIndex: 'var(--layer-popover, 600)' as unknown as number,
                          maxHeight: 'min(60vh, 400px)',
                        }}
                      >
                        {/* Section label */}
                        <div className="px-3 pt-1 pb-2">
                          <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-text-quaternary)', fontWeight: 600 }}>
                            {lang === 'zh' ? '选择参与者（可多选）' : 'Select participants (multi-select)'}
                          </span>
                        </div>

                        {/* Agent list — multi-select checkboxes */}
                        {(() => {
                          const generalAgent = agents.find(a => a.template_id === 'general');
                          const otherAgents = agents.filter(a => a.template_id !== 'general');
                          const sorted = generalAgent ? [generalAgent, ...otherAgents] : agents;
                          return sorted.map(a => {
                            const selected = activeAgentIds.includes(a.id);
                            return (
                              <button
                                key={a.id}
                                onClick={() => {
                                  // Toggle: add or remove from selection
                                  setActiveAgentIds(prev =>
                                    selected ? prev.filter(id => id !== a.id) : [...prev, a.id]
                                  );
                                }}
                                className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-left transition-colors"
                                style={{
                                  background: selected ? 'var(--color-accent-tint)' : 'transparent',
                                  color: 'var(--color-text-primary)',
                                }}
                              >
                                {/* Checkbox */}
                                <span
                                  className="flex items-center justify-center rounded shrink-0"
                                  style={{
                                    width: 16, height: 16,
                                    border: selected ? 'none' : '1.5px solid var(--color-text-quaternary)',
                                    background: selected ? 'var(--color-accent)' : 'transparent',
                                  }}
                                >
                                  {selected && <Check size={11} style={{ color: 'var(--color-brand-text)' }} />}
                                </span>
                                <span>{a.avatar || '🤖'}</span>
                                <span className="flex-1 truncate">{a.name}</span>
                              </button>
                            );
                          });
                        })()}

                        {/* Divider + action buttons */}
                        <div className="mx-3 my-1.5" style={{ borderTop: '1px solid var(--color-line-tertiary)' }} />

                        {/* Start chat / apply button */}
                        {(() => {
                          const curConv = activeConvId ? conversationsRef.current.find(c => c.id === activeConvId) : null;
                          const curConvAgentIds = curConv ? getConvAgentIds(curConv) : [];
                          const selectionChanged = JSON.stringify([...activeAgentIds].sort()) !== JSON.stringify([...curConvAgentIds].sort());
                          const hasSelection = activeAgentIds.length > 0;

                          const applySelection = () => {
                            setShowAgentPicker(false);
                            if (!hasSelection) {
                              // No agents → default assistant mode
                              if (curConv && curConv.messages.length > 0) {
                                const newConv: Conversation = {
                                  id: generateId(), title: lang === "zh" ? "新对话" : "New chat",
                                  messages: [], agentId: null, agentIds: [], createdAt: Date.now(), updatedAt: Date.now(),
                                };
                                updateConversations(prev => [newConv, ...prev]);
                                setActiveConvId(newConv.id);
                                api.post('/api/conversations', { id: newConv.id, title: newConv.title, agent_id: null, agent_ids: [], messages: [] }).catch(() => {});
                              } else if (activeConvId) {
                                updateConversations(prev => prev.map(c => c.id !== activeConvId ? c : { ...c, agentId: null, agentIds: [], updatedAt: Date.now() }));
                              }
                              return;
                            }
                            // Create new conversation with selected agents (or update empty current one)
                            if (curConv && curConv.messages.length > 0) {
                              const newConv: Conversation = {
                                id: generateId(), title: lang === "zh" ? "新对话" : "New chat",
                                messages: [], agentId: activeAgentIds[0], agentIds: [...activeAgentIds],
                                createdAt: Date.now(), updatedAt: Date.now(),
                              };
                              updateConversations(prev => [newConv, ...prev]);
                              setActiveConvId(newConv.id);
                              api.post('/api/conversations', { id: newConv.id, title: newConv.title, agent_id: newConv.agentId, agent_ids: newConv.agentIds, messages: [] }).catch(() => {});
                            } else if (activeConvId) {
                              updateConversations(prev => prev.map(c => c.id !== activeConvId ? c : {
                                ...c, agentId: activeAgentIds[0], agentIds: [...activeAgentIds], updatedAt: Date.now(),
                              }));
                            }
                          };

                          return (
                            <div className="px-2 pb-1 flex gap-1.5">
                              <button
                                onClick={applySelection}
                                disabled={!selectionChanged && hasSelection}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-40"
                                style={{ background: 'var(--color-accent)', color: 'var(--color-brand-text)' }}
                              >
                                {activeAgentIds.length > 1
                                  ? (lang === 'zh' ? `建群聊 (${activeAgentIds.length})` : `Group (${activeAgentIds.length})`)
                                  : activeAgentIds.length === 1
                                    ? (lang === 'zh' ? '开始对话' : 'Start chat')
                                    : (lang === 'zh' ? '默认助手' : 'Default')
                                }
                              </button>
                              <button
                                onClick={() => {
                                  setShowAgentPicker(false);
                                  setActiveTab("settings");
                                  handleClose();
                                  const tryScroll = (n = 0) => {
                                    const el = document.getElementById('settings-agents');
                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    else if (n < 3) setTimeout(() => tryScroll(n + 1), 150);
                                  };
                                  setTimeout(tryScroll, 80);
                                }}
                                className="flex items-center justify-center px-2 py-2 rounded-lg transition-colors"
                                style={{ color: 'var(--color-text-tertiary)' }}
                                title={lang === 'zh' ? '管理 Agent' : 'Manage Agents'}
                              >
                                <Settings size={14} />
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              {!showList && (
                <div className="flex items-center gap-1 lg:hidden">
                  <button
                    onClick={() => setShowList(true)}
                    className="btn-icon-sm"
                    aria-label={t("ai.chat.conversations")}
                    title={t("ai.chat.conversations")}
                  >
                    <MessagesSquare size={16} />
                  </button>
                  <button
                    onClick={handleNewConversation}
                    className="btn-icon-sm"
                    aria-label={t("ai.chat.newChat")}
                    title={t("ai.chat.newChat")}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              )}
              <button onClick={handleClose} className="btn-icon-sm" aria-label={t("common.close")}>
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Desktop sidebar — always visible */}
            <div
              className="hidden lg:flex lg:flex-col lg:shrink-0"
              style={{ width: 260, borderRight: '1px solid var(--color-line-secondary)', background: 'var(--color-bg-secondary)' }}
            >
              <ConversationList
                conversations={conversations}
                activeId={activeConvId}
                onSelect={handleSelectConversation}
                onDelete={handleDeleteConversation}
                onNew={handleNewConversation}
                lang={lang}
                agents={agents}
              />
            </div>

            {/* Mobile conversation list — toggled */}
            {showList && (
              <div className="flex-1 flex flex-col lg:hidden">
                <ConversationList
                  conversations={conversations}
                  activeId={activeConvId}
                  onSelect={(id) => { handleSelectConversation(id); setShowList(false); }}
                  onDelete={handleDeleteConversation}
                  onNew={() => { handleNewConversation(); setShowList(false); }}
                  lang={lang}
                  agents={agents}
                />
              </div>
            )}

            {/* Chat area */}
            <div className={`flex-1 flex flex-col min-w-0 ${showList ? 'hidden lg:flex' : 'flex'}`}>
              {/* Group chat members bar */}
              {activeConv && (() => {
                const memberAgents = getConvAgentIds(activeConv).map(id => agentMap.get(id)).filter(Boolean);
                if (memberAgents.length < 2) return null;
                return (
                  <div
                    className="flex items-center gap-2 px-4 py-1.5 shrink-0 overflow-x-auto"
                    style={{ borderBottom: "1px solid var(--color-line-secondary)", background: "var(--color-bg-secondary)" }}
                  >
                    <span className="text-[10px] shrink-0" style={{ color: "var(--color-text-quaternary)", textTransform: "uppercase", fontWeight: 600 }}>
                      {t("ai.chat.members")}
                    </span>
                    {memberAgents.map(a => (
                      <span key={a!.id} className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-full text-[11px]" style={{ background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)" }}>
                        <span>{a!.avatar}</span>
                        <span>{a!.name}</span>
                      </span>
                    ))}
                  </div>
                );
              })()}

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
                        {/* Agent team intro (group) or single agent welcome */}
                        {activeAgents.length > 1 ? (
                          <div className="flex flex-col items-center gap-3">
                            <div className="flex -space-x-2">
                              {activeAgents.map(a => (
                                <div
                                  key={a.id}
                                  className="flex items-center justify-center rounded-full text-[18px] ring-2 ring-[var(--color-bg-primary)]"
                                  style={{ width: 40, height: 40, background: 'var(--color-bg-tertiary)' }}
                                >
                                  {a.avatar}
                                </div>
                              ))}
                            </div>
                            <div className="text-center max-w-[280px]">
                              <p className="text-[14px] truncate" style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                                {activeAgents.length <= 3
                                  ? activeAgents.map(a => a.name).join(' · ')
                                  : `${activeAgents.slice(0, 3).map(a => a.name).join(' · ')} +${activeAgents.length - 3}`}
                              </p>
                              <p className="text-[12px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                                {lang === 'zh' ? '你的 AI 团队已就绪，随时听候指令' : 'Your AI team is ready. Give a directive.'}
                              </p>
                            </div>
                          </div>
                        ) : activeAgent ? (
                          <div className="flex flex-col items-center gap-2">
                            <div
                              className="flex items-center justify-center rounded-full text-2xl"
                              style={{ width: 48, height: 48, background: 'var(--color-bg-tertiary)' }}
                            >
                              {activeAgent.avatar}
                            </div>
                            <p className="text-[14px]" style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                              {activeAgent.name}
                            </p>
                            <p className="text-[12px] text-center max-w-[260px]" style={{ color: 'var(--color-text-tertiary)' }}>
                              {activeAgent.role?.slice(0, 60)}{activeAgent.role?.length > 60 ? '...' : ''}
                            </p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <div
                              className="flex items-center justify-center rounded-full text-2xl"
                              style={{ width: 48, height: 48, background: 'var(--color-bg-tertiary)' }}
                            >
                              🤖
                            </div>
                            <p className="text-[14px]" style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                              {t("ai.chat.defaultAssistant")}
                            </p>
                            <p className="text-[12px] text-center max-w-[260px]" style={{ color: 'var(--color-text-tertiary)' }}>
                              {lang === 'zh' ? '通用 AI 助手，无特定人设。可在顶部切换到专业 Agent。' : 'General AI assistant, no specific persona. Switch to a specialized Agent above.'}
                            </p>
                          </div>
                        )}
                        {/* Quick prompts */}
                        <div className="flex flex-wrap gap-2 justify-center max-w-[320px]">
                          {quickPrompts.map((qp, i) => (
                            <button
                              key={i}
                              onClick={() => sendMessage(qp.prompt)}
                              disabled={isStreaming}
                              className="ai-chat-quick-prompt px-3 py-1.5 rounded-full text-[13px] transition-colors hover:opacity-80 press-feedback disabled:opacity-40 disabled:pointer-events-none"
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
                      <div className="flex flex-col items-center gap-3 opacity-60">
                        <Settings size={32} style={{ color: "var(--color-text-quaternary)" }} />
                        <p className="text-[13px] text-center" style={{ color: "var(--color-text-tertiary)" }}>
                          {t("ai.chat.noProvider")}
                        </p>
                        <button
                          onClick={() => {
                            setActiveTab("settings");
                            handleClose();
                            const tryScroll = (n = 0) => {
                              const el = document.getElementById('settings-ai');
                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              else if (n < 3) setTimeout(() => tryScroll(n + 1), 150);
                            };
                            setTimeout(tryScroll, 80);
                          }}
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
                {messages.map((msg, i) => {
                  const msgAgent = msg.agentId != null ? agentMap.get(msg.agentId) : null;
                  const isUser = msg.role === "user";
                  // Collapse consecutive same-sender headers
                  const prevMsg = i > 0 ? messages[i - 1] : null;
                  const sameSender = prevMsg
                    && prevMsg.role === msg.role
                    && (prevMsg.agentId || null) === (msg.agentId || null)
                    && !prevMsg.toolConfirm;
                  const senderName = isUser ? operatorName : (msgAgent?.name || (lang === "zh" ? "AI 助手" : "Assistant"));
                  const senderAvatarRaw = isUser ? (operatorAvatar || "👤") : (msgAgent?.avatar || "🤖");
                  const senderIsImage = typeof senderAvatarRaw === "string" && (senderAvatarRaw.startsWith("data:") || senderAvatarRaw.startsWith("http"));

                  return (
                  <div key={i} className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                    {/* Avatar column */}
                    <div className="shrink-0" style={{ width: 28 }}>
                      {!sameSender && (
                        <div
                          className="flex items-center justify-center rounded-full text-[14px] overflow-hidden"
                          style={{ width: 28, height: 28, background: "var(--color-bg-tertiary)" }}
                        >
                          {senderIsImage
                            ? <img src={senderAvatarRaw} alt="" className="w-full h-full object-cover rounded-full" />
                            : senderAvatarRaw}
                        </div>
                      )}
                    </div>

                    {/* Message column */}
                    <div className={`flex-1 min-w-0 ${isUser ? "flex flex-col items-end" : ""}`} style={{ maxWidth: "85%" }}>
                      {/* Sender name header (collapse for consecutive) */}
                      {!sameSender && (
                        <div className={`flex items-center gap-1.5 mb-0.5 ${isUser ? "flex-row-reverse mr-1" : "ml-1"}`}>
                          <span className="text-[11px]" style={{ color: "var(--color-text-tertiary)", fontWeight: 600 }}>{senderName}</span>
                          {msg.timestamp && (
                            <span className="text-[10px]" style={{ color: "var(--color-text-quaternary)" }}>
                              {new Date(msg.timestamp).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      )}

                      {msg.toolConfirm ? (
                        <ToolConfirmCard
                          confirm={msg.toolConfirm}
                          onConfirm={() => handleToolConfirm(i)}
                          onReject={() => handleToolReject(i)}
                          onUpdateArgs={(newArgs) => {
                            if (!activeConvId) return;
                            updateConversations(prev => prev.map(c => {
                              if (c.id !== activeConvId) return c;
                              const msgs = [...c.messages];
                              const m = msgs[i];
                              if (!m?.toolConfirm) return c;
                              // Rebuild confirm info with new args
                              const updated = buildConfirmInfo({ name: m.toolConfirm.toolName, args: newArgs }, lang, currency === "CNY" ? "¥" : "$");
                              msgs[i] = { ...m, toolConfirm: updated };
                              return { ...c, messages: msgs };
                            }));
                          }}
                          lang={lang}
                          executing={executingTool}
                          result={msg.toolResult}
                        />
                      ) : (
                        <div
                          className={`ai-chat-bubble rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed inline-block ${isUser ? "ai-chat-bubble-user" : "ai-chat-bubble-assistant group relative"}`}
                          style={isUser ? {
                            background: "var(--color-accent)",
                            color: "var(--color-brand-text)",
                            borderBottomRightRadius: 6,
                            whiteSpace: "pre-wrap",
                            overflowWrap: "break-word" as const,
                          } : {
                            background: "var(--color-bg-secondary)",
                            color: "var(--color-text-primary)",
                            borderBottomLeftRadius: 6,
                            overflowWrap: "break-word" as const,
                            ...(isGroupConv && msg.agentId ? { borderLeft: `3px solid ${AGENT_COLORS[activeConvAgentIds.indexOf(msg.agentId) % AGENT_COLORS.length]}` } : {}),
                          }}
                        >
                          {!isUser ? (
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
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* Typing indicator */}
              {isStreamingHere && (() => {
                const streamingMsg = [...messages].reverse().find(m => m.role === 'assistant' && m.streaming);
                const typingAgent = streamingMsg?.agentId ? agentMap.get(streamingMsg.agentId) : null;
                const typingName = typingAgent?.name || (lang === 'zh' ? 'AI 助手' : 'Assistant');
                const typingAvatar = typingAgent?.avatar || '🤖';
                return (
                  <div
                    className="flex items-center gap-2 px-4 py-1.5 shrink-0"
                    style={{ background: 'var(--color-bg-secondary)', borderTop: '1px solid var(--color-line-tertiary)' }}
                  >
                    <span className="text-[13px]">{typingAvatar}</span>
                    <span className="text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>
                      {typingName} {t("ai.chat.isTyping")}
                    </span>
                    <span className="ai-typing-indicator">
                      <span className="ai-typing-dot" />
                      <span className="ai-typing-dot" />
                      <span className="ai-typing-dot" />
                    </span>
                  </div>
                );
              })()}

              {/* Input */}
              <div
                className="shrink-0 px-3 pb-3 pt-1.5"
                style={{
                  borderTop: "1px solid var(--color-line-secondary)",
                  paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))",
                }}
              >
                <div className="flex items-center justify-between mb-1 px-1">
                  <AIConnectionStatus settings={settings} />
                </div>
                {/* @mention dropdown */}
                {mentionQuery !== null && mentionAgents.length > 0 && (
                  <div
                    className="rounded-[var(--radius-8)] py-1 mb-1"
                    style={{
                      background: "var(--color-bg-secondary)",
                      border: "1px solid var(--color-border-translucent)",
                      boxShadow: "var(--shadow-high)",
                    }}
                  >
                    {mentionAgents.map((a, idx) => (
                      <button
                        key={a.id}
                        onClick={() => insertMention(a)}
                        className="flex items-center gap-2 w-full px-3 py-2.5 text-[13px] text-left transition-colors"
                        style={{
                          color: "var(--color-text-primary)",
                          background: idx === mentionIndex ? 'var(--color-accent-tint)' : 'transparent',
                        }}
                        onMouseDown={(e) => e.preventDefault() /* prevent blur */}
                        onMouseEnter={() => setMentionIndex(idx)}
                      >
                        <span>{a.avatar}</span>
                        <span className="flex-1">{a.name}</span>
                        {idx === mentionIndex && <span className="text-[10px]" style={{ color: 'var(--color-text-quaternary)' }}>↵</span>}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={t("ai.chat.placeholder")}
                    rows={1}
                    className="input-base flex-1 px-3 py-2.5 text-[14px] resize-none"
                    style={{ maxHeight: 120, minHeight: 44 }}
                    disabled={isStreamingHere}
                  />
                  {isStreamingHere ? (
                    <button
                      onClick={() => { abortRef.current?.abort(); setStreamingConvId(null); }}
                      className="ai-chat-send shrink-0 rounded-full flex items-center justify-center transition-all w-10 h-10 lg:w-10 lg:h-10"
                      style={{
                        minWidth: 44,
                        minHeight: 44,
                        background: "var(--color-danger, #eb5757)",
                        color: "var(--color-text-on-color, #fff)",
                      }}
                      aria-label={lang === 'zh' ? '停止' : 'Stop'}
                    >
                      <Square size={14} fill="currentColor" />
                    </button>
                  ) : (
                    <button
                      onClick={handleSend}
                      disabled={!input.trim()}
                      className="ai-chat-send shrink-0 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
                      style={{
                        minWidth: 44,
                        minHeight: 44,
                        background: "var(--color-accent)",
                        color: "var(--color-brand-text)",
                      }}
                      aria-label={t("ai.chat.send")}
                    >
                      <Send size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
