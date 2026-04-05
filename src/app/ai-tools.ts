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
        scope: { type: "string", description: "Task scope", enum: ["work", "personal"], default: "work" },
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
    description: "Record an income or expense transaction",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", description: "Transaction type", enum: ["income", "expense"] },
        amount: { type: "number", description: "Amount (positive number)" },
        category: { type: "string", description: "Category (e.g. Income, Software, Food, Travel)" },
        description: { type: "string", description: "Short description" },
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
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
export function buildConfirmInfo(call: ToolCall, lang: string): ToolConfirmInfo {
  const isZh = lang === "zh";
  const a = call.args;

  switch (call.name) {
    case "create_task":
      return {
        toolName: call.name,
        label: isZh ? "创建任务" : "Create Task",
        details: [
          `${isZh ? "标题" : "Title"}: ${a.title}`,
          ...(a.priority ? [`${isZh ? "优先级" : "Priority"}: ${a.priority}`] : []),
          ...(a.due ? [`${isZh ? "截止" : "Due"}: ${a.due}`] : []),
          ...(a.client ? [`${isZh ? "客户" : "Client"}: ${a.client}`] : []),
        ],
        args: a,
      };

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
          `${isZh ? "金额" : "Amount"}: $${Number(a.amount).toLocaleString()}`,
          ...(a.category ? [`${isZh ? "分类" : "Category"}: ${a.category}`] : []),
          ...(a.date ? [`${isZh ? "日期" : "Date"}: ${a.date}`] : []),
        ],
        args: a,
      };

    case "create_client":
      return {
        toolName: call.name,
        label: isZh ? "创建客户" : "Create Client",
        details: [
          `${isZh ? "名称" : "Name"}: ${a.name}`,
          ...(a.billing_type ? [`${isZh ? "计费" : "Billing"}: ${a.billing_type}`] : []),
          ...(a.mrr ? [`MRR: $${Number(a.mrr).toLocaleString()}`] : []),
          ...(a.project_fee ? [`${isZh ? "项目费" : "Fee"}: $${Number(a.project_fee).toLocaleString()}`] : []),
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

/** Find item by fuzzy title match */
async function findByTitle(endpoint: string, titleField: string, query: string): Promise<Record<string, unknown> | null> {
  try {
    const items = await api.get(endpoint) as Record<string, unknown>[];
    if (!Array.isArray(items)) return null;
    const q = (query as string).toLowerCase();
    // Exact match first
    const exact = items.find(i => String(i[titleField] || "").toLowerCase() === q);
    if (exact) return exact;
    // Contains match
    const partial = items.find(i => String(i[titleField] || "").toLowerCase().includes(q));
    if (partial) return partial;
    // Reverse contains
    return items.find(i => q.includes(String(i[titleField] || "").toLowerCase())) || null;
  } catch {
    return null;
  }
}

/** Execute a tool call and return the result */
export async function executeTool(call: ToolCall): Promise<ToolResult> {
  const a = call.args;

  try {
    switch (call.name) {
      case "create_task": {
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
        const task = await findByTitle("/api/tasks", "title", a.title as string);
        if (!task) return { success: false, message: `Task "${a.title}" not found` };
        const updates: Record<string, unknown> = {};
        if (a.column) updates.column = a.column;
        if (a.priority) updates.priority = a.priority;
        if (a.due) updates.due = a.due;
        await api.put(`/api/tasks/${task.id}`, updates);
        return { success: true, message: `Task "${task.title}" updated` };
      }

      case "create_lead": {
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
        const lead = await findByTitle("/api/leads", "name", a.name as string);
        if (!lead) return { success: false, message: `Lead "${a.name}" not found` };
        await api.put(`/api/leads/${lead.id}`, { column: a.column });
        return { success: true, message: `Lead "${lead.name}" moved to ${a.column}` };
      }

      case "record_transaction": {
        const body: Record<string, unknown> = {
          type: a.type || "expense",
          amount: Number(a.amount),
          description: a.description || "",
          date: a.date || todayDateKey(),
          category: a.category || "",
          status: a.type === "income" ? "已完成" : "已完成",
          source: "manual",
        };
        await api.post("/api/finance", body);
        return { success: true, message: `${a.type === "income" ? "Income" : "Expense"} $${Number(a.amount).toLocaleString()} recorded` };
      }

      case "create_client": {
        const body: Record<string, unknown> = {
          name: a.name,
          status: "Active",
          billing_type: a.billing_type || "project",
        };
        if (a.plan_tier) body.plan_tier = a.plan_tier;
        if (a.mrr) body.mrr = Number(a.mrr);
        if (a.project_fee) body.project_fee = Number(a.project_fee);
        await api.post("/api/clients", body);
        return { success: true, message: `Client "${a.name}" created` };
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

  // Also check if device-level Gemini is configured
  if (!geminiKey) {
    const stored = localStorage.getItem("solo-ceo-settings");
    if (stored) {
      try {
        // Settings might have the key from cloud
        const all = await api.get("/api/settings") as Record<string, string>;
        geminiKey = all?.gemini_api_key || "";
      } catch { /* ignore */ }
    }
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
export function buildToolsPrompt(lang: string): string {
  const isZh = lang === "zh";
  const today = todayDateKey();
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][new Date().getDay()];

  if (isZh) {
    return `
## 可用工具

今天是 ${today}（周${weekday}）。用户提到"明天""下周五""月底"等相对日期时，请根据今天推算出具体 YYYY-MM-DD。

你可以通过返回特殊 JSON 来执行操作。当用户要求你做某事（不只是查询），返回：
\`\`\`json
{"tool_call": {"name": "工具名", "args": {参数}}}
\`\`\`

可用工具：
- **create_task**: 创建任务。参数：title(必填), priority(High/Medium/Low), due(YYYY-MM-DD), client, scope(work/personal)
- **update_task**: 更新任务。参数：title(必填,用于匹配), column(todo/inProgress/review/done), priority, due
- **create_lead**: 创建线索。参数：name(必填), industry, needs, source
- **move_lead**: 移动线索。参数：name(必填), column(new/contacted/proposal/won/lost)(必填)
- **record_transaction**: 记账。参数：type(income/expense)(必填), amount(必填), description(必填), category, date(YYYY-MM-DD)
- **create_client**: 创建客户。参数：name(必填), billing_type(subscription/project), plan_tier, mrr, project_fee
- **search_data**: 搜索数据。参数：scope(tasks/leads/clients/finance)(必填), query
- **web_search**: 搜索互联网。参数：query(必填，尽量具体，包含地点/行业等), lang(zh/en)

规则：
- 如果用户明确要求"做"某事（创建、记录、移动、更新），使用工具
- 如果用户只是"问"问题或要分析，直接文字回答
- search_data 和 web_search 的结果你可以直接用，不需要用户确认
- 其他操作需要用户确认后才会执行
- 每次回复只调用一个工具
- 工具调用时不要附加其他文字，只返回 JSON`;
  }

  const weekdayEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];
  return `
## Available Tools

Today is ${today} (${weekdayEn}). When the user mentions relative dates like "tomorrow", "next Friday", "end of month", calculate the exact YYYY-MM-DD from today.

You can execute actions by returning special JSON. When the user asks you to DO something (not just query), return:
\`\`\`json
{"tool_call": {"name": "tool_name", "args": {params}}}
\`\`\`

Tools:
- **create_task**: Create a task. Args: title(required), priority(High/Medium/Low), due(YYYY-MM-DD), client, scope(work/personal)
- **update_task**: Update a task. Args: title(required, for matching), column(todo/inProgress/review/done), priority, due
- **create_lead**: Create a lead. Args: name(required), industry, needs, source
- **move_lead**: Move a lead. Args: name(required), column(new/contacted/proposal/won/lost)(required)
- **record_transaction**: Record transaction. Args: type(income/expense)(required), amount(required), description(required), category, date(YYYY-MM-DD)
- **create_client**: Create client. Args: name(required), billing_type(subscription/project), plan_tier, mrr, project_fee
- **search_data**: Search data. Args: scope(tasks/leads/clients/finance)(required), query
- **web_search**: Search the internet. Args: query(required, be specific with location/industry), lang(zh/en)

Rules:
- If user asks to DO something (create, record, move, update), use a tool
- If user asks a QUESTION or wants analysis, answer in text
- search_data and web_search results can be used directly without user confirmation
- Other actions require user confirmation before executing
- Only one tool call per response
- When calling a tool, return ONLY the JSON, no extra text`;
}
