import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Send, Loader2, Trash2, Copy, Check, Settings, Plus, ChevronDown, MessagesSquare, Zap, CheckCircle2, XCircle, Square, Paperclip, Image as ImageIcon, Pencil, RotateCcw, MoreHorizontal, Download, ArrowDown, Eraser } from "lucide-react";
import PeepIllustration from "../components/ui/PeepIllustration";
import { TabPill } from "../components/ui/TabPill";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useT } from "../i18n/context";
import { useAuth } from "../auth/AuthProvider";
import { useAppSettings } from "../hooks/useAppSettings";
import { useUIStore } from "../store/useUIStore";
import { api } from "../lib/api";
import { todayDateKey } from "../lib/date-utils";
import { getCurrencySymbol } from "../lib/format";
import { useSettingsStore } from "../store/useSettingsStore";
import {
  getAIConfig,
  getDeviceAIProvider,
  getOllamaConfig,
  streamChat,
  type AIProvider,
  type ChatAttachment,
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
  createToolContext,
  TOOL_SAFETY,
  type ToolCall,
  type ToolConfirmInfo,
} from "./ai-tools";
import { useAgents } from "../hooks/useAgents";
import type { AgentConfig } from "../lib/agent-types";

interface MessageAttachment {
  mimeType: string;
  /** Base64 data (no prefix) */
  base64: string;
  fileName: string;
  /** Data URL for display (data:mime;base64,...) */
  dataUrl: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  agentId?: number | null;
  streaming?: boolean;
  timestamp?: number;
  /** Uploaded images/files */
  attachments?: MessageAttachment[];
  /** Tool confirmation pending user action */
  toolConfirm?: ToolConfirmInfo;
  /** Tool execution result */
  toolResult?: { success: boolean; message: string };
}

/** Color palette for agent identity in group chats */
const AGENT_COLORS = ['var(--color-warning)', 'var(--color-blue)', 'var(--color-success)', 'var(--color-purple)', 'var(--color-danger)', 'var(--color-info)'];

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

/** Trim messages for storage (keep last 100 per conversation, strip large base64 data) */
function trimConv(c: Conversation) {
  return {
    ...c,
    messages: c.messages.slice(-100).map(m => ({
      role: m.role, content: m.content,
      ...(m.agentId != null ? { agentId: m.agentId } : {}),
      ...(m.timestamp ? { timestamp: m.timestamp } : {}),
      // Store attachment metadata only (no base64 — too large for localStorage)
      ...(m.attachments?.length ? {
        attachments: m.attachments.map(a => ({
          mimeType: a.mimeType, fileName: a.fileName, base64: "", dataUrl: "",
        })),
      } : {}),
    })),
  };
}

function saveConversationsLocal(convs: Conversation[]) {
  const trimmed = convs.slice(0, 50).map(trimConv);
  try { localStorage.setItem(LS_CONVERSATIONS, JSON.stringify(trimmed)); } catch { /* quota exceeded */ }
}

/** Sync a single conversation to the API (debounced per conversation) */
const pendingSyncs = new Map<string, ReturnType<typeof setTimeout>>();
/** Hold the latest conversation snapshot per id so flush can run without the
 *  caller re-supplying it. Debounced updates overwrite; flush drains this map. */
const pendingConvs = new Map<string, Conversation>();

async function writeConvToAPI(conv: Conversation) {
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
}

function syncConversationToAPI(conv: Conversation) {
  // Debounce per conversation — wait 1.5s after last change before saving
  const existing = pendingSyncs.get(conv.id);
  if (existing) clearTimeout(existing);
  pendingConvs.set(conv.id, conv);
  pendingSyncs.set(conv.id, setTimeout(() => {
    pendingSyncs.delete(conv.id);
    const latest = pendingConvs.get(conv.id);
    pendingConvs.delete(conv.id);
    if (latest) void writeConvToAPI(latest);
  }, 1500));
}

/** Flush all pending debounced syncs immediately. Call on unmount so the last
 *  edit before closing the panel / navigating away isn't lost. */
function flushPendingSyncs() {
  for (const timer of pendingSyncs.values()) clearTimeout(timer);
  pendingSyncs.clear();
  const convs = Array.from(pendingConvs.values());
  pendingConvs.clear();
  for (const conv of convs) void writeConvToAPI(conv);
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
    if (item.payment_method) parts.push(`pay:${item.payment_method}`);
    if (item.tax_mode && item.tax_mode !== "none") parts.push(`tax:${item.tax_mode}@${item.tax_rate || 0}%`);
    if (item.created_at) parts.push(`since:${String(item.created_at).slice(0, 10)}`);
    // Subscription timeline — extract next renewal
    if (item.subscription_timeline && Array.isArray(item.subscription_timeline)) {
      const timeline = item.subscription_timeline as Array<Record<string, unknown>>;
      const now = new Date().toISOString().slice(0, 10);
      const upcoming = timeline.filter(e => String(e.date || e.start || "") >= now);
      if (upcoming.length > 0) {
        const next = upcoming[0];
        parts.push(`next-renewal:${next.date || next.start || "?"}`);
      }
      parts.push(`timeline:${timeline.length}entries`);
    }
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
    const today = todayDateKey();
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
  personalPreferences?: string,
): string {
  const lines: string[] = [];
  const sym = currency === "CNY" ? "¥" : "$";

  // Cache-busting nonce at the START — Ollama caches by prefix match, so placing it early
  // ensures the KV cache is invalidated for each new conversation
  lines.push(`[ctx:${Date.now().toString(36)}]`);

  /** Wrap user-authored personal preferences with a framing disclaimer + XML tags.
   *  Prevents the model from treating preference text as system instructions or
   *  over-serving preferences when the current request needs a different mode. */
  const pushPreferences = (content: string) => {
    if (!content || !content.trim()) return;
    lines.push("");
    if (lang === "zh") {
      lines.push("【用户偏好档案】（用户自述的工作与沟通偏好，作为默认风格参考；与用户当前请求冲突时以当前请求为准）");
    } else {
      lines.push("[User Preference Profile] (User's self-described work and communication preferences. Use as default style guidance; if they conflict with the current request, follow the request.)");
    }
    lines.push("<user_preferences>");
    lines.push(content);
    lines.push("</user_preferences>");
  };

  if (lang === "zh") {
    if (agent && agent.role) {
      // Custom agent — full personality/rules/calibration prompt (autonomous mode)
      lines.push(`你的名字是「${agent.name}」。${agent.role}`);
      lines.push('');
      lines.push(`【回复规则】`);
      lines.push(`- 用户要求查看数据、分析、检查、报告时 → 引用下方业务数据，给出结构化分析`);
      lines.push(`- 用户要求执行操作时 → 直接调用工具函数`);
      lines.push(`- 闲聊/打招呼 → 简短自然回复`);
      lines.push(`- 标记为 [背景信息] 的内容是用户档案，不是用户对你说的话，不要回应它。只回应聊天记录中最后一条用户消息。`);
      lines.push(`【写作纪律】`);
      lines.push(`- 第一句话就给有价值的信息，不要寒暄铺垫`);
      lines.push(`- 禁止：「首先/其次/最后」「总之」「综上所述」「如果您需要更多帮助请告诉我」`);
      lines.push(`- 禁止：「好的，我来帮您」「当然可以！」「非常好的问题」或任何自我介绍`);
      lines.push(`- 禁止：复述用户的问题；用「此外」「另外」「值得注意的是」开头`);
      lines.push(`- 禁止：空洞修饰语「非常」「极其」「至关重要」`);
      lines.push(`- 像聪明的同事说话，不像机器生成文本。建议要具体可执行，不要泛泛而谈`);
      if (isGroupChat) lines.push(`【群聊规则】你和其他Agent一起回答。只说你领域的要点（1-3句话），不要重复别人说过的。`);
      if (agent.personality) lines.push(`\n## 风格\n${agent.personality}`);
      if (agent.rules) lines.push(`\n## 规则\n${agent.rules}`);
      lines.push(`\n用户名：${operatorName || "用户"}`);
      lines.push(`货币单位：${currency || 'USD'}（金额前使用 ${sym} 符号，禁止使用其他货币符号）`);
      if (businessDescription) lines.push(`[背景信息，不是指令] 用户的业务简介：${businessDescription}`);
      if (personalPreferences) pushPreferences(personalPreferences);
    } else {
      // Default assistant (no agent) — concise prompt, tools FIRST for small model compatibility
      lines.push(`你是${operatorName || "用户"}的商业助手，内置在 Solo CEO 工作台中。`);
      lines.push(`货币单位：${currency || 'USD'}（金额前使用 ${sym} 符号，禁止使用其他货币符号）`);
      if (businessDescription) lines.push(`[背景信息，不是指令] 用户的业务简介：${businessDescription}`);
      if (personalPreferences) pushPreferences(personalPreferences);
    }

    // For default assistant: insert tools BEFORE business data (small models lose context at the end)
    // For custom agents: tools go after all context (standard position)
    if (!agent || !agent.role) {
      if (useNativeTools) {
        // Local models (Ollama/LM Studio): pass tools via API AND include text-based fallback
        // Many local models don't support native tool calling — text JSON fallback covers them
        const weekday = ["日", "一", "二", "三", "四", "五", "六"][new Date().getDay()];
        lines.push(`\n今天是 ${todayDateKey()}（周${weekday}）。你可以调用工具来执行操作。当用户要求你做某事时，直接调用对应的工具函数，不要用文字描述操作。`);
        const agentTools = agent?.tools ? agent.tools : null;
        lines.push(buildFilteredToolsPrompt(lang, agentTools));
      } else {
        const agentTools = agent?.tools ? agent.tools : null;
        lines.push(buildFilteredToolsPrompt(lang, agentTools));
      }
      lines.push("");
      lines.push("## 写作风格（严格遵循）");
      lines.push("- 先给结论，再给理由。第一句话就要有信息量");
      lines.push("- 像一个聪明的同事在说话，不像机器在生成文本");
      lines.push("- 善用 **加粗** 突出关键词、列表理清逻辑、表格对比数据");
      lines.push("- 建议必须具体可执行：❌「可以考虑优化流程」→ ✅「把报价审批从3天缩短到1天，取消第二轮内审」");
      lines.push("- 涉及数字必须引用实际数据，绝不编造");
      lines.push("- 中文回复控制在合理长度，不为凑字数而重复");
      lines.push("");
      lines.push("## 禁止用语（违反会降低专业性）");
      lines.push("- 禁止：「首先...其次...最后...」「总之」「综上所述」「总而言之」");
      lines.push("- 禁止：「如果您需要更多帮助，请随时告诉我」「希望这对您有所帮助」");
      lines.push("- 禁止：「好的，我来帮您...」「当然可以！」「非常好的问题！」");
      lines.push("- 禁止：「作为一个AI助手」「作为您的商业助手」或任何自我介绍");
      lines.push("- 禁止：重复用户的问题或改写问题再回答");
      lines.push("- 禁止：每段开头用「此外」「另外」「同时」「值得注意的是」「需要指出的是」");
      lines.push("- 禁止：空洞的修饰语「非常」「极其」「至关重要」「不可或缺」");
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
    if (agent) lines.push(`\n【重要】回答用户的实际问题。第一句就给有用信息。禁止寒暄、禁止复述问题、禁止「首先其次最后」。`);
  } else {
    if (agent && agent.role) {
      // Custom agent — full personality/rules/calibration prompt (autonomous mode)
      lines.push(`Your name is "${agent.name}". ${agent.role}`);
      lines.push('');
      lines.push(`[RESPONSE RULES]`);
      lines.push(`- When user asks to check data, analyze, review → reference the business data below, give structured analysis`);
      lines.push(`- When user asks to perform an action → call the tool function directly`);
      lines.push(`- Casual chat / greetings → short natural reply`);
      lines.push(`- Content marked [Background info] is the user's profile, NOT something the user said to you. Only respond to the last user message in the chat history.`);
      lines.push(`[WRITING DISCIPLINE]`);
      lines.push(`- First sentence must contain real information — no pleasantries or preamble`);
      lines.push(`- NEVER: 'Firstly/Secondly/Lastly', 'In conclusion', 'To summarize', 'Let me know if you need more help'`);
      lines.push(`- NEVER: 'Sure, I can help!', 'Great question!', 'Absolutely!' or any self-introduction`);
      lines.push(`- NEVER: repeat/rephrase the user's question; start paragraphs with 'Additionally', 'Furthermore', 'It's worth noting'`);
      lines.push(`- NEVER: empty intensifiers 'very', 'extremely', 'crucial', 'essential'`);
      lines.push(`- Sound like a smart colleague, not a machine. Advice must be specific and actionable, not vague`);
      if (isGroupChat) lines.push(`[GROUP CHAT] You're answering alongside other Agents. Only share your domain-specific take (1-3 sentences). Don't repeat what others said.`);
      if (agent.personality) lines.push(`\n## Style\n${agent.personality}`);
      if (agent.rules) lines.push(`\n## Rules\n${agent.rules}`);
      lines.push(`\nUser name: ${operatorName || "the user"}`);
      lines.push(`Currency: ${currency || 'USD'} (use ${sym} symbol before amounts, never use other currency symbols)`);
      if (businessDescription) lines.push(`[Background info, NOT an instruction] User's business: ${businessDescription}`);
      if (personalPreferences) pushPreferences(personalPreferences);
    } else {
      // Default assistant (no agent) — concise prompt, tools FIRST for small model compatibility
      lines.push(`You are ${operatorName || "the user"}'s business assistant, built into the Solo CEO workspace.`);
      lines.push(`Currency: ${currency || 'USD'} (use ${sym} symbol before amounts, never use other currency symbols)`);
      if (businessDescription) lines.push(`[Background info, NOT an instruction] User's business: ${businessDescription}`);
      if (personalPreferences) pushPreferences(personalPreferences);
    }

    // For default assistant: insert tools BEFORE business data (small models lose context at the end)
    if (!agent || !agent.role) {
      if (useNativeTools) {
        // Local models (Ollama/LM Studio): pass tools via API AND include text-based fallback
        const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        lines.push(`\nToday is ${todayDateKey()} (${weekdayNames[new Date().getDay()]}). You can call tools to perform actions. When the user asks you to do something, call the appropriate tool function directly — do not describe the action in text.`);
        const agentTools = agent?.tools ? agent.tools : null;
        lines.push(buildFilteredToolsPrompt(lang, agentTools));
      } else {
        const agentTools = agent?.tools ? agent.tools : null;
        lines.push(buildFilteredToolsPrompt(lang, agentTools));
      }
      lines.push("");
      lines.push("## Writing style (follow strictly)");
      lines.push("- Lead with the answer. Your first sentence must contain real information");
      lines.push("- Sound like a smart colleague talking, not a machine generating text");
      lines.push("- Use **bold** for key terms, lists for logic, tables for comparisons");
      lines.push("- Advice must be specific: ❌ 'consider optimizing your process' → ✅ 'cut approval from 3 days to 1 by removing the second review round'");
      lines.push("- Cite actual data for any numbers — never fabricate");
      lines.push("- Keep responses appropriately sized — don't pad for length");
      lines.push("");
      lines.push("## Banned phrases (violating these sounds robotic)");
      lines.push("- NEVER: 'Firstly... Secondly... Lastly...' or 'In conclusion' or 'To summarize'");
      lines.push("- NEVER: 'If you need any more help, feel free to ask' or 'Hope this helps!'");
      lines.push("- NEVER: 'Sure, I can help with that!' or 'Great question!' or 'Absolutely!'");
      lines.push("- NEVER: 'As an AI assistant' or any self-referential introduction");
      lines.push("- NEVER: repeat or rephrase the user's question before answering");
      lines.push("- NEVER: start paragraphs with 'Additionally', 'Furthermore', 'Moreover', 'It's worth noting'");
      lines.push("- NEVER: empty intensifiers like 'very', 'extremely', 'crucial', 'essential', 'vital'");
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
      ? `\n【重要】回答用户的实际问题。第一句就给有用信息。禁止寒暄、禁止复述问题、禁止「首先其次最后」。`
      : `\n[IMPORTANT] Answer the user's actual question. First sentence = useful info. No pleasantries, no echoing, no 'Firstly/Secondly'.`);
  }

  // Append agent tools — only for custom agents (default assistant already inserted tools earlier)
  if (agent && agent.role) {
    if (useNativeTools) {
      // Local models (Ollama/LM Studio): native tool API + text-based fallback
      const td = todayDateKey();
      const weekdayZh = ["日", "一", "二", "三", "四", "五", "六"][new Date().getDay()];
      const weekdayEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];
      const hint = lang === "zh"
        ? `\n今天是 ${td}（周${weekdayZh}）。用户提到"明天""下周五""月底"等相对日期时，请推算出具体 YYYY-MM-DD。你可以调用工具来执行操作。用户要求做某事时，直接调用工具函数。`
        : `\nToday is ${td} (${weekdayEn}). Calculate YYYY-MM-DD for relative dates like "tomorrow", "next Friday". You can call tools to perform actions. When asked, call the tool function directly.`;
      lines.push(hint);
      const agentTools = agent.tools ?? null;
      lines.push(buildFilteredToolsPrompt(lang, agentTools));
    } else {
      const agentTools = agent.tools ?? null;
      lines.push(buildFilteredToolsPrompt(lang, agentTools));
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
    const items = Array.isArray(data) ? data : [];
    return { items };
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

/* ── Code block with syntax highlighting ─────────────────── */
function CodeBlock({ children, language }: { children: React.ReactNode; language: string }) {
  const codeRef = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);
  const { t } = useT();

  useEffect(() => {
    const el = codeRef.current;
    if (!el) return;
    let cancelled = false;
    (async () => {
      try {
        const hljs = (await import("highlight.js/lib/core")).default;
        const [js, ts, py, css, json, bash, sql, xml] = await Promise.all([
          import("highlight.js/lib/languages/javascript"),
          import("highlight.js/lib/languages/typescript"),
          import("highlight.js/lib/languages/python"),
          import("highlight.js/lib/languages/css"),
          import("highlight.js/lib/languages/json"),
          import("highlight.js/lib/languages/bash"),
          import("highlight.js/lib/languages/sql"),
          import("highlight.js/lib/languages/xml"),
        ]);
        hljs.registerLanguage("javascript", js.default);
        hljs.registerLanguage("js", js.default);
        hljs.registerLanguage("typescript", ts.default);
        hljs.registerLanguage("ts", ts.default);
        hljs.registerLanguage("tsx", ts.default);
        hljs.registerLanguage("jsx", js.default);
        hljs.registerLanguage("python", py.default);
        hljs.registerLanguage("py", py.default);
        hljs.registerLanguage("css", css.default);
        hljs.registerLanguage("json", json.default);
        hljs.registerLanguage("bash", bash.default);
        hljs.registerLanguage("sh", bash.default);
        hljs.registerLanguage("shell", bash.default);
        hljs.registerLanguage("sql", sql.default);
        hljs.registerLanguage("xml", xml.default);
        hljs.registerLanguage("html", xml.default);
        if (!cancelled && el) {
          // Reset previous highlighting
          el.removeAttribute("data-highlighted");
          hljs.highlightElement(el);
        }
      } catch { /* highlight.js load failed, show plain text */ }
    })();
    return () => { cancelled = true; };
  }, [children, language]);

  const handleCopy = async () => {
    const text = codeRef.current?.textContent || "";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group/code my-2 rounded-lg overflow-hidden" style={{ background: "var(--color-bg-tertiary)" }}>
      <div className="flex items-center justify-between px-3 py-1" style={{ borderBottom: "1px solid var(--color-line-tertiary)" }}>
        <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--color-text-quaternary)" }}>
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="lg:opacity-0 lg:group-hover/code:opacity-100 flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-opacity"
          style={{ color: "var(--color-text-quaternary)" }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{t("ai.chat.copyCode")}</span>
        </button>
      </div>
      <pre className="px-3 py-2 text-[13px] overflow-x-auto">
        <code ref={codeRef} className={language ? `language-${language}` : ""}>{children}</code>
      </pre>
    </div>
  );
}

/**
 * Normalize tab-separated tabular blocks into markdown pipe tables.
 * Some models (Gemini especially) emit tables as tab-separated rows instead
 * of GFM pipe syntax — remark-gfm can't parse those, so we convert upstream.
 *
 * Detection: 2+ consecutive lines each with >=2 TAB chars and the same tab count.
 */
/**
 * Convert LaTeX math-mode symbol groups like `$\rightarrow$` or
 * `$\downarrow\downarrow$` into their Unicode equivalents. Models (esp. Gemini
 * and some Qwen variants) habitually wrap trend arrows in `$...$` even though
 * we never enabled a math renderer — so the raw LaTeX leaks through as text.
 *
 * Safety: only transforms `$...$` chunks whose contents are _exclusively_
 * known LaTeX command tokens. `$50`, `$5.00`, `$var$`, `$\rightarrow 10%$`
 * are all left untouched — on any unknown command we bail and keep the
 * original text rather than risk deleting content the user actually wanted.
 */
const LATEX_SYMBOLS: Record<string, string> = {
  // arrows
  rightarrow: "→", leftarrow: "←", uparrow: "↑", downarrow: "↓",
  leftrightarrow: "↔", updownarrow: "↕",
  Rightarrow: "⇒", Leftarrow: "⇐", Leftrightarrow: "⇔",
  to: "→", gets: "←",
  longrightarrow: "→", longleftarrow: "←", longleftrightarrow: "↔",
  nearrow: "↗", searrow: "↘", swarrow: "↙", nwarrow: "↖",
  // relations
  approx: "≈", neq: "≠", ne: "≠", geq: "≥", leq: "≤", ge: "≥", le: "≤",
  equiv: "≡", sim: "∼", propto: "∝",
  // operators & misc
  pm: "±", mp: "∓", times: "×", div: "÷", cdot: "·",
  infty: "∞", checkmark: "✓", bullet: "•",
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", theta: "θ",
  pi: "π", sigma: "σ", omega: "ω", mu: "μ",
  Delta: "Δ", Sigma: "Σ", Omega: "Ω",
};

/** Replace a LaTeX delimiter pair iff the body is exclusively known command
 *  tokens. Any unknown command → keep the match untouched. */
function replaceLatexDelim(src: string, pattern: RegExp): string {
  return src.replace(pattern, (match, body: string) => {
    let allKnown = true;
    const replaced = body.replace(/\\([a-zA-Z]+)/g, (raw: string, name: string) => {
      if (name in LATEX_SYMBOLS) return LATEX_SYMBOLS[name];
      allKnown = false;
      return raw;
    });
    return allKnown ? replaced.replace(/\s+/g, "") : match;
  });
}

function normalizeLatexSymbols(src: string): string {
  // Order matters: `$$...$$` must run before `$...$`, otherwise the inner
  // single-dollar pass would chew off the middle and leave stray `$`s.
  let s = src;
  s = replaceLatexDelim(s, /\$\$((?:\\[a-zA-Z]+\s*)+)\$\$/g);
  s = replaceLatexDelim(s, /\$((?:\\[a-zA-Z]+\s*)+)\$/g);
  s = replaceLatexDelim(s, /\\\(((?:\\[a-zA-Z]+\s*)+)\\\)/g);
  s = replaceLatexDelim(s, /\\\[((?:\\[a-zA-Z]+\s*)+)\\\]/g);
  return s;
}

/** `#Title` without the required space after `#` silently fails to render as
 *  a heading in GFM. Common small-model error. Leaves `###` separator rows
 *  alone (only adds a space when the char after the hashes is real content). */
function normalizeHeadingSpace(src: string): string {
  return src.replace(/^(#{1,6})([^\s#])/gm, "$1 $2");
}

function normalizeTabTables(src: string): string {
  const lines = src.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const tabCount = (lines[i].match(/\t/g) || []).length;
    if (tabCount >= 2) {
      // Look ahead for consecutive rows with matching tab count
      let j = i + 1;
      while (j < lines.length && (lines[j].match(/\t/g) || []).length === tabCount) j++;
      if (j - i >= 2) {
        // It's a table block — convert
        const rows = lines.slice(i, j).map(l => l.split("\t").map(c => c.trim()));
        const header = rows[0];
        const sep = header.map(() => "---");
        const body = rows.slice(1);
        out.push(`| ${header.join(" | ")} |`);
        out.push(`| ${sep.join(" | ")} |`);
        for (const row of body) out.push(`| ${row.join(" | ")} |`);
        i = j;
        continue;
      }
    }
    out.push(lines[i]);
    i++;
  }
  return out.join("\n");
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
          const lang = className?.replace(/language-/, "") || "";
          return <CodeBlock language={lang}>{children}</CodeBlock>;
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
      table: ({ children }) => (
        <div className="my-2 overflow-x-auto rounded-[var(--radius-6)]" style={{ border: "1px solid var(--color-border-primary)" }}>
          <table className="w-full text-[13px] border-collapse">{children}</table>
        </div>
      ),
      thead: ({ children }) => (
        <thead style={{ background: "var(--color-bg-tertiary)" }}>{children}</thead>
      ),
      tbody: ({ children }) => <tbody>{children}</tbody>,
      tr: ({ children }) => (
        <tr style={{ borderTop: "1px solid var(--color-border-primary)" }}>{children}</tr>
      ),
      th: ({ children, style }) => (
        <th
          className="px-2.5 py-1.5 text-left align-top"
          style={{ fontWeight: "var(--font-weight-semibold)", color: "var(--color-text-primary)", ...style }}
        >
          {children}
        </th>
      ),
      td: ({ children, style }) => (
        <td className="px-2.5 py-1.5 align-top" style={{ color: "var(--color-text-secondary)", ...style }}>
          {children}
        </td>
      ),
    }}
  >
    {normalizeTabTables(normalizeHeadingSpace(normalizeLatexSymbols(content)))}
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
  const { lang } = useT();
  const config = getAIConfig(settings);
  const connected = !!config;
  const label = (() => {
    if (!config) return lang === "zh" ? "未连接" : "Not connected";
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
  onRename,
  onNew,
  lang,
  agents,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onNew: () => void;
  lang: string;
  agents: AgentConfig[];
}) {
  const { t } = useT();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
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
      <div className="flex-1 overflow-y-auto px-2 pt-1 pb-3 space-y-0.5">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <p className="text-[13px]" style={{ color: "var(--color-text-quaternary)" }}>
              {t("ai.chat.noConversations")}
            </p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === activeId;
            return (
            <div
              key={conv.id}
              className={`ai-chat-conv-item group flex items-center gap-1.5 px-2.5 py-2 lg:py-1.5 rounded-lg cursor-pointer transition-colors ${isActive ? 'active' : 'ai-chat-conv-inactive'}`}
              style={{
                background: isActive ? "var(--color-bg-tertiary)" : "transparent",
              }}
              onClick={() => onSelect(conv.id)}
              onMouseEnter={undefined}
            >
              {/* Agent avatar for conversation */}
              {(() => {
                const ids = getConvAgentIds(conv);
                const firstAgent = ids.length > 0 ? agentMap.get(ids[0]) : null;
                return (
                  <span className="text-[16px] shrink-0 lg:hidden">
                    {ids.length > 1 ? '👥' : firstAgent?.avatar || '🤖'}
                  </span>
                );
              })()}
              <div className="flex-1 min-w-0">
                {editingId === conv.id ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                        const trimmed = editTitle.trim();
                        if (trimmed) onRename(conv.id, trimmed);
                        setEditingId(null);
                      }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => {
                      const trimmed = editTitle.trim();
                      if (trimmed) onRename(conv.id, trimmed);
                      setEditingId(null);
                    }}
                    className="input-base w-full px-1 py-0 text-[13px]"
                    autoFocus
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <p className="text-[13px] truncate" style={{ color: isActive ? "var(--color-text-primary)" : "var(--color-text-secondary)", fontWeight: isActive ? 500 : 400 }}>
                      {conv.title}
                    </p>
                    <p className="text-[11px] mt-0.5 lg:hidden" style={{ color: "var(--color-text-quaternary)" }}>
                      {formatTime(conv.updatedAt)} · {conv.messages.length} {lang === "zh" ? "条" : "msgs"}
                    </p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-0 shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); setEditTitle(conv.title); setEditingId(conv.id); }}
                  className="p-1.5 lg:p-1 rounded-md hover:bg-[var(--color-bg-secondary)]"
                  style={{ color: "var(--color-text-quaternary)" }}
                  aria-label={t("ai.chat.rename")}
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                  className="p-1.5 lg:p-1 rounded-md hover:bg-[var(--color-bg-secondary)]"
                  style={{ color: "var(--color-text-quaternary)" }}
                  aria-label="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );})
        )}
      </div>
    </div>
  );
}

/* ── Tool call parser ──────────────────────────────────────── */

/** Strip hallucinated tool call formats that some models output (e.g. <tool_code>, function calls) */
function cleanToolGarbage(text: string): string {
  return text
    // <tool_code>...</tool_code> or <tool_code>... (unclosed)
    .replace(/<tool_code>[\s\S]*?(<\/tool_code>|$)/gi, '')
    // <tool_call>...</tool_call>
    .replace(/<tool_call>[\s\S]*?(<\/tool_call>|$)/gi, '')
    // <function_call>...</function_call>
    .replace(/<function_call>[\s\S]*?(<\/function_call>|$)/gi, '')
    // Python-style function calls: func_name(arg="val", ...)
    .replace(/\b(send_\w+|create_\w+|update_\w+|delete_\w+|search_\w+|record_\w+|move_\w+|get_\w+|analyze_\w+|generate_\w+)\s*\([^)]*\)\s*/g, '')
    // Lone XML-style tool tags
    .replace(/<\/?(?:tool|function|action|command)_?\w*>/gi, '')
    .trim();
}

/** Try to extract a tool_call JSON from the AI response text */
function parseToolCall(text: string): ToolCall | null {
  // Direct parse path — only warn on failure if the text *looks* like JSON,
  // otherwise this fires on every plain-text reply and floods the console.
  const trimmed = text.trim();
  const looksJsonLike = trimmed.startsWith("{") || trimmed.startsWith("[");
  try {
    const direct = JSON.parse(trimmed);
    if (direct?.tool_call?.name) return direct.tool_call;
  } catch (e) {
    if (looksJsonLike && import.meta.env.DEV) {
      console.warn('[AIChat] tool_call direct parse failed:', e, trimmed.slice(0, 200));
    }
  }

  // Try extracting from markdown code fence
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (parsed?.tool_call?.name) return parsed.tool_call;
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[AIChat] tool_call fenced parse failed:', e, fenceMatch[1].slice(0, 200));
      }
    }
  }

  // Try extracting any {"tool_call": ...} block (greedy to catch nested objects)
  const jsonMatch = text.match(/\{\s*"tool_call"\s*:\s*\{[^}]*"name"\s*:\s*"[^"]+"\s*,\s*"args"\s*:\s*\{[^}]*\}\s*\}\s*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed?.tool_call?.name) return parsed.tool_call;
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[AIChat] tool_call narrow regex parse failed:', e, jsonMatch[0].slice(0, 200));
      }
    }
  }

  // Fallback: broader regex for any {"tool_call": {...}} pattern
  const broadMatch = text.match(/\{\s*"tool_call"\s*:\s*\{[\s\S]*?\}\s*\}/);
  if (broadMatch) {
    try {
      const parsed = JSON.parse(broadMatch[0]);
      if (parsed?.tool_call?.name) return parsed.tool_call;
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[AIChat] tool_call broad regex parse failed:', e, broadMatch[0].slice(0, 200));
      }
    }
  }

  return null;
}

/* ── Tool confirmation card ──────────────────────────────── */

function ToolConfirmCard({
  confirm,
  confirmKey,
  onConfirm,
  onReject,
  onUpdateArgs,
  lang,
  executing,
  result,
}: {
  confirm: ToolConfirmInfo;
  confirmKey: string | number;
  onConfirm: () => void;
  onReject: () => void;
  onUpdateArgs?: (args: Record<string, unknown>) => void;
  lang: string;
  executing: boolean;
  result?: { success: boolean; message: string } | null;
}) {
  const { t } = useT();
  const isTransaction = confirm.toolName === "record_transaction";
  const isTask = confirm.toolName === "create_task";
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

      {/* Scope selector for transactions and tasks */}
      {(isTransaction || isTask) && !result && onUpdateArgs && (
        <div className="px-3 pb-2 flex items-center gap-2">
          <span className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
            {t("ai.chat.scope")}
          </span>
          <div className="page-tabs" data-motion-pill style={{ fontSize: "var(--font-size-xs)" }}>
            {(["business", "personal"] as const).map(s => {
              const isMemo = confirm.args.scope === "work-memo";
              const isActive = isTask
                ? (s === "business" ? scope === "work" || scope === "work-memo" : scope === "personal")
                : scope === s;
              return (
                <button
                  key={s}
                  data-active={isActive}
                  onClick={() => {
                    if (isTask) {
                      const newScope = s === "personal" ? "personal" : (isMemo ? "work-memo" : "work");
                      onUpdateArgs({ ...confirm.args, scope: newScope });
                    } else {
                      const personalCats = new Set(["餐饮", "交通", "房租", "娱乐", "个人其他"]);
                      const curCat = confirm.args.category as string || "";
                      const isPersonal = s === "personal";
                      let newCat = curCat;
                      if (isPersonal && !personalCats.has(curCat)) {
                        newCat = confirm.args.type === "income" ? "个人其他" : "餐饮";
                      } else if (!isPersonal && personalCats.has(curCat)) {
                        newCat = confirm.args.type === "income" ? "收入" : "其他支出";
                      }
                      onUpdateArgs({ ...confirm.args, scope: s, category: newCat });
                    }
                  }}
                  className="px-2 py-1"
                  style={{ fontSize: "var(--font-size-xs)" }}
                >
                  {isActive && <TabPill groupId={`ai-scope-${confirmKey}`} />}
                  {s === "business" ? t("ai.chat.scopeBusiness") : t("ai.chat.scopePersonal")}
                </button>
              );
            })}
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
          <span className="text-[13px]">{result.success ? t("ai.chat.toolDone") : t("ai.chat.toolFailed")}</span>
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
            {t("ai.chat.confirmExec")}
          </button>
          <button
            onClick={onReject}
            disabled={executing}
            className="px-3 py-1.5 rounded-lg text-[13px] transition-colors disabled:opacity-50"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {t("common.cancel")}
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
  const { user, offlineMode } = useAuth();
  const { settings } = useAppSettings();
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const showToast = useUIStore((s) => s.showToast);
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
  const personalPreferences = useSettingsStore((s) => s.personalPreferences);

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
    // Per-user flag so that signing out → signing in as another account still seeds
    // defaults for the new user. Fall back to a shared key for offline/anonymous mode.
    const seededKey = `solo_agents_seeded:${user?.id || (offlineMode ? 'offline' : 'anon')}`;
    if (agents.length === 0 && !localStorage.getItem(seededKey)) {
      // True first-time user — seed defaults
      seedDefaults(l).then(() => {
        try { localStorage.setItem(seededKey, '1'); } catch { /* quota exceeded */ }
      }).catch((e) => {
        console.error('[Agent seed]', e);
        showToast(lang === 'zh' ? 'Agent 初始化失败，请刷新重试' : 'Agent setup failed, please refresh');
      });
    } else if (agents.length > 0) {
      // Existing user — seed any new templates added in updates
      seedMissing(l, agents).catch((e) => {
        console.error('[Agent seedMissing]', e);
      });
    }
  }, [agentsLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // First-ever use (null = never set): persist empty array → default assistant mode
  useEffect(() => {
    const saved = localStorage.getItem(LS_ACTIVE_AGENTS);
    if (saved === null && agents.length > 0) {
      // Explicitly save empty = default assistant chosen
      try { localStorage.setItem(LS_ACTIVE_AGENTS, '[]'); } catch { /* quota exceeded */ }
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
    try { localStorage.setItem(LS_ACTIVE_AGENTS, JSON.stringify(activeAgentIds)); } catch { /* quota exceeded */ }
    if (activeAgentIds.length > 0) {
      try { localStorage.setItem(LS_ACTIVE_AGENT, String(activeAgentIds[0])); } catch { /* quota exceeded */ }
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
  // Desktop-only: conversation list collapsed by default. User toggles via
  // MessagesSquare button in header. Persisted across sessions. Mobile uses
  // `showList` (full-screen takeover), desktop uses `desktopListOpen` (side panel).
  const [desktopListOpen, setDesktopListOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('ai-chat-desktop-list-open') === 'true'; }
    catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('ai-chat-desktop-list-open', String(desktopListOpen)); }
    catch { /* storage quota / private mode */ }
  }, [desktopListOpen]);

  // Header overflow menu ("...") — rename / clear / export / delete
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  // Inline title editing in header
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleText, setEditTitleText] = useState("");
  // Scroll-to-bottom floating button
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const activeConv = conversations.find(c => c.id === activeConvId) || null;
  const messages = activeConv?.messages || [];
  const activeConvAgentIds = activeConv ? getConvAgentIds(activeConv) : [];
  const isGroupConv = activeConvAgentIds.length > 1;

  const [input, setInput] = useState("");
  const [streamingConvId, setStreamingConvId] = useState<string | null>(null);
  const isStreaming = streamingConvId !== null;
  const isStreamingHere = streamingConvId !== null && streamingConvId === activeConvId; // only block THIS conversation
  const [executingTool, setExecutingTool] = useState(false);
  const [editingMsgIndex, setEditingMsgIndex] = useState<number | null>(null);
  const [editingMsgText, setEditingMsgText] = useState("");
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [pageContext, setPageContext] = useState<Record<string, unknown> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Forward reference: the function is defined further down the component body but
  // needs to be callable from a callback created earlier. Typed as nullable so TS
  // forces a guard; the call site below guards before invoking.
  const streamOneAgentRef = useRef<((convId: string, agent: AgentConfig | null, aiConfig: { provider: string; apiKey: string }, abort: AbortController) => Promise<void>) | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);

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

  // Abort any in-flight streaming request on unmount, and flush any debounced
  // conversation syncs so the last edit before unmount isn't dropped.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      flushPendingSyncs();
    };
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
      try { localStorage.setItem(LS_ACTIVE_CONV, activeConvId); } catch { /* quota exceeded */ }
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

  // Track whether user is near the scroll bottom. If the user has scrolled up
  // to read older messages, don't yank them back down on every streaming tick.
  const nearBottomRef = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      const near = el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
      nearBottomRef.current = near;
      setShowScrollBottom(!near && messages.length > 0);
    };
    el.addEventListener('scroll', handler, { passive: true });
    handler();
    return () => el.removeEventListener('scroll', handler);
  }, [messages.length]);

  // Auto-scroll to bottom, only if user is already near the bottom
  useEffect(() => {
    if (scrollRef.current && nearBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  // Focus input when opened or switched conversation; clear stale UI states; sync picker
  useEffect(() => {
    if (open && !showList) setTimeout(() => inputRef.current?.focus(), 100);
    setMentionQuery(null);
    setShowAgentPicker(false);
    setShowMoreMenu(false);
    setEditingTitle(false);
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
      title: t("ai.chat.newChat"),
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

  const handleRenameConversation = useCallback((id: string, newTitle: string) => {
    updateConversations(prev => prev.map(c =>
      c.id === id ? { ...c, title: newTitle, updatedAt: Date.now() } : c
    ));
  }, [updateConversations]);

  /** Export current conversation as a Markdown file. */
  const handleExportConversation = useCallback((conv: Conversation) => {
    const dateStr = new Date(conv.createdAt).toISOString().slice(0, 10);
    const lines: string[] = [];
    lines.push(`# ${conv.title}`);
    lines.push("");
    lines.push(`*${dateStr}*`);
    lines.push("");
    for (const m of conv.messages) {
      if (m.toolConfirm) continue;
      const role = m.role === "user"
        ? (operatorName || (lang === "zh" ? "我" : "Me"))
        : (agentMap.get(m.agentId ?? -1)?.name || t("ai.chat.defaultAssistant"));
      lines.push(`### ${role}`);
      lines.push("");
      lines.push(m.content || "");
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeTitle = conv.title.replace(/[^\w\u4e00-\u9fa5-]+/g, "_").slice(0, 40);
    a.download = `ai-chat-${safeTitle}-${dateStr}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t("ai.chat.exported"));
  }, [operatorName, lang, t, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  /** "Clear context" — start a fresh conversation with the same agents. */
  const handleClearContext = useCallback(() => {
    handleNewConversation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    const useNativeTools = aiConfig.provider === "ollama" || aiConfig.provider === "lmstudio";
    const sym = getCurrencySymbol(currency, lang);
    const systemPrompt = buildSystemPrompt(dashboard, pageContext, activeTab, lang, operatorName, businessDesc, currency, agent, isGroup, useNativeTools, personalPreferences);

    // Build chat history — skip cancelled tool confirmations, prefix group agent names
    // Include image attachments on user messages so the AI can see uploaded images
    const chatHistory: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...currentMsgs
        .filter(m => !m.streaming && !m.toolConfirm) // exclude pending confirmations
        .filter(m => !(m.toolResult && !m.toolResult.success && m.content.startsWith('~~'))) // exclude skipped confirmations
        .slice(-20)
        .map(m => {
          // Convert MessageAttachment[] → ChatAttachment[] (only those with actual data)
          const chatAttachments: ChatAttachment[] | undefined =
            m.attachments?.filter(a => a.base64).map(a => ({
              mimeType: a.mimeType, base64: a.base64, fileName: a.fileName,
            }));
          const hasAttachments = chatAttachments && chatAttachments.length > 0;

          if (isGroup && m.role === "assistant" && m.agentId && m.agentId !== agent?.id) {
            const otherName = agentMap.get(m.agentId)?.name || 'Assistant';
            return { role: m.role as "user" | "assistant", content: `[${otherName}]: ${m.content}` };
          }
          return {
            role: m.role as "user" | "assistant",
            content: m.content,
            ...(hasAttachments ? { attachments: chatAttachments } : {}),
          };
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

    // Shared tool context for this turn — endpoint cache persists across
    // tool calls in the multi-step loop (e.g. search_data then update_task
    // won't re-fetch /api/tasks) and mutations auto-invalidate.
    const toolCtx = createToolContext(sym);

    // --- Autonomous execution loop ---
    while (stepCount < MAX_AGENT_STEPS && !abort.signal.aborted) {
      stepCount++;

      // For local models, pass native tool definitions for reliable function calling
      const allowedToolNames = agent?.tools ?? null;
      const nativeTools: NativeToolDef[] | undefined = (aiConfig.provider === "ollama" || aiConfig.provider === "lmstudio")
        ? (allowedToolNames
            ? AGENT_TOOLS.filter(t => allowedToolNames.includes(t.name))
            : allowedToolNames === null ? AGENT_TOOLS : [] // null=all, []=none
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
      const allowedNames = agent?.tools ?? null;
      if (allowedNames !== null && !allowedNames.includes(toolCall.name)) {
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
      // Security: unknown tool names default to "destructive" (never auto-execute).
      // If a model hallucinates / mis-spells a tool name, we must require explicit
      // user confirmation rather than silently treating it as a safe write.
      const safety = TOOL_SAFETY[toolCall.name] ?? "destructive";
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

      // Execute the tool (shared ctx → endpoint cache reused across steps)
      const toolResult = await executeTool(toolCall, toolCtx);
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
  }, [dashboard, pageContext, activeTab, lang, operatorName, businessDesc, currency, personalPreferences, agentMap, updateConversations]);
  streamOneAgentRef.current = streamOneAgent;

  /** Shared helper: resolve agents for a conversation and stream responses */
  const resendFromConv = useCallback(async (convId: string) => {
    if (streamingConvId !== null) return;
    const aiConfig = getAIConfig(settings);
    if (!aiConfig) return;

    const conv = conversationsRef.current.find(c => c.id === convId);
    if (!conv) return;

    // Find the last user message to extract @mentions
    const lastUserMsg = [...conv.messages].reverse().find(m => m.role === "user");
    const convAgentIds = getConvAgentIds(conv);
    const resolved = convAgentIds.length > 0
      ? convAgentIds.map(id => agentMap.get(id) || null).filter(Boolean)
      : [];
    let respondingAgents: (AgentConfig | null)[] = resolved.length > 0
      ? resolved
      : (activeAgent ? [activeAgent] : [null]);

    // Parse @mentions
    if (lastUserMsg) {
      const mentionPattern = /@(\S+)/g;
      const mentions: string[] = [];
      let match;
      while ((match = mentionPattern.exec(lastUserMsg.content)) !== null) mentions.push(match[1]);
      if (mentions.length > 0 && convAgentIds.length > 0) {
        const mentioned = respondingAgents.filter(a =>
          a && mentions.some(m => a.name.toLowerCase().startsWith(m.toLowerCase()))
        );
        if (mentioned.length > 0) respondingAgents = mentioned;
      }
    }

    setStreamingConvId(convId);
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      for (const agent of respondingAgents) {
        if (abort.signal.aborted) break;
        try {
          if (!streamOneAgentRef.current) break;
          await streamOneAgentRef.current(convId, agent, aiConfig, abort);
        } catch (agentErr) {
          if ((agentErr as Error).name === "AbortError") break;
          updateConversations(prev => prev.map(c => {
            if (c.id !== convId) return c;
            const msgs = [...c.messages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === "assistant" && last.streaming) {
              msgs[msgs.length - 1] = { ...last, content: lang === "zh" ? "(连接超时，请重试)" : "(Connection timed out)", streaming: false };
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
          msgs[msgs.length - 1] = { ...last, content: lang === "zh" ? "请求失败，请稍后重试。" : "Request failed. Please try again." };
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
  }, [streamingConvId, settings, activeAgent, agentMap, lang, updateConversations]);

  const sendMessage = useCallback(async (text: string, attachments?: MessageAttachment[]) => {
    if (!text.trim() && !attachments?.length) return;
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
      const noProviderUserMsg: Message = { role: "user" as const, content: text, timestamp: Date.now(), ...(attachments?.length ? { attachments } : {}) };
      updateConversations(prev => prev.map(c => {
        if (c.id !== convId) return c;
        const newMsgs = [...c.messages, noProviderUserMsg, { role: "assistant" as const, content: t("ai.chat.noProvider"), timestamp: Date.now() }];
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

    // Add user message (with optional attachments)
    const userMsg: Message = { role: "user" as const, content: text, timestamp: Date.now(), ...(attachments?.length ? { attachments } : {}) };
    updateConversations(prev => prev.map(c => {
      if (c.id !== convId) return c;
      const newMsgs = [...c.messages, userMsg];
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
      const sym = getCurrencySymbol(currency, lang);
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

  /** Regenerate the last assistant response */
  const handleRegenerate = useCallback(async () => {
    if (!activeConvId || streamingConvId !== null) return;
    const conv = conversationsRef.current.find(c => c.id === activeConvId);
    if (!conv || conv.messages.length === 0) return;

    // Find the last user message index
    let lastUserIdx = -1;
    for (let i = conv.messages.length - 1; i >= 0; i--) {
      if (conv.messages[i].role === "user") { lastUserIdx = i; break; }
    }
    if (lastUserIdx === -1) return;

    // Remove all messages after the last user message
    updateConversations(prev => prev.map(c => {
      if (c.id !== activeConvId) return c;
      return { ...c, messages: c.messages.slice(0, lastUserIdx + 1), updatedAt: Date.now() };
    }));

    await resendFromConv(activeConvId);
  }, [activeConvId, streamingConvId, updateConversations, resendFromConv]);

  const handleSubmitEdit = useCallback(async () => {
    if (editingMsgIndex === null || !activeConvId || streamingConvId !== null) return;
    const text = editingMsgText.trim();
    if (!text) return;

    // Truncate messages up to and including the edited message, update its content
    updateConversations(prev => prev.map(c => {
      if (c.id !== activeConvId) return c;
      const truncated = c.messages.slice(0, editingMsgIndex + 1);
      truncated[editingMsgIndex] = { ...truncated[editingMsgIndex], content: text };
      return { ...c, messages: truncated, updatedAt: Date.now() };
    }));

    setEditingMsgIndex(null);
    setEditingMsgText("");

    await resendFromConv(activeConvId);
  }, [editingMsgIndex, editingMsgText, activeConvId, streamingConvId, updateConversations, resendFromConv]);

  /* ── File upload helpers ──────────────────────────── */
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  const MAX_ATTACHMENTS = 5;
  const ACCEPTED_TYPES = "image/png,image/jpeg,image/gif,image/webp";

  /** Compress an image file to a manageable base64 (max 1200px, JPEG quality 0.8) */
  const compressImage = useCallback((file: File): Promise<MessageAttachment> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new window.Image();
        img.onload = () => {
          const maxDim = 1200;
          let w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) {
            const ratio = Math.min(maxDim / w, maxDim / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, w, h);
          const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
          const quality = outputType === "image/jpeg" ? 0.8 : undefined;
          const dataUrl = canvas.toDataURL(outputType, quality);
          const base64 = dataUrl.split(",")[1];
          resolve({ mimeType: outputType, base64, fileName: file.name, dataUrl });
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }, []);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    const remaining = MAX_ATTACHMENTS - pendingAttachments.length;
    const toProcess = arr.slice(0, remaining);
    const results: MessageAttachment[] = [];
    for (const file of toProcess) {
      if (file.size > MAX_FILE_SIZE) continue;
      if (!file.type.startsWith("image/")) continue;
      try {
        const att = await compressImage(file);
        results.push(att);
      } catch { /* skip unprocessable files */ }
    }
    if (results.length) {
      setPendingAttachments(prev => [...prev, ...results].slice(0, MAX_ATTACHMENTS));
    }
  }, [pendingAttachments.length, compressImage]);

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      processFiles(e.target.files);
      e.target.value = ""; // Reset so same file can be selected again
    }
  }, [processFiles]);

  const removeAttachment = useCallback((idx: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== idx));
  }, []);

  /** Handle drag-and-drop on the chat area */
  const [isDragOver, setIsDragOver] = useState(false);
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  /** Handle paste images from clipboard */
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length) {
      e.preventDefault();
      processFiles(imageFiles);
    }
  }, [processFiles]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if ((!text && !pendingAttachments.length) || streamingConvId !== null) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    const attachments = pendingAttachments.length ? [...pendingAttachments] : undefined;
    setPendingAttachments([]);
    sendMessage(text, attachments);
  }, [input, sendMessage, streamingConvId, pendingAttachments]);

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
          {/* Backdrop — tablet only (hidden on mobile and desktop) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="ai-chat-backdrop fixed inset-0 z-[var(--layer-dialog)] hidden lg:block"
            style={{ background: "var(--color-overlay-primary)" }}
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, x: "-100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "-100%" }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="ai-chat-panel fixed z-[var(--layer-dialog)] flex flex-col overflow-hidden
              inset-0
              lg:inset-y-1 lg:right-1 lg:left-auto lg:w-[88%] lg:max-w-[1280px] lg:rounded-[var(--radius-16)]"
            style={{
              background: "var(--color-bg-primary)",
              boxShadow: "var(--shadow-high)",
              border: "1px solid var(--color-line-secondary)",
            }}
          >
          {/* Header — minimal */}
          <div
            className="flex items-center justify-between gap-2 px-3 shrink-0"
            style={{
              minHeight: 48,
              paddingTop: "env(safe-area-inset-top, 0px)",
              borderBottom: "1px solid var(--color-line-tertiary)",
            }}
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {!showList && conversations.length > 0 && (
                <button
                  onClick={() => {
                    // Desktop (>= 744px): toggle the side panel.
                    // Mobile: open the full-screen list takeover.
                    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 744px)').matches) {
                      setDesktopListOpen(v => !v);
                    } else {
                      setShowList(true);
                    }
                  }}
                  className="btn-icon-sm flex items-center gap-1 shrink-0"
                  style={desktopListOpen ? { background: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' } : undefined}
                  aria-label={t("ai.chat.conversations")}
                  aria-pressed={desktopListOpen}
                  title={t("ai.chat.conversations")}
                >
                  <MessagesSquare size={16} />
                </button>
              )}
              {/* Agent picker — only shown when user has >= 2 agents OR is in multi-select mode.
                  Single-agent users see a plain avatar only (no dropdown noise). */}
              {!showList && agents.length >= 2 && (
                <div className="relative shrink-0">
                  <button
                    onClick={() => setShowAgentPicker(!showAgentPicker)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[13px] transition-colors hover:bg-[var(--color-bg-tertiary)]"
                    style={{ color: 'var(--color-text-secondary)' }}
                    aria-label={t("ai.chat.selectParticipants")}
                  >
                    {isMultiAgent ? (
                      <>
                        <span className="flex -space-x-1">{activeAgents.slice(0, 3).map(a => <span key={a.id}>{a.avatar}</span>)}</span>
                        <span style={{ fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{activeAgents.length}</span>
                      </>
                    ) : activeAgent ? (
                      <span>{activeAgent.avatar}</span>
                    ) : (
                      <span style={{ color: 'var(--color-text-tertiary)' }}>🤖</span>
                    )}
                    <ChevronDown size={12} style={{ color: 'var(--color-text-quaternary)' }} />
                  </button>
                  <AnimatePresence>
                  {showAgentPicker && (
                    <>
                      <div className="fixed inset-0" style={{ zIndex: 'var(--layer-popover, 600)' } as React.CSSProperties} onClick={() => setShowAgentPicker(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.96 }}
                        transition={{ duration: 0.12, ease: [0.4, 0, 0.2, 1] }}
                        className="absolute top-full left-0 mt-1 rounded-xl py-1 min-w-[200px] max-lg:fixed max-lg:inset-x-2 max-lg:top-auto max-lg:bottom-16 max-lg:left-2 max-lg:right-2 max-lg:rounded-2xl max-lg:py-2"
                        style={{
                          background: 'var(--color-bg-secondary)',
                          border: '1px solid var(--color-border-translucent)',
                          boxShadow: 'var(--shadow-high)',
                          zIndex: 'var(--layer-popover, 600)' as unknown as number,
                          maxHeight: 'min(60vh, 360px)',
                          overflowY: 'auto',
                          transformOrigin: 'top left',
                        }}
                      >
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
                                  const next = selected
                                    ? activeAgentIds.filter(id => id !== a.id)
                                    : [...activeAgentIds, a.id];
                                  setActiveAgentIds(next);
                                  if (activeConvId) {
                                    updateConversations(prev => prev.map(c => c.id !== activeConvId ? c : {
                                      ...c,
                                      agentId: next[0] || null,
                                      agentIds: next.length > 0 ? [...next] : [],
                                      updatedAt: Date.now(),
                                    }));
                                  }
                                }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-left transition-colors"
                                style={{
                                  background: selected ? 'var(--color-bg-tertiary)' : 'transparent',
                                  color: 'var(--color-text-primary)',
                                }}
                              >
                                <span>{a.avatar || '🤖'}</span>
                                <span className="flex-1 min-w-0 truncate">{a.name}</span>
                                {selected && <Check size={14} style={{ color: 'var(--color-text-tertiary)' }} />}
                              </button>
                            );
                          });
                        })()}
                        <div className="mx-2 my-1" style={{ borderTop: '1px solid var(--color-line-tertiary)' }} />
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
                          className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-left transition-colors"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          <Settings size={13} />
                          <span>{t("ai.chat.manageAgents")}</span>
                        </button>
                      </motion.div>
                    </>
                  )}
                  </AnimatePresence>
                </div>
              )}

              {/* Single-agent fallback — just an avatar, no dropdown */}
              {!showList && agents.length < 2 && activeAgent && (
                <span className="shrink-0 text-[15px]" title={activeAgent.name} aria-hidden="true">
                  {activeAgent.avatar || '🤖'}
                </span>
              )}
              {!showList && agents.length < 2 && !activeAgent && (
                <span className="shrink-0 text-[15px]" aria-hidden="true">🤖</span>
              )}

              {/* Conversation title — inline editable (desktop + mobile). Truncates when long. */}
              {!showList && activeConv && (
                editingTitle ? (
                  <input
                    type="text"
                    value={editTitleText}
                    onChange={(e) => setEditTitleText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                        const trimmed = editTitleText.trim();
                        if (trimmed && activeConv) handleRenameConversation(activeConv.id, trimmed);
                        setEditingTitle(false);
                      }
                      if (e.key === "Escape") setEditingTitle(false);
                    }}
                    onBlur={() => {
                      const trimmed = editTitleText.trim();
                      if (trimmed && activeConv) handleRenameConversation(activeConv.id, trimmed);
                      setEditingTitle(false);
                    }}
                    autoFocus
                    className="input-base flex-1 min-w-0 px-2 py-1 text-[13px]"
                    style={{ fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
                    aria-label={t("ai.chat.renameConversation")}
                  />
                ) : (
                  <button
                    onClick={() => {
                      setEditTitleText(activeConv.title);
                      setEditingTitle(true);
                    }}
                    className="min-w-0 flex-1 px-1.5 py-1 rounded-lg text-[13px] text-left truncate transition-colors hover:bg-[var(--color-bg-tertiary)]"
                    style={{ color: 'var(--color-text-secondary)', fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
                    title={activeConv.title}
                  >
                    {activeConv.title || t("ai.chat.untitledChat")}
                  </button>
                )
              )}
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              {!showList && (
                <button onClick={handleNewConversation} className="btn-icon-sm" aria-label={t("ai.chat.newChat")} title={t("ai.chat.newChat")}>
                  <Plus size={18} />
                </button>
              )}
              {/* Overflow "…" menu — current conversation actions (rename / clear / export / delete) */}
              {!showList && activeConv && (
                <div className="relative shrink-0">
                  <button
                    onClick={() => setShowMoreMenu(v => !v)}
                    className="btn-icon-sm"
                    aria-label={t("ai.chat.moreOptions")}
                    title={t("ai.chat.moreOptions")}
                    aria-expanded={showMoreMenu}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  <AnimatePresence>
                  {showMoreMenu && (
                    <>
                      <div
                        className="fixed inset-0"
                        style={{ zIndex: 'var(--layer-popover, 600)' } as React.CSSProperties}
                        onClick={() => setShowMoreMenu(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.96 }}
                        transition={{ duration: 0.12, ease: [0.4, 0, 0.2, 1] }}
                        className="absolute top-full right-0 mt-1 rounded-xl py-1 min-w-[200px]"
                        style={{
                          background: 'var(--color-bg-secondary)',
                          border: '1px solid var(--color-border-translucent)',
                          boxShadow: 'var(--shadow-high)',
                          zIndex: 'var(--layer-popover, 600)' as unknown as number,
                          transformOrigin: 'top right',
                        }}
                      >
                        <button
                          onClick={() => {
                            setShowMoreMenu(false);
                            if (activeConv) {
                              setEditTitleText(activeConv.title);
                              setEditingTitle(true);
                            }
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-left transition-colors hover:bg-[var(--color-bg-tertiary)]"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          <Pencil size={13} style={{ color: 'var(--color-text-tertiary)' }} />
                          <span>{t("ai.chat.renameConversation")}</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowMoreMenu(false);
                            handleClearContext();
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-left transition-colors hover:bg-[var(--color-bg-tertiary)]"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          <Eraser size={13} style={{ color: 'var(--color-text-tertiary)' }} />
                          <span>{t("ai.chat.clearContext")}</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowMoreMenu(false);
                            if (activeConv) handleExportConversation(activeConv);
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-left transition-colors hover:bg-[var(--color-bg-tertiary)]"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          <Download size={13} style={{ color: 'var(--color-text-tertiary)' }} />
                          <span>{t("ai.chat.exportConversation")}</span>
                        </button>
                        <div className="mx-2 my-1" style={{ borderTop: '1px solid var(--color-line-tertiary)' }} />
                        <button
                          onClick={() => {
                            setShowMoreMenu(false);
                            if (activeConv && window.confirm(t("ai.chat.confirmDelete"))) {
                              handleDeleteConversation(activeConv.id);
                            }
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-left transition-colors hover:bg-[var(--color-bg-tertiary)]"
                          style={{ color: 'var(--color-danger)' }}
                        >
                          <Trash2 size={13} />
                          <span>{t("ai.chat.deleteConversation")}</span>
                        </button>
                      </motion.div>
                    </>
                  )}
                  </AnimatePresence>
                </div>
              )}
              <button onClick={handleClose} className="btn-icon-sm" aria-label={t("common.close")}>
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Desktop sidebar — only when user has conversations AND has toggled it open.
                Default closed saves ~180px of horizontal space in push-mode.
                Animated width+opacity so content reflow feels continuous, not abrupt. */}
            <AnimatePresence>
              {desktopListOpen && conversations.length > 0 && (
                <motion.div
                  key="desktop-conv-sidebar"
                  className="hidden lg:flex lg:flex-col lg:shrink-0 overflow-hidden"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 180, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                  style={{ borderRight: '1px solid var(--color-line-tertiary)' }}
                >
                  <div style={{ width: 180, flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <ConversationList
                      conversations={conversations}
                      activeId={activeConvId}
                      onSelect={handleSelectConversation}
                      onDelete={handleDeleteConversation}
                      onRename={handleRenameConversation}
                      onNew={handleNewConversation}
                      lang={lang}
                      agents={agents}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mobile conversation list — toggled */}
            {showList && (
              <div className="flex-1 flex flex-col lg:hidden">
                {/* Mobile list header */}
                <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--color-line-tertiary)' }}>
                  <span className="text-[14px]" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                    {t("ai.chat.conversations")}
                  </span>
                  <span className="text-[12px]" style={{ color: 'var(--color-text-quaternary)' }}>
                    {conversations.length} {lang === "zh" ? "个对话" : "chats"}
                  </span>
                </div>
                <ConversationList
                  conversations={conversations}
                  activeId={activeConvId}
                  onSelect={(id) => { handleSelectConversation(id); setShowList(false); }}
                  onDelete={handleDeleteConversation}
                  onRename={handleRenameConversation}
                  onNew={() => { handleNewConversation(); setShowList(false); }}
                  lang={lang}
                  agents={agents}
                />
                {/* Mobile new chat button at bottom */}
                <div className="px-3 py-3" style={{ borderTop: '1px solid var(--color-line-tertiary)' }}>
                  <button
                    onClick={() => { handleNewConversation(); setShowList(false); }}
                    className="ai-chat-new-btn w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[14px] transition-colors"
                    style={{ background: 'var(--color-accent)', color: 'var(--color-brand-text)', fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
                  >
                    <Plus size={16} />
                    {t("ai.chat.newChat")}
                  </button>
                </div>
              </div>
            )}

            {/* Chat area */}
            <div className={`flex-1 flex flex-col min-w-0 relative ${showList ? 'hidden lg:flex' : 'flex'}`}>
              {/* Messages (with drag-drop zone for image upload) */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-3 sm:px-5 lg:px-5 py-4 lg:py-4 space-y-4 lg:space-y-5 relative"
                style={{ overscrollBehavior: "contain" }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {/* Drag overlay */}
                {isDragOver && (
                  <div
                    className="absolute inset-0 z-10 flex items-center justify-center rounded-lg"
                    style={{ background: 'rgba(var(--color-accent-rgb, 99,102,241), 0.08)', border: '2px dashed var(--color-accent)', pointerEvents: 'none' }}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <ImageIcon size={32} style={{ color: 'var(--color-accent)' }} />
                      <span className="text-[14px] font-medium" style={{ color: 'var(--color-accent)' }}>
                        {lang === "zh" ? "拖放图片到这里" : "Drop image here"}
                      </span>
                    </div>
                  </div>
                )}
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 lg:gap-4 max-w-[480px] mx-auto px-1">
                    {hasAI ? (
                      <>
                        {activeAgents.length > 1 ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="flex -space-x-2">
                              {activeAgents.map(a => (
                                <div key={a.id} className="flex items-center justify-center rounded-full text-[16px] ring-2 ring-[var(--color-bg-primary)]" style={{ width: 32, height: 32, background: 'var(--color-bg-tertiary)' }}>{a.avatar}</div>
                              ))}
                            </div>
                            <p className="text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>{t("ai.chat.teamReady")}</p>
                          </div>
                        ) : activeAgent ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-2xl">{activeAgent.avatar}</span>
                            <p className="text-[14px]" style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>{activeAgent.name}</p>
                            {activeAgent.role && <p className="text-[12px] text-center max-w-[300px]" style={{ color: 'var(--color-text-tertiary)' }}>{activeAgent.role.slice(0, 60)}</p>}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <PeepIllustration name="pondering" size={72} />
                            <p className="text-[12px] text-center max-w-[280px]" style={{ color: 'var(--color-text-tertiary)' }}>{t("ai.chat.defaultDesc")}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                          {quickPrompts.map((qp, i) => (
                            <button
                              key={i}
                              onClick={() => sendMessage(qp.prompt)}
                              disabled={isStreaming}
                              className="ai-chat-quick-prompt px-3 py-2.5 rounded-2xl text-[13px] text-left transition-colors hover:opacity-80 press-feedback disabled:opacity-40 disabled:pointer-events-none"
                              style={{ background: "var(--color-bg-secondary)", color: "var(--color-text-secondary)", border: "1px solid var(--color-line-tertiary)" }}
                            >
                              {qp.label}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <PeepIllustration name="roboto" size={72} />
                        <p className="text-[13px] text-center" style={{ color: "var(--color-text-tertiary)" }}>{t("ai.chat.noProvider")}</p>
                        <button
                          onClick={() => { setActiveTab("settings"); handleClose(); const tryScroll = (n = 0) => { const el = document.getElementById('settings-ai'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); else if (n < 3) setTimeout(() => tryScroll(n + 1), 150); }; setTimeout(tryScroll, 80); }}
                          className="px-4 py-1.5 rounded-full text-[13px] transition-colors"
                          style={{ background: "var(--color-accent)", color: "var(--color-brand-text)" }}
                        >{t("common.goSettings")}</button>
                      </div>
                    )}
                  </div>
                )}
                {messages.map((msg, i) => {
                  const msgAgent = msg.agentId != null ? agentMap.get(msg.agentId) : null;
                  const isUser = msg.role === "user";
                  const prevMsg = i > 0 ? messages[i - 1] : null;
                  const sameSender = prevMsg
                    && prevMsg.role === msg.role
                    && (prevMsg.agentId || null) === (msg.agentId || null)
                    && !prevMsg.toolConfirm;
                  const senderName = isUser ? operatorName : (msgAgent?.name || t("ai.chat.defaultAssistant"));

                  return (
                  <div key={i} className="w-full">
                    {/* Group chat: always show agent avatar + name */}
                    {!isUser && isGroupConv && (
                      <div className="flex items-center gap-1.5 mb-1.5 ml-0.5">
                        <span className="text-[14px]">{msgAgent?.avatar || '🤖'}</span>
                        <span className="text-[13px]" style={{ color: "var(--color-text-secondary)", fontWeight: 600 }}>{senderName}</span>
                      </div>
                    )}

                    {msg.toolConfirm ? (
                      <ToolConfirmCard
                        confirm={msg.toolConfirm}
                        confirmKey={`${activeConvId ?? "c"}-${i}`}
                        onConfirm={() => handleToolConfirm(i)}
                        onReject={() => handleToolReject(i)}
                        onUpdateArgs={(newArgs) => {
                          if (!activeConvId) return;
                          updateConversations(prev => prev.map(c => {
                            if (c.id !== activeConvId) return c;
                            const msgs = [...c.messages];
                            const m = msgs[i];
                            if (!m?.toolConfirm) return c;
                            const updated = buildConfirmInfo({ name: m.toolConfirm.toolName, args: newArgs }, lang, getCurrencySymbol(currency, lang));
                            msgs[i] = { ...m, toolConfirm: updated };
                            return { ...c, messages: msgs };
                          }));
                        }}
                        lang={lang}
                        executing={executingTool}
                        result={msg.toolResult}
                      />
                    ) : isUser ? (
                      /* ── User message ── */
                      <div className="flex justify-end">
                        <div className="group/user relative max-w-[92%] sm:max-w-[85%]">
                          {/* Attached images */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className={`flex flex-wrap gap-1.5 justify-end ${msg.content ? 'mb-2' : ''}`}>
                              {msg.attachments.map((att, ai) =>
                                att.dataUrl ? (
                                  <img key={ai} src={att.dataUrl} alt={att.fileName} className="rounded-xl max-h-[200px] max-w-full object-contain cursor-pointer" onClick={() => window.open(att.dataUrl, '_blank')} />
                                ) : (
                                  <div key={ai} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px]" style={{ background: 'var(--color-bg-tertiary)' }}>
                                    <ImageIcon size={14} /><span>{att.fileName}</span>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                          {editingMsgIndex === i ? (
                            <div className="w-full min-w-0 sm:min-w-[280px]">
                              <textarea
                                className="w-full rounded-2xl px-3 sm:px-4 py-3 text-[16px] lg:text-[14px] leading-relaxed resize-none border-0 outline-none"
                                style={{ background: "var(--color-bg-secondary)", color: "var(--color-text-primary)", minHeight: 60, border: "1px solid var(--color-line-secondary)" }}
                                value={editingMsgText}
                                onChange={e => setEditingMsgText(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSubmitEdit(); }
                                  if (e.key === "Escape") { setEditingMsgIndex(null); setEditingMsgText(""); }
                                }}
                                autoFocus
                              />
                              <div className="flex justify-end gap-1.5 mt-2">
                                <button onClick={() => { setEditingMsgIndex(null); setEditingMsgText(""); }} className="px-3 sm:px-3.5 py-1.5 rounded-full text-[13px] transition-colors hover:bg-[var(--color-bg-tertiary)]" style={{ color: "var(--color-text-secondary)" }}>{t("common.cancel")}</button>
                                <button onClick={handleSubmitEdit} className="px-3 sm:px-3.5 py-1.5 rounded-full text-[13px] transition-colors" style={{ background: "var(--color-text-primary)", color: "var(--color-bg-primary)" }}>{t("ai.chat.send")}</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div
                                className="ai-chat-bubble-user rounded-3xl px-3.5 sm:px-4 py-2.5 text-[14px] leading-relaxed inline-block"
                                style={{ background: "var(--color-bg-secondary)", color: "var(--color-text-primary)", whiteSpace: "pre-wrap", overflowWrap: "break-word" as const }}
                              >
                                {msg.content}
                              </div>
                              {!isStreamingHere && (
                                <button
                                  onClick={() => { setEditingMsgIndex(i); setEditingMsgText(typeof msg.content === "string" ? msg.content : ""); }}
                                  className="absolute -left-8 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all max-lg:hidden lg:opacity-0 lg:group-hover/user:opacity-100 hover:bg-[var(--color-bg-secondary)]"
                                  title={t("ai.chat.editMessage")}
                                >
                                  <Pencil size={13} style={{ color: "var(--color-text-quaternary)" }} />
                                </button>
                              )}
                              {/* Mobile edit — small icon below bubble, only on last user msg */}
                              {!isStreamingHere && !messages.slice(i + 1).some(m => m.role === 'user') && (
                                <button
                                  onClick={() => { setEditingMsgIndex(i); setEditingMsgText(typeof msg.content === "string" ? msg.content : ""); }}
                                  className="lg:hidden p-1 rounded-md mt-0.5 ml-auto transition-colors active:bg-[var(--color-bg-tertiary)]"
                                  style={{ color: "var(--color-text-quaternary)" }}
                                  title={t("ai.chat.editMessage")}
                                >
                                  <Pencil size={12} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* ── Assistant message ── */
                      <div className="group/assistant">
                        {/* Attached images */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className={`flex flex-wrap gap-1.5 ${msg.content ? 'mb-2' : ''}`}>
                            {msg.attachments.map((att, ai) =>
                              att.dataUrl ? (
                                <img key={ai} src={att.dataUrl} alt={att.fileName} className="rounded-xl max-h-[200px] max-w-full object-contain cursor-pointer" onClick={() => window.open(att.dataUrl, '_blank')} />
                              ) : (
                                <div key={ai} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px]" style={{ background: 'var(--color-bg-tertiary)' }}>
                                  <ImageIcon size={14} /><span>{att.fileName}</span>
                                </div>
                              )
                            )}
                          </div>
                        )}
                        {msg.content ? (
                          <>
                            <div className="text-[14px] leading-relaxed" style={{ color: "var(--color-text-primary)", overflowWrap: "break-word" as const, ...(isGroupConv && msg.agentId ? { borderLeft: `3px solid ${AGENT_COLORS[activeConvAgentIds.indexOf(msg.agentId) % AGENT_COLORS.length]}`, paddingLeft: 12 } : {}) }}>
                              <MarkdownContent content={cleanToolGarbage(msg.content)} />
                            </div>
                            {!msg.streaming && (
                              <div className="flex items-center gap-0.5 mt-1.5 lg:mt-2 lg:opacity-0 lg:group-hover/assistant:opacity-100 transition-opacity">
                                <CopyButton text={msg.content} />
                                {!isStreamingHere && !messages.slice(i + 1).some(m => m.role === 'user') && (
                                  <button onClick={handleRegenerate} className="p-1.5 rounded-lg transition-colors hover:bg-[var(--color-bg-secondary)] active:bg-[var(--color-bg-tertiary)]" title={t("ai.chat.regenerate")}>
                                    <RotateCcw size={14} style={{ color: "var(--color-text-quaternary)" }} />
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        ) : msg.streaming ? (
                          <Loader2 size={16} className="animate-spin" style={{ color: "var(--color-text-tertiary)" }} />
                        ) : null}
                      </div>
                    )}
                  </div>
                  );
                })}

                {/* Typing indicator — flows with messages at the bottom of the scroll area.
                    Only shown when a response is being generated and the last message is the
                    user (so we're waiting for the assistant's first token) OR the streaming
                    assistant message has no content yet. Prevents double-indicators when the
                    assistant has already started producing markdown. */}
                {(() => {
                  const streamingMsg = [...messages].reverse().find(m => m.role === 'assistant' && m.streaming);
                  // If assistant already has content, the Loader2 in the bubble handles the indicator.
                  const showTyping = isStreamingHere && !(streamingMsg && streamingMsg.content);
                  const typingAgent = streamingMsg?.agentId ? agentMap.get(streamingMsg.agentId) : null;
                  const typingName = typingAgent?.name || t("ai.chat.defaultAssistant");
                  const typingAvatar = typingAgent?.avatar || '🤖';
                  return (
                    <AnimatePresence>
                      {showTyping && (
                        <motion.div
                          key="ai-typing-indicator"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 0 }}
                          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                          className="flex items-center gap-2 py-1"
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
                        </motion.div>
                      )}
                    </AnimatePresence>
                  );
                })()}
              </div>

              {/* Scroll-to-bottom floating button — sits between scroll area and composer */}
              <AnimatePresence>
                {showScrollBottom && (
                  <motion.button
                    key="scroll-to-bottom-btn"
                    initial={{ opacity: 0, y: 8, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.9 }}
                    transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={scrollToBottom}
                    className="absolute z-10 flex items-center justify-center rounded-full"
                    style={{
                      right: 16,
                      bottom: 'calc(var(--ai-composer-h, 96px) + 12px)',
                      width: 32,
                      height: 32,
                      background: 'var(--color-bg-primary)',
                      border: '1px solid var(--color-line-secondary)',
                      boxShadow: 'var(--shadow-low)',
                      color: 'var(--color-text-secondary)',
                    }}
                    aria-label={t("ai.chat.scrollToBottom")}
                    title={t("ai.chat.scrollToBottom")}
                  >
                    <ArrowDown size={16} />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Input */}
              <div className="shrink-0 px-3 sm:px-5 lg:px-5 pb-4 pt-2" style={{ paddingBottom: "max(16px, var(--safe-bottom-capped, 0px))" }}>
                <div className="w-full">
                {/* @mention dropdown */}
                <AnimatePresence>
                {mentionQuery !== null && mentionAgents.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.98 }}
                    transition={{ duration: 0.12, ease: [0.4, 0, 0.2, 1] }}
                    className="rounded-xl py-1 mb-1.5"
                    style={{ background: "var(--color-bg-secondary)", border: "1px solid var(--color-border-translucent)", boxShadow: "var(--shadow-high)", transformOrigin: 'bottom left' }}
                  >
                    {mentionAgents.map((a, idx) => (
                      <button key={a.id} onClick={() => insertMention(a)} className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-left transition-colors" style={{ color: "var(--color-text-primary)", background: idx === mentionIndex ? 'var(--color-accent-tint)' : 'transparent' }} onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setMentionIndex(idx)}>
                        <span>{a.avatar}</span><span className="flex-1">{a.name}</span>
                        {idx === mentionIndex && <span className="text-[10px]" style={{ color: 'var(--color-text-quaternary)' }}>↵</span>}
                      </button>
                    ))}
                  </motion.div>
                )}
                </AnimatePresence>
                {/* Unified input container */}
                <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--color-line-secondary)", background: "var(--color-bg-secondary)" }}>
                  {/* Attachment preview inside container */}
                  {pendingAttachments.length > 0 && (
                    <div className="flex gap-2 px-3 pt-3 flex-wrap">
                      {pendingAttachments.map((att, ai) => (
                        <div key={ai} className="relative group/att">
                          <img src={att.dataUrl} alt={att.fileName} className="rounded-lg object-cover" style={{ width: 56, height: 56 }} />
                          <button onClick={() => removeAttachment(ai)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover/att:opacity-100 transition-opacity" style={{ background: 'var(--color-danger, #eb5757)', color: 'var(--color-text-on-color)' }}><X size={12} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} multiple className="hidden" onChange={handleFileChange} />
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder={pendingAttachments.length ? (lang === "zh" ? "描述图片或提问..." : "Describe the image or ask...") : isGroupConv ? (lang === "zh" ? "输入消息... (@ 可指定 Agent)" : "Type a message... (@ to mention agent)") : t("ai.chat.placeholder")}
                    rows={1}
                    className="w-full px-4 pt-3 pb-1 text-[16px] lg:text-[14px] resize-none bg-transparent border-0 outline-none"
                    style={{ maxHeight: 120, minHeight: 24, color: "var(--color-text-primary)" }}
                    disabled={isStreamingHere}
                  />
                  {/* Bottom toolbar inside container */}
                  <div className="flex items-center justify-between px-2 pb-2 pt-1">
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={handleFileSelect}
                        disabled={isStreamingHere || pendingAttachments.length >= MAX_ATTACHMENTS}
                        className="p-1.5 rounded-lg transition-colors hover:bg-[var(--color-bg-tertiary)] disabled:opacity-30"
                        style={{ color: "var(--color-text-tertiary)" }}
                        aria-label={lang === "zh" ? "上传图片" : "Upload image"}
                        title={lang === "zh" ? "上传图片" : "Upload image"}
                      >
                        <Paperclip size={16} />
                      </button>
                    </div>
                    {isStreamingHere ? (
                      <button
                        onClick={() => { abortRef.current?.abort(); setStreamingConvId(null); }}
                        className="shrink-0 rounded-lg flex items-center justify-center transition-all p-1.5"
                        style={{ background: "var(--color-danger, #eb5757)", color: "var(--color-text-on-color)" }}
                        aria-label={t("ai.chat.stop")}
                      >
                        <Square size={14} fill="currentColor" />
                      </button>
                    ) : (
                      <button
                        onClick={handleSend}
                        disabled={!input.trim() && !pendingAttachments.length}
                        className="shrink-0 rounded-lg flex items-center justify-center transition-all disabled:opacity-20 p-1.5"
                        style={{ background: input.trim() || pendingAttachments.length ? "var(--color-text-primary)" : "var(--color-bg-tertiary)", color: input.trim() || pendingAttachments.length ? "var(--color-bg-primary)" : "var(--color-text-quaternary)" }}
                        aria-label={t("ai.chat.send")}
                      >
                        <Send size={16} />
                      </button>
                    )}
                  </div>
                </div>
                {/* Model indicator + send-key hint */}
                <div className="flex items-center justify-between gap-2 mt-1.5 px-0.5">
                  <AIConnectionStatus settings={settings} />
                  <span
                    className="text-[11px] tabular-nums hidden sm:inline"
                    style={{ color: 'var(--color-text-quaternary)' }}
                    aria-hidden="true"
                  >
                    {t("ai.chat.sendHint")}
                  </span>
                </div>
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
