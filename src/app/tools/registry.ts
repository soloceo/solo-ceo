/**
 * Central tool registry — single source of truth for every AI agent tool.
 *
 * Each tool declares its schema, labels, prompt hint, executor, and confirm
 * builder in one place. `ai-tools.ts` and `agent-types.ts` derive everything
 * else (AGENT_TOOLS, TOOL_SAFETY, TOOL_LABELS, ALL_TOOL_NAMES, AgentToolName)
 * from this registry.
 *
 * Adding a tool = adding one entry here.
 */

import { api } from "../../lib/api";
import { todayDateKey } from "../../lib/date-utils";
import { getAIConfig, generateOutreach } from "../../lib/ai-client";

/* ── Types ────────────────────────────────────────────────── */

export interface ToolParam {
  type: string;
  description: string;
  enum?: string[];
  default?: unknown;
}

export interface ToolSchema {
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolParam>;
    required: string[];
  };
}

export type ToolSafety = "read" | "write" | "destructive";

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  message: string;
  data?: unknown;
}

/** Request-scoped context passed to every executor.
 *  - cache: shared endpoint cache so multi-step turns don't re-fetch the same list.
 *    Mutations invalidate the relevant endpoint so subsequent reads see fresh data. */
export interface ToolContext {
  currencySymbol: string;
  cache: Map<string, unknown>;
}

export interface ConfirmDisplay {
  label: string;
  details: string[];
}

export interface ToolRegistration {
  schema: ToolSchema;
  safety: ToolSafety;
  labels: { zh: string; en: string };
  /** One-line prompt description (appears in the `可用工具:` list) */
  prompt: { zh: string; en: string };
  /** Optional worked example block (appears in `### 示例`) */
  example?: { zh: string; en: string };
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
  /** null = fall back to generic args dump in buildConfirmInfo */
  confirm?: (args: Record<string, unknown>, lang: string, sym: string) => ConfirmDisplay;
}

/* ── Cache helpers ────────────────────────────────────────── */

/** Fetch an endpoint, reusing the cached response if the same endpoint was already
 *  fetched in this request. Used by findByTitle + search_data to avoid redundant
 *  round-trips across multi-step agent turns. */
async function cachedGet<T>(endpoint: string, ctx: ToolContext): Promise<T> {
  if (ctx.cache.has(endpoint)) return ctx.cache.get(endpoint) as T;
  const data = await api.get(endpoint);
  ctx.cache.set(endpoint, data);
  return data as T;
}

/** Drop cache for an endpoint after a mutation, so the next read is fresh. */
function invalidate(ctx: ToolContext, ...endpoints: string[]) {
  for (const e of endpoints) ctx.cache.delete(e);
}

/** Finance transaction category enums — must match UI/DB options. */
const FINANCE_CATEGORIES: Record<"business" | "personal", readonly string[]> = {
  business: ["收入", "软件支出", "外包支出", "其他支出"],
  personal: ["餐饮", "交通", "房租", "娱乐", "个人其他"],
};

/** Find item by fuzzy title — returns null if not found. */
async function findByTitle(
  endpoint: string,
  titleField: string,
  query: string,
  ctx: ToolContext,
): Promise<Record<string, unknown> | null> {
  if (!query) return null;
  const items = await cachedGet<Record<string, unknown>[]>(endpoint, ctx);
  if (!Array.isArray(items) || items.length === 0) return null;
  const q = query.toLowerCase();
  const exact = items.find(i => String(i[titleField] || "").toLowerCase() === q);
  if (exact) return exact;
  const partial = items.find(i => String(i[titleField] || "").toLowerCase().includes(q));
  return partial || null;
}

/* ── Web search (private helper for web_search executor) ───── */

async function executeWebSearch(query: string, lang: string): Promise<ToolResult> {
  let geminiKey = "";
  try {
    const settings = await api.get("/api/settings") as Record<string, string>;
    geminiKey = settings?.gemini_api_key || "";
  } catch { /* ignore */ }

  if (!geminiKey) {
    try {
      const stored = localStorage.getItem("solo-ceo-settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        geminiKey = parsed?.state?.gemini_api_key || "";
      }
    } catch { /* ignore parse error */ }
  }

  if (!geminiKey) {
    return {
      success: false,
      message: lang === "zh"
        ? "网络搜索需要配置 Gemini API Key（设置 → AI 服务 → Gemini）"
        : "Web search requires a Gemini API Key (Settings → AI → Gemini)",
    };
  }

  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Search the web and return factual, up-to-date results for: ${query}\n\nReturn results as a structured list with: title, snippet, url (if available). Focus on the most relevant and recent results.` }] }],
          tools: [{ google_search: {} }],
          generationConfig: { maxOutputTokens: 2048 },
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Gemini search error: ${res.status} ${errText.slice(0, 100)}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const grounding = data.candidates?.[0]?.groundingMetadata;
    const chunks = grounding?.groundingChunks || [];
    const sources = chunks.map((c: { web?: { uri?: string; title?: string } }) => ({
      title: c.web?.title || "",
      url: c.web?.uri || "",
    })).filter((s: { title: string; url: string }) => s.url);

    return {
      success: true,
      message: `Found results for "${query}"`,
      data: { summary: text, sources: sources.slice(0, 8) },
    };
  } catch (err) {
    return { success: false, message: `Search failed: ${(err as Error).message}` };
  }
}

/* ── Registry ─────────────────────────────────────────────── */

export const TOOLS = {
  create_task: {
    schema: {
      description: "Create a new task in the task board",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title (concise, action-oriented)" },
          priority: { type: "string", description: "Priority level", enum: ["High", "Medium", "Low"], default: "Medium" },
          due: { type: "string", description: "Due date in YYYY-MM-DD format (optional)" },
          client: { type: "string", description: "Client name (optional)" },
          scope: { type: "string", description: "Task scope: work=task, personal=personal task, work-memo=memo/note", enum: ["work", "personal", "work-memo"], default: "work" },
        },
        required: ["title"],
      },
    },
    safety: "write",
    labels: { zh: "创建任务", en: "Create Task" },
    prompt: {
      zh: "**create_task**: 创建任务。参数：title(必填), priority(High/Medium/Low), due(YYYY-MM-DD), client, scope(work/personal/work-memo)",
      en: "**create_task**: Create a task. Args: title(required), priority(High/Medium/Low), due(YYYY-MM-DD), client, scope(work/personal/work-memo)",
    },
    example: {
      zh: '用户说"创建任务：写周报" → 你返回：\n```json\n{"tool_call": {"name": "create_task", "args": {"title": "写周报"}}}\n```',
      en: 'User: "Create task: write report" → return:\n```json\n{"tool_call": {"name": "create_task", "args": {"title": "Write report"}}}\n```',
    },
    async execute(a, ctx) {
      if (!a.title) return { success: false, message: "Missing required field: title" };
      const body: Record<string, unknown> = {
        title: a.title,
        priority: a.priority || "Medium",
        column: "todo",
        scope: a.scope || "work",
      };
      if (a.due) body.due = a.due;
      if (a.client) body.client = a.client;
      await api.post("/api/tasks", body);
      invalidate(ctx, "/api/tasks");
      return { success: true, message: `Task "${a.title}" created` };
    },
    confirm(a, lang) {
      const isZh = lang === "zh";
      const scopeLabel = a.scope === "work-memo" ? (isZh ? "备忘" : "Memo")
        : a.scope === "personal" ? (isZh ? "个人任务" : "Personal Task")
        : (isZh ? "任务" : "Task");
      return {
        label: isZh ? `创建${scopeLabel}` : `Create ${scopeLabel}`,
        details: [
          `${isZh ? "标题" : "Title"}: ${a.title}`,
          ...(a.scope && a.scope !== "work" ? [`${isZh ? "类型" : "Type"}: ${scopeLabel}`] : []),
          ...(a.priority ? [`${isZh ? "优先级" : "Priority"}: ${a.priority}`] : []),
          ...(a.due ? [`${isZh ? "截止" : "Due"}: ${a.due}`] : []),
          ...(a.client ? [`${isZh ? "客户" : "Client"}: ${a.client}`] : []),
        ],
      };
    },
  },

  update_task: {
    schema: {
      description: "Update an existing task (move to different column, change priority, or change due date)",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title to find (fuzzy match)" },
          column: { type: "string", description: "Move to column", enum: ["todo", "inProgress", "review", "done"] },
          priority: { type: "string", description: "New priority", enum: ["High", "Medium", "Low"] },
          due: { type: "string", description: "New due date in YYYY-MM-DD format" },
        },
        required: ["title"],
      },
    },
    safety: "write",
    labels: { zh: "更新任务", en: "Update Task" },
    prompt: {
      zh: "**update_task**: 更新任务。参数：title(必填,用于匹配), column(todo/inProgress/review/done), priority, due",
      en: "**update_task**: Update a task. Args: title(required, for matching), column(todo/inProgress/review/done), priority, due",
    },
    async execute(a, ctx) {
      if (!a.title) return { success: false, message: "Missing required field: title" };
      const task = await findByTitle("/api/tasks", "title", a.title as string, ctx);
      if (!task) return { success: false, message: `Task "${a.title}" not found` };
      const updates: Record<string, unknown> = {};
      if (a.column) updates.column = a.column;
      if (a.priority) updates.priority = a.priority;
      if (a.due) updates.due = a.due;
      await api.put(`/api/tasks/${task.id}`, updates);
      invalidate(ctx, "/api/tasks");
      return { success: true, message: `Task "${task.title}" updated` };
    },
    confirm(a, lang) {
      const isZh = lang === "zh";
      return {
        label: isZh ? "更新任务" : "Update Task",
        details: [
          `${isZh ? "任务" : "Task"}: ${a.title}`,
          ...(a.column ? [`→ ${a.column}`] : []),
          ...(a.priority ? [`${isZh ? "优先级" : "Priority"}: ${a.priority}`] : []),
          ...(a.due ? [`${isZh ? "截止" : "Due"}: ${a.due}`] : []),
        ],
      };
    },
  },

  delete_task: {
    schema: {
      description: "Delete (complete and remove) a task from the board",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title to find (fuzzy match)" },
        },
        required: ["title"],
      },
    },
    safety: "destructive",
    labels: { zh: "删除任务", en: "Delete Task" },
    prompt: {
      zh: "**delete_task**: 删除任务。参数：title(必填,用于匹配)",
      en: "**delete_task**: Delete a task. Args: title(required, for matching)",
    },
    async execute(a, ctx) {
      if (!a.title) return { success: false, message: "Missing required field: title" };
      const task = await findByTitle("/api/tasks", "title", a.title as string, ctx);
      if (!task) return { success: false, message: `Task "${a.title}" not found` };
      await api.del(`/api/tasks/${task.id}`);
      invalidate(ctx, "/api/tasks");
      return { success: true, message: `Task "${task.title}" deleted` };
    },
    confirm(a, lang) {
      const isZh = lang === "zh";
      return {
        label: isZh ? "删除任务" : "Delete Task",
        details: [`${isZh ? "任务" : "Task"}: ${a.title}`],
      };
    },
  },

  create_lead: {
    schema: {
      description: "Create a new lead/prospect in the pipeline",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Lead name or company name" },
          industry: { type: "string", description: "Industry or sector (optional)" },
          needs: { type: "string", description: "Potential needs or requirements (optional)" },
          source: { type: "string", description: "How this lead was found (optional)" },
        },
        required: ["name"],
      },
    },
    safety: "write",
    labels: { zh: "创建线索", en: "Create Lead" },
    prompt: {
      zh: "**create_lead**: 创建线索。参数：name(必填), industry, needs, source",
      en: "**create_lead**: Create a lead. Args: name(required), industry, needs, source",
    },
    example: {
      zh: '用户说"添加线索：张三公司" → 你返回：\n```json\n{"tool_call": {"name": "create_lead", "args": {"name": "张三公司"}}}\n```',
      en: 'User: "Add lead: Acme Corp" → return:\n```json\n{"tool_call": {"name": "create_lead", "args": {"name": "Acme Corp"}}}\n```',
    },
    async execute(a, ctx) {
      if (!a.name) return { success: false, message: "Missing required field: name" };
      const body: Record<string, unknown> = { name: a.name, column: "new" };
      if (a.industry) body.industry = a.industry;
      if (a.needs) body.needs = a.needs;
      if (a.source) body.source = a.source;
      await api.post("/api/leads", body);
      invalidate(ctx, "/api/leads");
      return { success: true, message: `Lead "${a.name}" created` };
    },
    confirm(a, lang) {
      const isZh = lang === "zh";
      return {
        label: isZh ? "创建线索" : "Create Lead",
        details: [
          `${isZh ? "名称" : "Name"}: ${a.name}`,
          ...(a.industry ? [`${isZh ? "行业" : "Industry"}: ${a.industry}`] : []),
          ...(a.needs ? [`${isZh ? "需求" : "Needs"}: ${a.needs}`] : []),
        ],
      };
    },
  },

  move_lead: {
    schema: {
      description: "Move a lead to a different pipeline stage",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Lead name to find (fuzzy match)" },
          column: { type: "string", description: "Target pipeline stage", enum: ["new", "contacted", "proposal", "won", "lost"] },
        },
        required: ["name", "column"],
      },
    },
    safety: "write",
    labels: { zh: "移动线索", en: "Move Lead" },
    prompt: {
      zh: "**move_lead**: 移动线索。参数：name(必填), column(new/contacted/proposal/won/lost)(必填)",
      en: "**move_lead**: Move a lead. Args: name(required), column(new/contacted/proposal/won/lost)(required)",
    },
    async execute(a, ctx) {
      if (!a.name) return { success: false, message: "Missing required field: name" };
      if (!a.column) return { success: false, message: "Missing required field: column" };
      const lead = await findByTitle("/api/leads", "name", a.name as string, ctx);
      if (!lead) return { success: false, message: `Lead "${a.name}" not found` };
      await api.put(`/api/leads/${lead.id}`, { column: a.column });
      invalidate(ctx, "/api/leads");
      return { success: true, message: `Lead "${lead.name}" moved to ${a.column}` };
    },
    confirm(a, lang) {
      return {
        label: lang === "zh" ? "移动线索" : "Move Lead",
        details: [`${a.name} → ${a.column}`],
      };
    },
  },

  update_lead: {
    schema: {
      description: "Update fields on an existing lead (industry, needs, source, etc.)",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Lead name to find (fuzzy match)" },
          industry: { type: "string", description: "Industry or sector" },
          needs: { type: "string", description: "Potential needs or requirements" },
          source: { type: "string", description: "How this lead was found" },
          website: { type: "string", description: "Lead website URL" },
        },
        required: ["name"],
      },
    },
    safety: "write",
    labels: { zh: "更新线索", en: "Update Lead" },
    prompt: {
      zh: "**update_lead**: 更新线索信息。参数：name(必填,用于匹配), industry, needs, source, website",
      en: "**update_lead**: Update a lead. Args: name(required, for matching), industry, needs, source, website",
    },
    async execute(a, ctx) {
      if (!a.name) return { success: false, message: "Missing required field: name" };
      const lead = await findByTitle("/api/leads", "name", a.name as string, ctx);
      if (!lead) return { success: false, message: `Lead "${a.name}" not found` };
      const updates: Record<string, unknown> = {};
      if (a.industry) updates.industry = a.industry;
      if (a.needs) updates.needs = a.needs;
      if (a.source) updates.source = a.source;
      if (a.website) updates.website = a.website;
      await api.put(`/api/leads/${lead.id}`, updates);
      invalidate(ctx, "/api/leads");
      return { success: true, message: `Lead "${lead.name}" updated` };
    },
    confirm(a, lang) {
      const isZh = lang === "zh";
      return {
        label: isZh ? "更新线索" : "Update Lead",
        details: [
          `${isZh ? "名称" : "Name"}: ${a.name}`,
          ...(a.industry ? [`${isZh ? "行业" : "Industry"}: ${a.industry}`] : []),
          ...(a.needs ? [`${isZh ? "需求" : "Needs"}: ${a.needs}`] : []),
          ...(a.source ? [`${isZh ? "来源" : "Source"}: ${a.source}`] : []),
          ...(a.website ? [`${isZh ? "网站" : "Website"}: ${a.website}`] : []),
        ],
      };
    },
  },

  delete_lead: {
    schema: {
      description: "Delete (remove) a lead from the pipeline. Soft-delete — can be restored from the backend.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Lead name to find (fuzzy match)" },
        },
        required: ["name"],
      },
    },
    safety: "destructive",
    labels: { zh: "删除线索", en: "Delete Lead" },
    prompt: {
      zh: "**delete_lead**: 删除线索。参数：name(必填,用于匹配)",
      en: "**delete_lead**: Delete a lead. Args: name(required, for matching)",
    },
    async execute(a, ctx) {
      if (!a.name) return { success: false, message: "Missing required field: name" };
      const lead = await findByTitle("/api/leads", "name", a.name as string, ctx);
      if (!lead) return { success: false, message: `Lead "${a.name}" not found` };
      await api.del(`/api/leads/${lead.id}`);
      invalidate(ctx, "/api/leads");
      return { success: true, message: `Lead "${lead.name}" deleted` };
    },
    confirm(a, lang) {
      const isZh = lang === "zh";
      return {
        label: isZh ? "删除线索" : "Delete Lead",
        details: [`${isZh ? "名称" : "Name"}: ${a.name}`],
      };
    },
  },

  record_transaction: {
    schema: {
      description: "Record an income or expense transaction. Use scope=personal for personal expenses (food, transport, rent, etc.) and scope=business for business transactions.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", description: "Transaction type", enum: ["income", "expense"] },
          amount: { type: "number", description: "Amount (positive number)" },
          scope: { type: "string", description: "Business or personal transaction", enum: ["business", "personal"], default: "business" },
          category: { type: "string", description: "Category. Business: 收入/软件支出/外包支出/其他支出. Personal: 餐饮/交通/房租/娱乐/个人其他" },
          description: { type: "string", description: "Short description" },
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
          status: { type: "string", description: "Transaction status (default: 已完成)", enum: ["已完成", "待收款 (应收)", "待支付 (应付)"] },
        },
        required: ["type", "amount", "description"],
      },
    },
    safety: "write",
    labels: { zh: "记录收支", en: "Record Transaction" },
    prompt: {
      zh: "**record_transaction**: 记账。参数：type(income/expense)(必填), amount(必填), description(必填), scope(business/personal，默认business，用户说个人/生活就用personal), category(公司:收入/软件支出/外包支出/其他支出，个人:餐饮/交通/房租/娱乐/个人其他), date(YYYY-MM-DD), status(已完成/待收款 (应收)/待支付 (应付)，默认已完成)",
      en: "**record_transaction**: Record transaction. Args: type(income/expense)(required), amount(required), description(required), scope(business/personal, default business — use personal for personal/life expenses), category(biz:收入/软件支出/外包支出/其他支出, personal:餐饮/交通/房租/娱乐/个人其他), date(YYYY-MM-DD), status(已完成/待收款 (应收)/待支付 (应付), default: 已完成)",
    },
    example: {
      zh: '用户说"记一笔支出 50 买域名" → 你返回：\n```json\n{"tool_call": {"name": "record_transaction", "args": {"type": "expense", "amount": 50, "description": "买域名", "scope": "business", "category": "软件支出", "date": "__TODAY__"}}}\n```\n用户说"个人支出，吃饭花了80" → 你返回：\n```json\n{"tool_call": {"name": "record_transaction", "args": {"type": "expense", "amount": 80, "description": "吃饭", "scope": "personal", "category": "餐饮", "date": "__TODAY__"}}}\n```',
      en: 'User: "Record expense $50 for domain" → return:\n```json\n{"tool_call": {"name": "record_transaction", "args": {"type": "expense", "amount": 50, "description": "Domain purchase", "scope": "business", "date": "__TODAY__"}}}\n```\nUser: "Personal expense, lunch $15" → return:\n```json\n{"tool_call": {"name": "record_transaction", "args": {"type": "expense", "amount": 15, "description": "Lunch", "scope": "personal", "category": "餐饮", "date": "__TODAY__"}}}\n```',
    },
    async execute(a, ctx) {
      const amt = Number(a.amount);
      if (!a.amount || !isFinite(amt) || amt <= 0) return { success: false, message: "Missing or invalid amount" };
      if (!a.description) return { success: false, message: "Missing required field: description" };
      const isPersonal = a.scope === "personal";
      const scopeKey = isPersonal ? "personal" : "business";
      const allowedCats = FINANCE_CATEGORIES[scopeKey];
      const defaultCat = isPersonal
        ? (a.type === "income" ? "个人其他" : "餐饮")
        : (a.type === "income" ? "收入" : "其他支出");
      let category = typeof a.category === "string" && a.category.trim() ? a.category.trim() : defaultCat;
      if (!allowedCats.includes(category)) {
        return {
          success: false,
          message: `Invalid category "${category}" for scope=${scopeKey}. Allowed: ${allowedCats.join(", ")}`,
        };
      }
      const body: Record<string, unknown> = {
        type: a.type || "expense",
        amount: amt,
        description: a.description,
        date: a.date || todayDateKey(),
        category,
        status: (a.status as string) || "已完成",
        source: "manual",
        scope: scopeKey,
      };
      await api.post("/api/finance", body);
      invalidate(ctx, "/api/finance", "/api/dashboard");
      return { success: true, message: `${a.type === "income" ? "Income" : "Expense"} of ${ctx.currencySymbol}${amt} recorded` };
    },
    confirm(a, lang, sym) {
      const isZh = lang === "zh";
      return {
        label: isZh
          ? (a.type === "income" ? "记录收入" : "记录支出")
          : (a.type === "income" ? "Record Income" : "Record Expense"),
        details: [
          `${a.description}`,
          `${isZh ? "金额" : "Amount"}: ${sym}${Number(a.amount).toLocaleString()}`,
          ...(a.category ? [`${isZh ? "分类" : "Category"}: ${a.category}`] : []),
          ...(a.date ? [`${isZh ? "日期" : "Date"}: ${a.date}`] : []),
        ],
      };
    },
  },

  create_client: {
    schema: {
      description: "Create a new client",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Client name" },
          billing_type: { type: "string", description: "Billing model", enum: ["subscription", "project"], default: "project" },
          plan_tier: { type: "string", description: "Plan name (for subscription clients)" },
          mrr: { type: "number", description: "Monthly recurring revenue (for subscription)" },
          project_fee: { type: "number", description: "Project fee (for project billing)" },
        },
        required: ["name"],
      },
    },
    safety: "write",
    labels: { zh: "创建客户", en: "Create Client" },
    prompt: {
      zh: "**create_client**: 创建客户。参数：name(必填), billing_type(subscription/project), plan_tier, mrr, project_fee",
      en: "**create_client**: Create client. Args: name(required), billing_type(subscription/project), plan_tier, mrr, project_fee",
    },
    async execute(a, ctx) {
      if (!a.name) return { success: false, message: "Missing required field: name" };
      const body: Record<string, unknown> = {
        name: a.name,
        billing_type: a.billing_type || "project",
        status: "Active",
      };
      if (a.plan_tier) body.plan_tier = a.plan_tier;
      if (a.mrr != null) body.mrr = Number(a.mrr);
      if (a.project_fee != null) body.project_fee = Number(a.project_fee);
      await api.post("/api/clients", body);
      invalidate(ctx, "/api/clients", "/api/dashboard");
      return { success: true, message: `Client "${a.name}" created` };
    },
    confirm(a, lang, sym) {
      const isZh = lang === "zh";
      return {
        label: isZh ? "创建客户" : "Create Client",
        details: [
          `${isZh ? "名称" : "Name"}: ${a.name}`,
          ...(a.billing_type ? [`${isZh ? "计费" : "Billing"}: ${a.billing_type}`] : []),
          ...(a.mrr ? [`MRR: ${sym}${Number(a.mrr).toLocaleString()}`] : []),
          ...(a.project_fee ? [`${isZh ? "项目费" : "Fee"}: ${sym}${Number(a.project_fee).toLocaleString()}`] : []),
        ],
      };
    },
  },

  update_client: {
    schema: {
      description: "Update an existing client's details",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Client name to find (fuzzy match)" },
          status: { type: "string", description: "Client status", enum: ["Active", "Paused", "Cancelled", "Completed"] },
          billing_type: { type: "string", description: "Billing model", enum: ["subscription", "project"] },
          plan_tier: { type: "string", description: "Plan name (for subscription clients)" },
          mrr: { type: "number", description: "Monthly recurring revenue (for subscription)" },
          project_fee: { type: "number", description: "Project fee (for project billing)" },
        },
        required: ["name"],
      },
    },
    safety: "write",
    labels: { zh: "更新客户", en: "Update Client" },
    prompt: {
      zh: "**update_client**: 更新客户信息。参数：name(必填,用于匹配), status(Active/Paused/Cancelled/Completed), billing_type(subscription/project), plan_tier, mrr, project_fee",
      en: "**update_client**: Update a client. Args: name(required, for matching), status(Active/Paused/Cancelled/Completed), billing_type(subscription/project), plan_tier, mrr, project_fee",
    },
    async execute(a, ctx) {
      if (!a.name) return { success: false, message: "Missing required field: name" };
      const client = await findByTitle("/api/clients", "name", a.name as string, ctx);
      if (!client) return { success: false, message: `Client "${a.name}" not found` };
      const updates: Record<string, unknown> = {};
      if (a.status) updates.status = a.status;
      if (a.billing_type) updates.billing_type = a.billing_type;
      if (a.plan_tier) updates.plan_tier = a.plan_tier;
      if (a.mrr != null) updates.mrr = Number(a.mrr);
      if (a.project_fee != null) updates.project_fee = Number(a.project_fee);
      await api.put(`/api/clients/${client.id}`, updates);
      invalidate(ctx, "/api/clients", "/api/dashboard");
      return { success: true, message: `Client "${client.name}" updated` };
    },
    confirm(a, lang, sym) {
      const isZh = lang === "zh";
      return {
        label: isZh ? "更新客户" : "Update Client",
        details: [
          `${isZh ? "名称" : "Name"}: ${a.name}`,
          ...(a.status ? [`${isZh ? "状态" : "Status"}: ${a.status}`] : []),
          ...(a.billing_type ? [`${isZh ? "计费" : "Billing"}: ${a.billing_type}`] : []),
          ...(a.plan_tier ? [`${isZh ? "套餐" : "Plan"}: ${a.plan_tier}`] : []),
          ...(a.mrr ? [`MRR: ${sym}${Number(a.mrr).toLocaleString()}`] : []),
          ...(a.project_fee ? [`${isZh ? "项目费" : "Fee"}: ${sym}${Number(a.project_fee).toLocaleString()}`] : []),
        ],
      };
    },
  },

  delete_client: {
    schema: {
      description: "Delete (remove) a client. Soft-delete — also unlinks related tasks and soft-deletes milestone-linked finance transactions. Prefer update_client with status=Cancelled for churn; use delete_client only to remove mistaken/test entries.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Client name to find (fuzzy match)" },
        },
        required: ["name"],
      },
    },
    safety: "destructive",
    labels: { zh: "删除客户", en: "Delete Client" },
    prompt: {
      zh: "**delete_client**: 删除客户（软删除，会解绑任务和软删除相关财务）。流失客户请用 update_client 改 status=Cancelled；delete_client 仅用于删除误建/测试记录。参数：name(必填,用于匹配)",
      en: "**delete_client**: Delete a client (soft-delete, unlinks tasks + soft-deletes linked finance). For churn, prefer update_client with status=Cancelled; use delete_client only for mistaken/test entries. Args: name(required, for matching)",
    },
    async execute(a, ctx) {
      if (!a.name) return { success: false, message: "Missing required field: name" };
      const client = await findByTitle("/api/clients", "name", a.name as string, ctx);
      if (!client) return { success: false, message: `Client "${a.name}" not found` };
      await api.del(`/api/clients/${client.id}`);
      invalidate(ctx, "/api/clients", "/api/tasks", "/api/finance", "/api/dashboard");
      return { success: true, message: `Client "${client.name}" deleted` };
    },
    confirm(a, lang) {
      const isZh = lang === "zh";
      return {
        label: isZh ? "删除客户" : "Delete Client",
        details: [
          `${isZh ? "名称" : "Name"}: ${a.name}`,
          isZh ? "⚠️ 会解绑相关任务和软删除里程碑财务记录" : "⚠️ Will unlink related tasks and soft-delete milestone finance records",
        ],
      };
    },
  },

  search_data: {
    schema: {
      description: "Search across tasks, leads, clients, or finance transactions. Use this to look up specific data before answering questions.",
      parameters: {
        type: "object",
        properties: {
          scope: { type: "string", description: "Where to search", enum: ["tasks", "leads", "clients", "finance"] },
          query: { type: "string", description: "Search keyword or filter" },
          limit: { type: "number", description: "Max items to return (1-50, default 10). Raise if you need to see more matches.", default: 10 },
        },
        required: ["scope"],
      },
    },
    safety: "read",
    labels: { zh: "搜索数据", en: "Search Data" },
    prompt: {
      zh: "**search_data**: 搜索数据。参数：scope(tasks/leads/clients/finance)(必填), query, limit(1-50，默认10)。返回包含 total 和 items，total 是匹配总数，items 是截断后的结果。",
      en: "**search_data**: Search data. Args: scope(tasks/leads/clients/finance)(required), query, limit(1-50, default 10). Returns {total, items} — total is full match count, items is truncated.",
    },
    async execute(a, ctx) {
      const endpoints: Record<string, string> = {
        tasks: "/api/tasks",
        leads: "/api/leads",
        clients: "/api/clients",
        finance: "/api/finance",
      };
      const endpoint = endpoints[a.scope as string];
      if (!endpoint) return { success: false, message: `Unknown scope: ${a.scope}` };
      const items = await cachedGet<Record<string, unknown>[]>(endpoint, ctx);
      if (!Array.isArray(items)) return { success: true, message: "No data found", data: { total: 0, items: [] } };

      let results = items;
      if (a.query) {
        const q = (a.query as string).toLowerCase();
        results = items.filter(item => {
          const searchable = [item.title, item.name, item.description, item.category, item.client, item.industry, item.needs]
            .filter(Boolean).join(" ").toLowerCase();
          return searchable.includes(q);
        });
      }

      // Clamp limit to [1, 50] — protect against the model asking for the whole table
      const rawLimit = Number(a.limit);
      const limit = isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 50) : 10;
      const truncated = results.length > limit;
      const items_out = results.slice(0, limit);

      const message = truncated
        ? `Found ${results.length} items (showing first ${limit})`
        : `Found ${results.length} items`;

      return { success: true, message, data: { total: results.length, items: items_out } };
    },
  },

  web_search: {
    schema: {
      description: "Search the internet for real-time information. Use this to find businesses, news, trends, job posts, or any public information online.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query (be specific, include location/industry if relevant)" },
          lang: { type: "string", description: "Result language preference", enum: ["zh", "en"], default: "en" },
        },
        required: ["query"],
      },
    },
    safety: "read",
    labels: { zh: "网络搜索", en: "Web Search" },
    prompt: {
      zh: "**web_search**: 搜索互联网。参数：query(必填，尽量具体，包含地点/行业等), lang(zh/en)",
      en: "**web_search**: Search the internet. Args: query(required, be specific with location/industry), lang(zh/en)",
    },
    async execute(a) {
      const query = a.query as string;
      if (!query) return { success: false, message: "No search query provided" };
      return await executeWebSearch(query, (a.lang as string) || "en");
    },
  },

  create_memo: {
    schema: {
      description: "Create a quick memo/note. Use when the user says 'remind me', 'note down', 'remember', '记一下', '备忘' etc.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Memo content (concise)" },
          due: { type: "string", description: "Due/reminder date in YYYY-MM-DD format (optional)" },
        },
        required: ["title"],
      },
    },
    safety: "write",
    labels: { zh: "创建备忘", en: "Create Memo" },
    prompt: {
      zh: "**create_memo**: 创建备忘/笔记。用户说「记一下」「备忘」「提醒我」时使用。参数：title(必填), due(YYYY-MM-DD)",
      en: "**create_memo**: Create a quick memo/note. Use when user says 'remind me', 'note down'. Args: title(required), due(YYYY-MM-DD)",
    },
    example: {
      zh: '用户说"记一下：下周二前要给客户发报价单" → 你返回：\n```json\n{"tool_call": {"name": "create_memo", "args": {"title": "给客户发报价单", "due": "YYYY-MM-DD"}}}\n```',
      en: 'User: "Remind me: send quote to client by Tuesday" → return:\n```json\n{"tool_call": {"name": "create_memo", "args": {"title": "Send quote to client", "due": "YYYY-MM-DD"}}}\n```',
    },
    async execute(a, ctx) {
      if (!a.title) return { success: false, message: "Missing required field: title" };
      const body: Record<string, unknown> = {
        title: a.title,
        priority: "Medium",
        column: "todo",
        scope: "work-memo",
      };
      if (a.due) body.due = a.due;
      await api.post("/api/tasks", body);
      invalidate(ctx, "/api/tasks");
      return { success: true, message: `Memo created: "${a.title}"` };
    },
    confirm(a, lang) {
      const isZh = lang === "zh";
      return {
        label: isZh ? "创建备忘" : "Create Memo",
        details: [
          `${isZh ? "内容" : "Content"}: ${a.title}`,
          ...(a.due ? [`${isZh ? "截止" : "Due"}: ${a.due}`] : []),
        ],
      };
    },
  },

  get_dashboard: {
    schema: {
      description: "Get real-time business dashboard stats: MRR, revenue, active tasks, leads pipeline, urgent items. Use this to answer business performance questions accurately.",
      parameters: { type: "object", properties: {}, required: [] },
    },
    safety: "read",
    labels: { zh: "经营仪表盘", en: "Dashboard" },
    prompt: {
      zh: "**get_dashboard**: 获取实时经营仪表盘：MRR、收入、支出、任务、线索、客户等关键指标。无参数",
      en: "**get_dashboard**: Get real-time business dashboard: MRR, revenue, expenses, tasks, leads, clients. No args",
    },
    example: {
      zh: '用户说"看看这个月经营情况" → 你返回：\n```json\n{"tool_call": {"name": "get_dashboard", "args": {}}}\n```',
      en: 'User: "How\'s the business doing?" → return:\n```json\n{"tool_call": {"name": "get_dashboard", "args": {}}}\n```',
    },
    async execute(_a, ctx) {
      const dash = await cachedGet<Record<string, unknown>>("/api/dashboard", ctx);
      if (!dash) return { success: false, message: "Failed to load dashboard" };
      const sym = ctx.currencySymbol;
      const order: { key: string; label: string; money: boolean }[] = [
        { key: "mrr", label: "MRR", money: true },
        { key: "revenue", label: "Revenue (month)", money: true },
        { key: "expenses", label: "Expenses (month)", money: true },
        { key: "net_income", label: "Net income", money: true },
        { key: "active_tasks", label: "Active tasks", money: false },
        { key: "overdue_tasks", label: "Overdue tasks", money: false },
        { key: "total_leads", label: "Total leads", money: false },
        { key: "active_clients", label: "Active clients", money: false },
      ];
      const known = new Set(order.map(o => o.key));
      const lines: string[] = [];
      for (const { key, label, money } of order) {
        const v = dash[key];
        if (v == null) continue;
        lines.push(money ? `${label}: ${sym}${Number(v).toLocaleString()}` : `${label}: ${v}`);
      }
      for (const [k, v] of Object.entries(dash)) {
        if (known.has(k) || v == null) continue;
        lines.push(`${k}: ${typeof v === "number" ? v.toLocaleString() : v}`);
      }
      return { success: true, message: `Dashboard stats:\n${lines.join("\n")}`, data: dash };
    },
  },

  analyze_finance: {
    schema: {
      description: "Analyze financial data with aggregation: totals by category, monthly trends, income vs expense comparison. Much more accurate than searching raw transactions.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "Time period: 'this_month', 'last_month', 'this_year', or YYYY-MM", default: "this_month" },
          type: { type: "string", description: "Filter by type", enum: ["all", "income", "expense"], default: "all" },
        },
        required: [],
      },
    },
    safety: "read",
    labels: { zh: "财务分析", en: "Finance Analysis" },
    prompt: {
      zh: "**analyze_finance**: 财务分析：按月汇总收支、分类统计、趋势对比。参数：period(this_month/last_month/this_year/YYYY-MM), type(all/income/expense)",
      en: "**analyze_finance**: Finance analysis: monthly totals, category breakdown, trends. Args: period(this_month/last_month/this_year/YYYY-MM), type(all/income/expense)",
    },
    async execute(a, ctx) {
      const items = await cachedGet<Record<string, unknown>[]>("/api/finance", ctx);
      if (!Array.isArray(items)) return { success: true, message: "No financial data found", data: {} };

      const period = (a.period as string) || "this_month";
      const typeFilter = (a.type as string) || "all";
      const now = new Date();
      let year = now.getFullYear(), month = now.getMonth();

      if (period === "last_month") {
        month -= 1;
        if (month < 0) { month = 11; year -= 1; }
      } else if (period === "this_year") {
        // no month filter needed
      } else if (/^\d{4}-\d{2}$/.test(period)) {
        const [y, m] = period.split("-").map(Number);
        year = y; month = m - 1;
      }

      const filtered = items.filter((item) => {
        const d = String(item.date || "");
        if (period === "this_year") {
          if (!d.startsWith(String(year))) return false;
        } else {
          const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
          if (!d.startsWith(prefix)) return false;
        }
        if (typeFilter !== "all" && item.type !== typeFilter) return false;
        return true;
      });

      let totalIncome = 0, totalExpense = 0;
      const byCat: Record<string, number> = {};
      for (const item of filtered) {
        const amt = Number(item.amount) || 0;
        if (item.type === "income") totalIncome += amt;
        else totalExpense += amt;
        const cat = String(item.category || "其他");
        byCat[cat] = (byCat[cat] || 0) + amt;
      }

      const sym = ctx.currencySymbol;
      const catLines = Object.entries(byCat)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, amt]) => `  ${cat}: ${sym}${amt.toLocaleString()}`);

      const summary = [
        `Period: ${period}`,
        `Income: ${sym}${totalIncome.toLocaleString()}`,
        `Expenses: ${sym}${totalExpense.toLocaleString()}`,
        `Net: ${sym}${(totalIncome - totalExpense).toLocaleString()}`,
        `Transactions: ${filtered.length}`,
        ...(catLines.length > 0 ? [`By category:`, ...catLines] : []),
      ].join("\n");

      return {
        success: true,
        message: summary,
        data: { totalIncome, totalExpense, net: totalIncome - totalExpense, byCategory: byCat, count: filtered.length },
      };
    },
  },

  generate_outreach: {
    schema: {
      description: "Generate a personalized outreach/follow-up email for a lead. Searches the lead by name and writes a cold email based on their profile.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Lead name to find (fuzzy match)" },
          tone: { type: "string", description: "Email tone", enum: ["formal", "friendly", "direct"], default: "friendly" },
          lang: { type: "string", description: "Email language", enum: ["zh", "en"], default: "zh" },
        },
        required: ["name"],
      },
    },
    safety: "read",
    labels: { zh: "生成开发信", en: "Generate Outreach" },
    prompt: {
      zh: "**generate_outreach**: 为线索生成个性化开发邮件。参数：name(必填,线索名), tone(formal/friendly/direct), lang(zh/en)",
      en: "**generate_outreach**: Generate personalized outreach email for a lead. Args: name(required, lead name), tone(formal/friendly/direct), lang(zh/en)",
    },
    async execute(a, ctx) {
      if (!a.name) return { success: false, message: "Missing required field: name" };
      const lead = await findByTitle("/api/leads", "name", a.name as string, ctx);
      if (!lead) return { success: false, message: `Lead "${a.name}" not found` };

      let settings: Record<string, string> | null = null;
      try { settings = await cachedGet<Record<string, string>>("/api/settings", ctx); } catch { /* */ }
      const aiConfig = getAIConfig(settings);
      if (!aiConfig) return { success: false, message: "No AI provider configured. Set up an API key in Settings → AI." };

      const tone = (a.tone as "formal" | "friendly" | "direct") || "friendly";
      const lang = (a.lang as "zh" | "en") || "zh";
      const bizDesc = settings?.business_description || undefined;

      const email = await generateOutreach(
        { name: lead.name as string, industry: lead.industry as string | undefined, needs: lead.needs as string | undefined, website: lead.website as string | undefined },
        tone, lang, aiConfig.provider, aiConfig.apiKey, bizDesc,
      );
      return { success: true, message: email };
    },
  },
} satisfies Record<string, ToolRegistration>;

/** Derived: every tool name in the registry. */
export type AgentToolName = keyof typeof TOOLS;

/** Widened view of TOOLS as `Record<AgentToolName, ToolRegistration>` — useful
 *  for callers that just need `.confirm?.()` / `.example?.()` without tripping
 *  over `satisfies`-narrowed per-tool types. */
export const TOOLS_TYPED: Record<AgentToolName, ToolRegistration> = TOOLS;

/** Typed lookup that returns `ToolRegistration | undefined` for unknown names. */
export function getTool(name: string): ToolRegistration | undefined {
  return (TOOLS as Record<string, ToolRegistration>)[name];
}

/** Derived: a fresh empty ToolContext. Callers pass this through a multi-step
 *  agent turn to share endpoint cache across tool calls. */
export function createToolContext(currencySymbol = "$"): ToolContext {
  return { currencySymbol, cache: new Map() };
}
