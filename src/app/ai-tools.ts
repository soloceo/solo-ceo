/**
 * AI Agent tools — define actions the AI can execute.
 * Each tool has a schema (for the AI) and an executor (for the app).
 */

import { api } from "../lib/api";
import { todayDateKey } from "../lib/date-utils";
import { getAIConfig, AI_KEY_MAP } from "../lib/ai-client";

/* ── Tool schema for AI ──────────────────────────────────── */

export interface ToolParam {
  type: string;
  description: string;
  enum?: string[];
  default?: unknown;
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolParam>;
    required: string[];
  };
}

/** All available tools the AI can call */
export const AGENT_TOOLS: ToolDef[] = [
  {
    name: "create_task",
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
  {
    name: "update_task",
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
  {
    name: "delete_task",
    description: "Delete (complete and remove) a task from the board",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title to find (fuzzy match)" },
      },
      required: ["title"],
    },
  },
  {
    name: "create_lead",
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
  {
    name: "move_lead",
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
  {
    name: "record_transaction",
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
  {
    name: "create_client",
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
  {
    name: "update_lead",
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
  {
    name: "update_client",
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
  {
    name: "search_data",
    description: "Search across tasks, leads, clients, or finance transactions. Use this to look up specific data before answering questions.",
    parameters: {
      type: "object",
      properties: {
        scope: { type: "string", description: "Where to search", enum: ["tasks", "leads", "clients", "finance"] },
        query: { type: "string", description: "Search keyword or filter" },
      },
      required: ["scope"],
    },
  },
  {
    name: "web_search",
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
];

/* ── Tool safety classification ──────────────────────────── */

/** read = auto-execute always, write = agent auto-execute / default confirms, destructive = always confirm */
export const TOOL_SAFETY: Record<string, "read" | "write" | "destructive"> = {
  search_data: "read",
  web_search: "read",
  create_task: "write",
  update_task: "write",
  delete_task: "destructive",
  create_lead: "write",
  move_lead: "write",
  update_lead: "write",
  record_transaction: "write",
  create_client: "write",
  update_client: "write",
};

/* ── Tool execution result ────────────────────────────────── */

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  message: string;
  data?: unknown;
}

/* ── Confirmation display info ────────────────────────────── */

export interface ToolConfirmInfo {
  toolName: string;
  label: string;
  details: string[];
  args: Record<string, unknown>;
}

/** Build human-readable confirm info for a tool call */
export function buildConfirmInfo(call: ToolCall, lang: string, currencySymbol = "$"): ToolConfirmInfo {
  const isZh = lang === "zh";
  const a = call.args;
  const sym = currencySymbol;

  switch (call.name) {
    case "create_task": {
      const scopeLabel = a.scope === "work-memo" ? (isZh ? "备忘" : "Memo") : a.scope === "personal" ? (isZh ? "个人任务" : "Personal Task") : (isZh ? "任务" : "Task");
      return {
        toolName: call.name,
        label: isZh ? `创建${scopeLabel}` : `Create ${scopeLabel}`,
        details: [
          `${isZh ? "标题" : "Title"}: ${a.title}`,
          ...(a.scope && a.scope !== "work" ? [`${isZh ? "类型" : "Type"}: ${scopeLabel}`] : []),
          ...(a.priority ? [`${isZh ? "优先级" : "Priority"}: ${a.priority}`] : []),
          ...(a.due ? [`${isZh ? "截止" : "Due"}: ${a.due}`] : []),
          ...(a.client ? [`${isZh ? "客户" : "Client"}: ${a.client}`] : []),
        ],
        args: a,
      };
    }

    case "update_task":
      return {
        toolName: call.name,
        label: isZh ? "更新任务" : "Update Task",
        details: [
          `${isZh ? "任务" : "Task"}: ${a.title}`,
          ...(a.column ? [`→ ${a.column}`] : []),
          ...(a.priority ? [`${isZh ? "优先级" : "Priority"}: ${a.priority}`] : []),
          ...(a.due ? [`${isZh ? "截止" : "Due"}: ${a.due}`] : []),
        ],
        args: a,
      };

    case "delete_task":
      return { toolName: call.name, label: isZh ? "删除任务" : "Delete Task", details: [`${isZh ? "任务" : "Task"}: ${a.title}`], args: a };

    case "create_lead":
      return {
        toolName: call.name,
        label: isZh ? "创建线索" : "Create Lead",
        details: [
          `${isZh ? "名称" : "Name"}: ${a.name}`,
          ...(a.industry ? [`${isZh ? "行业" : "Industry"}: ${a.industry}`] : []),
          ...(a.needs ? [`${isZh ? "需求" : "Needs"}: ${a.needs}`] : []),
        ],
        args: a,
      };

    case "move_lead":
      return {
        toolName: call.name,
        label: isZh ? "移动线索" : "Move Lead",
        details: [
          `${a.name} → ${a.column}`,
        ],
        args: a,
      };

    case "record_transaction":
      return {
        toolName: call.name,
        label: isZh
          ? (a.type === "income" ? "记录收入" : "记录支出")
          : (a.type === "income" ? "Record Income" : "Record Expense"),
        details: [
          `${a.description}`,
          `${isZh ? "金额" : "Amount"}: ${sym}${Number(a.amount).toLocaleString()}`,
          ...(a.category ? [`${isZh ? "分类" : "Category"}: ${a.category}`] : []),
          ...(a.date ? [`${isZh ? "日期" : "Date"}: ${a.date}`] : []),
        ],
        args: { ...a, scope: a.scope || "business" },
      };

    case "create_client":
      return {
        toolName: call.name,
        label: isZh ? "创建客户" : "Create Client",
        details: [
          `${isZh ? "名称" : "Name"}: ${a.name}`,
          ...(a.billing_type ? [`${isZh ? "计费" : "Billing"}: ${a.billing_type}`] : []),
          ...(a.mrr ? [`MRR: ${sym}${Number(a.mrr).toLocaleString()}`] : []),
          ...(a.project_fee ? [`${isZh ? "项目费" : "Fee"}: ${sym}${Number(a.project_fee).toLocaleString()}`] : []),
        ],
        args: a,
      };

    case "update_lead":
      return {
        toolName: call.name,
        label: isZh ? "更新线索" : "Update Lead",
        details: [
          `${isZh ? "名称" : "Name"}: ${a.name}`,
          ...(a.industry ? [`${isZh ? "行业" : "Industry"}: ${a.industry}`] : []),
          ...(a.needs ? [`${isZh ? "需求" : "Needs"}: ${a.needs}`] : []),
          ...(a.source ? [`${isZh ? "来源" : "Source"}: ${a.source}`] : []),
          ...(a.website ? [`${isZh ? "网站" : "Website"}: ${a.website}`] : []),
        ],
        args: a,
      };

    case "update_client":
      return {
        toolName: call.name,
        label: isZh ? "更新客户" : "Update Client",
        details: [
          `${isZh ? "名称" : "Name"}: ${a.name}`,
          ...(a.status ? [`${isZh ? "状态" : "Status"}: ${a.status}`] : []),
          ...(a.billing_type ? [`${isZh ? "计费" : "Billing"}: ${a.billing_type}`] : []),
          ...(a.plan_tier ? [`${isZh ? "套餐" : "Plan"}: ${a.plan_tier}`] : []),
          ...(a.mrr ? [`MRR: ${sym}${Number(a.mrr).toLocaleString()}`] : []),
          ...(a.project_fee ? [`${isZh ? "项目费" : "Fee"}: ${sym}${Number(a.project_fee).toLocaleString()}`] : []),
        ],
        args: a,
      };

    default:
      return {
        toolName: call.name,
        label: call.name,
        details: Object.entries(a).map(([k, v]) => `${k}: ${v}`),
        args: a,
      };
  }
}

/* ── Tool executors ──────────────────────────────────────── */

/** Find item by fuzzy title match — returns null only for "not found", throws for real errors */
async function findByTitle(endpoint: string, titleField: string, query: string): Promise<Record<string, unknown> | null> {
  if (!query) return null;
  const items = await api.get(endpoint) as Record<string, unknown>[];
  if (!Array.isArray(items) || items.length === 0) return null;
  const q = query.toLowerCase();
  // Exact match first
  const exact = items.find(i => String(i[titleField] || "").toLowerCase() === q);
  if (exact) return exact;
  // Contains match
  const partial = items.find(i => String(i[titleField] || "").toLowerCase().includes(q));
  if (partial) return partial;
  return null;
}

/** Execute a tool call and return the result */
export async function executeTool(call: ToolCall, currencySymbol = "$"): Promise<ToolResult> {
  const a = call.args;

  try {
    switch (call.name) {
      case "create_task": {
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
        return { success: true, message: `Task "${a.title}" created` };
      }

      case "update_task": {
        if (!a.title) return { success: false, message: "Missing required field: title" };
        const task = await findByTitle("/api/tasks", "title", a.title as string);
        if (!task) return { success: false, message: `Task "${a.title}" not found` };
        const updates: Record<string, unknown> = {};
        if (a.column) updates.column = a.column;
        if (a.priority) updates.priority = a.priority;
        if (a.due) updates.due = a.due;
        await api.put(`/api/tasks/${task.id}`, updates);
        return { success: true, message: `Task "${task.title}" updated` };
      }

      case "delete_task": {
        if (!a.title) return { success: false, message: "Missing required field: title" };
        const task = await findByTitle("/api/tasks", "title", a.title as string);
        if (!task) return { success: false, message: `Task "${a.title}" not found` };
        await api.del(`/api/tasks/${task.id}`);
        return { success: true, message: `Task "${task.title}" deleted` };
      }

      case "create_lead": {
        if (!a.name) return { success: false, message: "Missing required field: name" };
        const body: Record<string, unknown> = {
          name: a.name,
          column: "new",
        };
        if (a.industry) body.industry = a.industry;
        if (a.needs) body.needs = a.needs;
        if (a.source) body.source = a.source;
        await api.post("/api/leads", body);
        return { success: true, message: `Lead "${a.name}" created` };
      }

      case "move_lead": {
        if (!a.name) return { success: false, message: "Missing required field: name" };
        if (!a.column) return { success: false, message: "Missing required field: column" };
        const lead = await findByTitle("/api/leads", "name", a.name as string);
        if (!lead) return { success: false, message: `Lead "${a.name}" not found` };
        await api.put(`/api/leads/${lead.id}`, { column: a.column });
        return { success: true, message: `Lead "${lead.name}" moved to ${a.column}` };
      }

      case "record_transaction": {
        const amt = Number(a.amount);
        if (!a.amount || !isFinite(amt) || amt <= 0) return { success: false, message: "Missing or invalid amount" };
        if (!a.description) return { success: false, message: "Missing required field: description" };
        const isPersonal = a.scope === "personal";
        // Default category based on scope: personal → 餐饮/个人其他, business → 收入/其他支出
        const defaultCat = isPersonal
          ? (a.type === "income" ? "个人其他" : "餐饮")
          : (a.type === "income" ? "收入" : "其他支出");
        const body: Record<string, unknown> = {
          type: a.type || "expense",
          amount: amt,
          description: a.description,
          date: a.date || todayDateKey(),
          category: a.category || defaultCat,
          status: (a.status as string) || "已完成",
          source: "manual",
        };
        await api.post("/api/finance", body);
        const scopeLabel = isPersonal ? "Personal" : "Business";
        return { success: true, message: `${scopeLabel} ${a.type === "income" ? "income" : "expense"} ${currencySymbol}${amt.toLocaleString()} recorded` };
      }

      case "create_client": {
        if (!a.name) return { success: false, message: "Missing required field: name" };
        const body: Record<string, unknown> = {
          name: a.name,
          status: "Active",
          billing_type: a.billing_type || "project",
        };
        if (a.plan_tier) body.plan_tier = a.plan_tier;
        if (a.mrr) { const n = Number(a.mrr); if (isFinite(n)) body.mrr = n; }
        if (a.project_fee) { const n = Number(a.project_fee); if (isFinite(n)) body.project_fee = n; }
        await api.post("/api/clients", body);
        return { success: true, message: `Client "${a.name}" created` };
      }

      case "update_lead": {
        if (!a.name) return { success: false, message: "Missing required field: name" };
        const lead = await findByTitle("/api/leads", "name", a.name as string);
        if (!lead) return { success: false, message: `Lead "${a.name}" not found` };
        const updates: Record<string, unknown> = {};
        if (a.industry) updates.industry = a.industry;
        if (a.needs) updates.needs = a.needs;
        if (a.source) updates.source = a.source;
        if (a.website) updates.website = a.website;
        if (Object.keys(updates).length === 0) return { success: false, message: "No fields to update" };
        await api.put(`/api/leads/${lead.id}`, updates);
        return { success: true, message: `Lead "${lead.name}" updated` };
      }

      case "update_client": {
        if (!a.name) return { success: false, message: "Missing required field: name" };
        const client = await findByTitle("/api/clients", "name", a.name as string);
        if (!client) return { success: false, message: `Client "${a.name}" not found` };
        const updates: Record<string, unknown> = {};
        if (a.status) updates.status = a.status;
        if (a.billing_type) updates.billing_type = a.billing_type;
        if (a.plan_tier) updates.plan_tier = a.plan_tier;
        if (a.mrr) { const n = Number(a.mrr); if (isFinite(n)) updates.mrr = n; }
        if (a.project_fee) { const n = Number(a.project_fee); if (isFinite(n)) updates.project_fee = n; }
        if (Object.keys(updates).length === 0) return { success: false, message: "No fields to update" };
        await api.put(`/api/clients/${client.id}`, updates);
        return { success: true, message: `Client "${client.name}" updated` };
      }

      case "search_data": {
        const endpoints: Record<string, string> = {
          tasks: "/api/tasks",
          leads: "/api/leads",
          clients: "/api/clients",
          finance: "/api/finance",
        };
        const endpoint = endpoints[a.scope as string];
        if (!endpoint) return { success: false, message: `Unknown scope: ${a.scope}` };
        const items = await api.get(endpoint) as Record<string, unknown>[];
        if (!Array.isArray(items)) return { success: true, message: "No data found", data: [] };

        // Filter if query provided
        let results = items;
        if (a.query) {
          const q = (a.query as string).toLowerCase();
          results = items.filter(item => {
            const searchable = [item.title, item.name, item.description, item.category, item.client, item.industry, item.needs]
              .filter(Boolean).join(" ").toLowerCase();
            return searchable.includes(q);
          });
        }
        return { success: true, message: `Found ${results.length} items`, data: results.slice(0, 10) };
      }

      case "web_search": {
        const query = a.query as string;
        if (!query) return { success: false, message: "No search query provided" };
        return await executeWebSearch(query, (a.lang as string) || "en");
      }

      default:
        return { success: false, message: `Unknown tool: ${call.name}` };
    }
  } catch (err) {
    return { success: false, message: `Error: ${(err as Error).message}` };
  }
}

/* ── Web search via Gemini Search Grounding ───────────────── */

async function executeWebSearch(query: string, lang: string): Promise<ToolResult> {
  // Try to get Gemini API key from settings
  let geminiKey = "";
  try {
    const settings = await api.get("/api/settings") as Record<string, string>;
    geminiKey = settings?.gemini_api_key || "";
  } catch { /* ignore */ }

  // Also check localStorage cache (avoids redundant API call)
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
    // Also extract grounding metadata if available
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

/* ── Build tools description for system prompt ────────────── */

/** Generate a concise tools section for the system prompt */
/**
 * Build tools prompt filtered to only allowed tools.
 * If allowedTools is null/undefined/empty, includes all tools (default behavior).
 */
export function buildFilteredToolsPrompt(lang: string, allowedTools?: string[] | null): string {
  if (!allowedTools) return buildToolsPrompt(lang);
  if (allowedTools.length === 0) return ''; // No tools — agent has no tool access

  const isZh = lang === "zh";
  const today = todayDateKey();
  const weekday = isZh
    ? ["日", "一", "二", "三", "四", "五", "六"][new Date().getDay()]
    : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];

  const toolDescriptions: Record<string, { zh: string; en: string }> = {
    create_task: {
      zh: "**create_task**: 创建任务。参数：title(必填), priority(High/Medium/Low), due(YYYY-MM-DD), client, scope(work/personal/work-memo)",
      en: "**create_task**: Create a task. Args: title(required), priority(High/Medium/Low), due(YYYY-MM-DD), client, scope(work/personal/work-memo)",
    },
    update_task: {
      zh: "**update_task**: 更新任务。参数：title(必填,用于匹配), column(todo/inProgress/review/done), priority, due",
      en: "**update_task**: Update a task. Args: title(required, for matching), column(todo/inProgress/review/done), priority, due",
    },
    delete_task: {
      zh: "**delete_task**: 删除任务。参数：title(必填,用于匹配)",
      en: "**delete_task**: Delete a task. Args: title(required, for matching)",
    },
    create_lead: {
      zh: "**create_lead**: 创建线索。参数：name(必填), industry, needs, source",
      en: "**create_lead**: Create a lead. Args: name(required), industry, needs, source",
    },
    move_lead: {
      zh: "**move_lead**: 移动线索。参数：name(必填), column(new/contacted/proposal/won/lost)(必填)",
      en: "**move_lead**: Move a lead. Args: name(required), column(new/contacted/proposal/won/lost)(required)",
    },
    update_lead: {
      zh: "**update_lead**: 更新线索信息。参数：name(必填,用于匹配), industry, needs, source, website",
      en: "**update_lead**: Update a lead. Args: name(required, for matching), industry, needs, source, website",
    },
    record_transaction: {
      zh: "**record_transaction**: 记账。参数：type(income/expense)(必填), amount(必填), description(必填), scope(business/personal，默认business，用户说个人/生活就用personal), category(公司:收入/软件支出/外包支出/其他支出，个人:餐饮/交通/房租/娱乐/个人其他), date(YYYY-MM-DD), status(已完成/待收款 (应收)/待支付 (应付)，默认已完成)",
      en: "**record_transaction**: Record transaction. Args: type(income/expense)(required), amount(required), description(required), scope(business/personal, default business — use personal for personal/life expenses), category(biz:收入/软件支出/外包支出/其他支出, personal:餐饮/交通/房租/娱乐/个人其他), date(YYYY-MM-DD), status(已完成/待收款 (应收)/待支付 (应付), default: 已完成)",
    },
    create_client: {
      zh: "**create_client**: 创建客户。参数：name(必填), billing_type(subscription/project), plan_tier, mrr, project_fee",
      en: "**create_client**: Create client. Args: name(required), billing_type(subscription/project), plan_tier, mrr, project_fee",
    },
    update_client: {
      zh: "**update_client**: 更新客户信息。参数：name(必填,用于匹配), status(Active/Paused/Cancelled/Completed), billing_type(subscription/project), plan_tier, mrr, project_fee",
      en: "**update_client**: Update a client. Args: name(required, for matching), status(Active/Paused/Cancelled/Completed), billing_type(subscription/project), plan_tier, mrr, project_fee",
    },
    search_data: {
      zh: "**search_data**: 搜索数据。参数：scope(tasks/leads/clients/finance)(必填), query",
      en: "**search_data**: Search data. Args: scope(tasks/leads/clients/finance)(required), query",
    },
    web_search: {
      zh: "**web_search**: 搜索互联网。参数：query(必填，尽量具体，包含地点/行业等), lang(zh/en)",
      en: "**web_search**: Search the internet. Args: query(required, be specific with location/industry), lang(zh/en)",
    },
  };

  const filteredDescriptions = allowedTools
    .filter(t => toolDescriptions[t])
    .map(t => `- ${toolDescriptions[t][isZh ? "zh" : "en"]}`);

  if (filteredDescriptions.length === 0) return "";

  // Build a few examples relevant to the allowed tools
  const examplesZh: string[] = [];
  const examplesEn: string[] = [];
  if (allowedTools.includes("record_transaction")) {
    examplesZh.push(`用户说"记一笔支出 50 买域名" → 你返回：\n\`\`\`json\n{"tool_call": {"name": "record_transaction", "args": {"type": "expense", "amount": 50, "description": "买域名", "scope": "business", "category": "软件支出", "date": "${today}"}}}\n\`\`\`\n用户说"个人支出，吃饭花了80" → 你返回：\n\`\`\`json\n{"tool_call": {"name": "record_transaction", "args": {"type": "expense", "amount": 80, "description": "吃饭", "scope": "personal", "category": "餐饮", "date": "${today}"}}}\n\`\`\``);
    examplesEn.push(`User: "Record expense $50 for domain" → return:\n\`\`\`json\n{"tool_call": {"name": "record_transaction", "args": {"type": "expense", "amount": 50, "description": "Domain purchase", "scope": "business", "date": "${today}"}}}\n\`\`\`\nUser: "Personal expense, lunch $15" → return:\n\`\`\`json\n{"tool_call": {"name": "record_transaction", "args": {"type": "expense", "amount": 15, "description": "Lunch", "scope": "personal", "category": "餐饮", "date": "${today}"}}}\n\`\`\``);
  }
  if (allowedTools.includes("create_task")) {
    examplesZh.push(`用户说"创建任务：写周报" → 你返回：\n\`\`\`json\n{"tool_call": {"name": "create_task", "args": {"title": "写周报"}}}\n\`\`\``);
    examplesEn.push(`User: "Create task: write report" → return:\n\`\`\`json\n{"tool_call": {"name": "create_task", "args": {"title": "Write report"}}}\n\`\`\``);
  }
  if (allowedTools.includes("create_lead")) {
    examplesZh.push(`用户说"添加线索：张三公司" → 你返回：\n\`\`\`json\n{"tool_call": {"name": "create_lead", "args": {"name": "张三公司"}}}\n\`\`\``);
    examplesEn.push(`User: "Add lead: Acme Corp" → return:\n\`\`\`json\n{"tool_call": {"name": "create_lead", "args": {"name": "Acme Corp"}}}\n\`\`\``);
  }

  if (isZh) {
    const exSection = examplesZh.length > 0 ? `\n### 示例\n\n${examplesZh.join("\n\n")}\n` : "";
    return `
## 可用工具

今天是 ${today}（周${weekday}）。用户提到"明天""下周五""月底"等相对日期时，请根据今天推算出具体 YYYY-MM-DD。

当用户要求你执行操作时，你**必须**返回下面格式的 JSON（不要只用文字描述）：
\`\`\`json
{"tool_call": {"name": "工具名", "args": {参数}}}
\`\`\`
${exSection}
可用工具：
${filteredDescriptions.join("\n")}

规则：
- 你是 CEO 的 AI 员工，CEO 下达指令，你主动执行
- 如果指令需要多步操作（先搜索、再创建），你可以连续调用工具，每次回复调用一个
- search_data 和 web_search 会自动执行，结果会反馈给你继续下一步
- **重要：当用户要求执行操作时，你必须返回 JSON，不要只用文字回复**`;
  }

  const exSection = examplesEn.length > 0 ? `\n### Examples\n\n${examplesEn.join("\n\n")}\n` : "";
  return `
## Available Tools

Today is ${today} (${weekday}). When the user mentions relative dates like "tomorrow", "next Friday", "end of month", calculate the exact YYYY-MM-DD from today.

When the user asks you to DO something, you **MUST** return this JSON format (do NOT just describe the action in text):
\`\`\`json
{"tool_call": {"name": "tool_name", "args": {params}}}
\`\`\`
${exSection}
Tools:
${filteredDescriptions.join("\n")}

Rules:
- You are the CEO's AI employee. The CEO gives directives, you execute proactively
- If a directive requires multiple steps (search → create), chain tool calls across responses, one per response
- search_data and web_search execute automatically, results feed back for your next step
- **IMPORTANT: When the user asks you to do something, you MUST return JSON — do NOT just describe the action in text**`;
}

export function buildToolsPrompt(lang: string): string {
  const isZh = lang === "zh";
  const today = todayDateKey();
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][new Date().getDay()];

  if (isZh) {
    return `
## 可用工具

今天是 ${today}（周${weekday}）。用户提到"明天""下周五""月底"等相对日期时，请根据今天推算出具体 YYYY-MM-DD。

当用户要求你执行操作时，你**必须**返回下面格式的 JSON（不要只用文字描述，要返回 JSON）：
\`\`\`json
{"tool_call": {"name": "工具名", "args": {参数}}}
\`\`\`

### 示例

用户说"记一笔支出 50 买域名" → 你返回：
\`\`\`json
{"tool_call": {"name": "record_transaction", "args": {"type": "expense", "amount": 50, "description": "买域名", "scope": "business", "category": "软件支出", "date": "${today}"}}}
\`\`\`

用户说"创建任务：写周报" → 你返回：
\`\`\`json
{"tool_call": {"name": "create_task", "args": {"title": "写周报", "priority": "Medium"}}}
\`\`\`

用户说"个人支出，吃饭花了80" → 你返回：
\`\`\`json
{"tool_call": {"name": "record_transaction", "args": {"type": "expense", "amount": 80, "description": "吃饭", "scope": "personal", "category": "餐饮", "date": "${today}"}}}
\`\`\`

用户说"添加一个备忘：下周联系张三" → 你返回：
\`\`\`json
{"tool_call": {"name": "create_task", "args": {"title": "下周联系张三", "scope": "work-memo"}}}
\`\`\`

### 关键词→工具对照

| 用户说 | 使用工具 |
|--------|----------|
| 记支出/花了/买了/付了 | record_transaction (type=expense, 根据语境判断scope) |
| 个人支出/生活开销 | record_transaction (type=expense, scope=personal) |
| 记收入/收到/入账 | record_transaction (type=income) |
| 创建任务/添加任务/新任务 | create_task (scope=work) |
| 创建备忘/记个备忘/提醒我 | create_task (scope=work-memo) |
| 添加线索/新线索 | create_lead |
| 搜索/查找/有多少 | search_data |
| 完成任务/任务做完了 | update_task (column=done) |

### 可用工具

- **create_task**: 创建任务。参数：title(必填), priority(High/Medium/Low), due(YYYY-MM-DD), client, scope(work/personal/work-memo)
- **update_task**: 更新任务。参数：title(必填,用于匹配), column(todo/inProgress/review/done), priority, due
- **delete_task**: 删除任务。参数：title(必填,用于匹配)
- **create_lead**: 创建线索。参数：name(必填), industry, needs, source
- **move_lead**: 移动线索。参数：name(必填), column(new/contacted/proposal/won/lost)(必填)
- **update_lead**: 更新线索信息。参数：name(必填,用于匹配), industry, needs, source, website
- **record_transaction**: 记账（收入/支出）。参数：type(income/expense)(必填), amount(必填), description(必填), scope(business/personal，用户说个人/生活就用personal), category(公司:收入/软件支出/外包支出/其他支出，个人:餐饮/交通/房租/娱乐/个人其他), date(YYYY-MM-DD), status(已完成/待收款 (应收)/待支付 (应付))
- **create_client**: 创建客户。参数：name(必填), billing_type(subscription/project), plan_tier, mrr, project_fee
- **update_client**: 更新客户信息。参数：name(必填,用于匹配), status(Active/Paused/Cancelled/Completed), billing_type, plan_tier, mrr, project_fee
- **search_data**: 搜索数据。参数：scope(tasks/leads/clients/finance)(必填), query
- **web_search**: 搜索互联网。参数：query(必填), lang(zh/en)

**重要：当用户要求执行操作时，你必须返回 JSON，不要只用文字回复。**`;
  }

  const weekdayEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];
  return `
## Available Tools

Today is ${today} (${weekdayEn}). When the user mentions relative dates like "tomorrow", "next Friday", "end of month", calculate the exact YYYY-MM-DD from today.

When the user asks you to DO something, you **MUST** return this JSON format (do NOT just describe the action in text):
\`\`\`json
{"tool_call": {"name": "tool_name", "args": {params}}}
\`\`\`

### Examples

User: "Record expense $50 for domain" → return:
\`\`\`json
{"tool_call": {"name": "record_transaction", "args": {"type": "expense", "amount": 50, "description": "Domain purchase", "scope": "business", "category": "软件支出", "date": "${today}"}}}
\`\`\`

User: "Personal expense, lunch $15" → return:
\`\`\`json
{"tool_call": {"name": "record_transaction", "args": {"type": "expense", "amount": 15, "description": "Lunch", "scope": "personal", "category": "餐饮", "date": "${today}"}}}
\`\`\`

User: "Create task: write weekly report" → return:
\`\`\`json
{"tool_call": {"name": "create_task", "args": {"title": "Write weekly report", "priority": "Medium"}}}
\`\`\`

### Tools

- **create_task**: Create a task. Args: title(required), priority(High/Medium/Low), due(YYYY-MM-DD), client, scope(work/personal/work-memo)
- **update_task**: Update a task. Args: title(required, for matching), column(todo/inProgress/review/done), priority, due
- **delete_task**: Delete a task. Args: title(required, for matching)
- **create_lead**: Create a lead. Args: name(required), industry, needs, source
- **move_lead**: Move a lead. Args: name(required), column(new/contacted/proposal/won/lost)(required)
- **update_lead**: Update a lead. Args: name(required, for matching), industry, needs, source, website
- **record_transaction**: Record income or expense. Args: type(income/expense)(required), amount(required), description(required), scope(business/personal — use personal for personal/life expenses), category(biz:收入/软件支出/外包支出/其他支出, personal:餐饮/交通/房租/娱乐/个人其他), date(YYYY-MM-DD), status(已完成/待收款 (应收)/待支付 (应付))
- **create_client**: Create client. Args: name(required), billing_type(subscription/project), plan_tier, mrr, project_fee
- **update_client**: Update a client. Args: name(required, for matching), status(Active/Paused/Cancelled/Completed), billing_type, plan_tier, mrr, project_fee
- **search_data**: Search data. Args: scope(tasks/leads/clients/finance)(required), query
- **web_search**: Search the internet. Args: query(required), lang(zh/en)

**IMPORTANT: When the user asks you to do something, you MUST return JSON — do NOT just describe the action in text.**`;
}
