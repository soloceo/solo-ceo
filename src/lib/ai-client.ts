/**
 * Unified AI client — expense parsing, task creation, lead analysis, outreach.
 * Supports Gemini, Claude, and OpenAI.
 */

import { todayDateKey } from "./date-utils";

export type AIProvider = "gemini" | "claude" | "openai" | "ollama";

export const AI_KEY_MAP: Record<string, string> = {
  gemini: "gemini_api_key",
  claude: "claude_api_key",
  openai: "openai_api_key",
};

// ── Device-level AI provider (localStorage) ──────────────────

const LS_PROVIDER = "solo_ai_provider";
const LS_OLLAMA_URL = "solo_ollama_url";
const LS_OLLAMA_MODEL = "solo_ollama_model";

export function getDeviceAIProvider(): AIProvider | "" {
  const val = localStorage.getItem(LS_PROVIDER);
  if (!val || val === "off") return "";
  return val as AIProvider;
}
export function setDeviceAIProvider(p: AIProvider | ""): void {
  // Store "off" explicitly so getAIConfig won't fall back to cloud settings
  localStorage.setItem(LS_PROVIDER, p || "off");
}
export function getOllamaConfig(): { url: string; model: string } {
  return {
    url: localStorage.getItem(LS_OLLAMA_URL) || "http://localhost:11434",
    model: localStorage.getItem(LS_OLLAMA_MODEL) || "gemma4",
  };
}
export function setOllamaConfig(url: string, model: string): void {
  localStorage.setItem(LS_OLLAMA_URL, url);
  localStorage.setItem(LS_OLLAMA_MODEL, model);
}

/**
 * Unified config reader — device-level provider takes precedence.
 * Returns null if no provider configured or cloud provider has no key.
 */
export function getAIConfig(settings: Record<string, string> | null): { provider: AIProvider; apiKey: string } | null {
  // Device-level preference takes full precedence (including explicit "off")
  const hasDevicePref = localStorage.getItem(LS_PROVIDER) != null;
  const provider = hasDevicePref ? getDeviceAIProvider() : (settings?.ai_provider as AIProvider | "");
  if (!provider) return null;
  if (provider === "ollama") return { provider, apiKey: "" };
  const keyName = AI_KEY_MAP[provider];
  const apiKey = keyName ? (settings?.[keyName] || "") : "";
  if (!apiKey) return null;
  return { provider, apiKey };
}

/* ── Low-level API callers ──────────────────────────────── */

/** Safely extract JSON from AI output (handles markdown fences, leading text) */
function extractJSON(text: string): any {
  // Try direct parse first
  try { return JSON.parse(text); } catch {}
  // Strip markdown fences
  const stripped = text.replace(/```json\n?|\n?```/g, "").trim();
  try { return JSON.parse(stripped); } catch {}
  // Extract first {...} block
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error("Cannot parse JSON from AI response");
}

/** Call AI and get structured JSON response */
async function callJSON(provider: AIProvider, apiKey: string, systemPrompt: string, userText: string): Promise<any> {
  if (provider === "ollama") {
    const { url, model } = getOllamaConfig();
    const res = await fetch(`${url}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userText }],
        response_format: { type: "json_object" },
        stream: false,
      }),
    });
    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("Empty Ollama response");
    return extractJSON(text);
  }

  if (provider === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userText }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty Gemini response");
    return JSON.parse(text);
  }

  if (provider === "claude") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6-20250514",
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: "user", content: userText }],
      }),
    });
    if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
    const data = await res.json();
    const text = data.content?.[0]?.text;
    if (!text) throw new Error("Empty Claude response");
    return extractJSON(text);
  }

  // OpenAI
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userText }],
      max_tokens: 512,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty OpenAI response");
  return JSON.parse(text);
}

/** Call AI and get plain text response (for emails, etc.) */
async function callText(provider: AIProvider, apiKey: string, systemPrompt: string, userText: string): Promise<string> {
  if (provider === "ollama") {
    const { url, model } = getOllamaConfig();
    const res = await fetch(`${url}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userText }],
        stream: false,
      }),
    });
    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  if (provider === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userText }] }],
          generationConfig: { responseMimeType: "text/plain" },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  if (provider === "claude") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userText }],
      }),
    });
    if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text || "";
  }

  // OpenAI
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userText }],
      max_tokens: 1024,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

/* ── Streaming chat ──────────────────────────────── */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Stream a chat completion. Calls `onChunk` with each text delta.
 * Returns the full accumulated text. Supports abort via AbortSignal.
 */
export async function streamChat(
  provider: AIProvider,
  apiKey: string,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  // Build request based on provider
  let url: string;
  let headers: Record<string, string>;
  let body: string;

  if (provider === "ollama") {
    const cfg = getOllamaConfig();
    url = `${cfg.url}/v1/chat/completions`;
    headers = { "Content-Type": "application/json" };
    body = JSON.stringify({ model: cfg.model, messages, stream: true });
  } else if (provider === "openai") {
    url = "https://api.openai.com/v1/chat/completions";
    headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
    body = JSON.stringify({ model: "gpt-4.1-mini", messages, stream: true, max_tokens: 2048 });
  } else if (provider === "claude") {
    url = "https://api.anthropic.com/v1/messages";
    headers = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    };
    const sysMsg = messages.find(m => m.role === "system")?.content || "";
    const chatMsgs = messages.filter(m => m.role !== "system");
    body = JSON.stringify({ model: "claude-sonnet-4-6-20250514", max_tokens: 2048, system: sysMsg, messages: chatMsgs, stream: true });
  } else if (provider === "gemini") {
    // Gemini uses a different streaming format — fall back to non-streaming
    const sysMsg = messages.find(m => m.role === "system")?.content || "";
    const userMsgs = messages.filter(m => m.role !== "system").map(m => m.content).join("\n");
    const text = await callText(provider, apiKey, sysMsg, userMsgs);
    onChunk(text);
    return text;
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const res = await fetch(url, { method: "POST", headers, body, signal });
  if (!res.ok) throw new Error(`AI error: ${res.status}`);
  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "data: [DONE]") continue;

      if (trimmed.startsWith("data: ")) {
        try {
          const json = JSON.parse(trimmed.slice(6));
          // OpenAI / Ollama format
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) { full += delta; onChunk(delta); continue; }
          // Claude format
          if (json.type === "content_block_delta") {
            const text = json.delta?.text;
            if (text) { full += text; onChunk(text); }
          }
        } catch { /* skip unparseable lines */ }
      } else if (trimmed.startsWith("event:")) {
        continue; // Claude SSE event labels
      }
    }
  }

  return full;
}

/* ── Expense Parsing ──────────────────────────────── */

export interface ParsedTx {
  category: string;
  amount: number;
  description: string;
  date: string;
}

const BIZ_CATS_ZH = ["收入", "软件支出", "硬件支出", "外包支出", "营销推广", "办公费用", "差旅费", "其他支出"];
const PERSONAL_CATS_ZH = ["餐饮", "交通", "房租", "购物", "娱乐", "医疗", "学习", "个人其他"];
const BIZ_CATS_EN = ["Income", "Software", "Hardware", "Outsourcing", "Marketing", "Office", "Travel", "Other Expense"];
const PERSONAL_CATS_EN = ["Food", "Transport", "Rent", "Shopping", "Entertainment", "Health", "Education", "Other"];

export async function parseExpense(
  text: string, tab: "business" | "personal", lang: string,
  provider: AIProvider, apiKey: string
): Promise<ParsedTx> {
  const isZh = lang === "zh";
  const cats = tab === "business"
    ? (isZh ? BIZ_CATS_ZH : BIZ_CATS_EN)
    : (isZh ? PERSONAL_CATS_ZH : PERSONAL_CATS_EN);
  const today = todayDateKey();

  const examples = isZh
    ? `示例：
输入："午饭 35" → {"category":"餐饮","amount":35,"description":"午饭","date":"${today}"}
输入："上月AWS 200" → {"category":"软件支出","amount":200,"description":"AWS 云服务","date":"YYYY-MM-DD"}（取上月某日）
输入："收到客户尾款5000" → {"category":"收入","amount":5000,"description":"客户尾款","date":"${today}"}
输入："打车去客户公司 45" → {"category":"差旅费","amount":45,"description":"打车去客户公司","date":"${today}"}`
    : `Examples:
"lunch 35" → {"category":"Food","amount":35,"description":"Lunch","date":"${today}"}
"AWS last month 200" → {"category":"Software","amount":200,"description":"AWS cloud","date":"YYYY-MM-DD"}
"client payment 5000" → {"category":"Income","amount":5000,"description":"Client payment","date":"${today}"}
"taxi to client 45" → {"category":"Travel","amount":45,"description":"Taxi to client","date":"${today}"}`;

  const prompt = isZh
    ? `你是记账助手。把用户输入解析为一笔交易记录。

可用分类：${JSON.stringify(cats)}
今天：${today}

规则：
- 从列表中选最合适的分类
- 金额必须是正数
- 描述：简短说明用途（10字以内）
- 日期：没提到就用今天；提到"昨天/上周/上月"等要推算
- ${tab === "business" ? '"收入"是收入类，其余都是支出类' : '所有分类都是支出'}

${examples}

只返回 JSON：{"category":"...","amount":0,"description":"...","date":"YYYY-MM-DD"}`
    : `You are a bookkeeping assistant. Parse natural language into a transaction.

Categories: ${JSON.stringify(cats)}
Today: ${today}

Rules:
- Pick the best category from the list
- Amount must be a positive number
- Description: short summary (under 10 words)
- Date: use today unless user specifies another date (yesterday, last week, etc.)
- ${tab === "business" ? '"Income" = income, others = expenses' : 'All categories are expenses'}

${examples}

Return ONLY JSON: {"category":"...","amount":0,"description":"...","date":"YYYY-MM-DD"}`;

  const result = await callJSON(provider, apiKey, prompt, text);
  if (!cats.includes(result.category)) result.category = cats[cats.length - 1];
  if (!result.amount || result.amount <= 0) throw new Error("Invalid amount");
  if (!result.date) result.date = today;
  if (!result.description) result.description = text;
  return result;
}

/* ── Lead Outreach Email ──────────────────────────────── */

export async function generateOutreach(
  lead: { name: string; industry?: string; needs?: string; website?: string },
  tone: "formal" | "friendly" | "direct",
  lang: "zh" | "en",
  provider: AIProvider, apiKey: string,
  businessDescription?: string,
): Promise<string> {
  const bizCtx = businessDescription || (lang === "zh" ? "独立创业者" : "solo entrepreneur");
  const toneGuide = {
    formal: lang === "zh"
      ? "正式商务风格，使用敬语（您、贵公司），结构清晰"
      : "Professional and formal, use proper salutations, structured paragraphs",
    friendly: lang === "zh"
      ? "温暖友好，像朋友推荐一样自然，避免过度正式"
      : "Warm and approachable, like a friend's recommendation, avoid being stiff",
    direct: lang === "zh"
      ? "简洁直接，开门见山，不超过5句话"
      : "Short and to the point, get to the value proposition in the first sentence, max 5 sentences",
  };

  const prompt = lang === "zh"
    ? `你是一位销售文案助手。用户的业务：${bizCtx}

根据以下线索信息撰写一封冷开发邮件。

线索信息：
- 公司/姓名：${lead.name}
- 行业：${lead.industry || "未知"}
- 潜在需求：${lead.needs || "未说明"}
- 网站/简介：${lead.website || "无"}

写作要求：
- 语气：${toneGuide[tone]}
- 第一行写邮件主题（格式：主题：xxx）
- 正文开头表明你了解他们的业务
- 中间说明你能提供的具体价值（结合用户的业务描述）
- 结尾给出明确的行动号召（比如约个15分钟电话）
- 控制在150字以内
- 纯文本格式，不要用markdown

直接输出邮件内容，不要额外解释。`
    : `You are a sales copywriter. User's business: ${bizCtx}

Write a cold outreach email based on this lead.

Lead info:
- Company/Name: ${lead.name}
- Industry: ${lead.industry || "unknown"}
- Potential needs: ${lead.needs || "not specified"}
- Website/Bio: ${lead.website || "none"}

Requirements:
- Tone: ${toneGuide[tone]}
- First line: Subject: xxx
- Opening: show you understand their business
- Middle: specific value you can provide (based on user's business description)
- Closing: clear call to action (e.g., 15-min call)
- Under 150 words
- Plain text only, no markdown

Output the email directly, no extra explanation.`;

  return await callText(provider, apiKey, prompt, `Write outreach email for ${lead.name}`);
}

/* ── Lead Quality Analysis ──────────────────────────────── */

export interface LeadAnalysis {
  score: "high" | "medium" | "low";
  reason: string;
}

export async function analyzeLeadQuality(
  lead: { name: string; industry?: string; needs?: string; website?: string },
  lang: string, provider: AIProvider, apiKey: string,
  businessDescription?: string,
): Promise<LeadAnalysis> {
  const bizCtx = businessDescription || (lang === "zh" ? "独立创业者" : "solo entrepreneur");
  const prompt = lang === "zh"
    ? `你是一位销售顾问。用户的业务：${bizCtx}

分析以下线索的跟进价值。

线索信息：
- 公司/姓名：${lead.name}
- 行业：${lead.industry || "未知"}
- 潜在需求：${lead.needs || "未说明"}
- 网站/简介：${lead.website || "无"}

评估标准：
- 需求匹配度：该线索的需求是否和用户的业务相关？
- 预算潜力：该行业/规模通常有多少预算？
- 信息完整度：是否有足够信息开始跟进？

评为 "high"（值得立即跟进）、"medium"（可以跟进）或 "low"（暂时搁置）。
用中文写一句话理由，要具体（提到线索的具体情况，不要泛泛而谈）。

返回JSON：{"score":"high|medium|low","reason":"一句话理由"}`
    : `You are a sales advisor. User's business: ${bizCtx}

Analyze this lead's follow-up value.

Lead info:
- Company/Name: ${lead.name}
- Industry: ${lead.industry || "unknown"}
- Needs: ${lead.needs || "not specified"}
- Website/Bio: ${lead.website || "none"}

Criteria:
- Need match: does this lead's needs align with the user's business?
- Budget potential: typical budget in this industry/company size?
- Info completeness: enough to start outreach?

Rate as "high" (pursue now), "medium" (worth following up), or "low" (park for later).
One specific sentence reason (mention the lead's specifics, not generic advice).

Return JSON: {"score":"high|medium|low","reason":"one sentence"}`;

  const result = await callJSON(provider, apiKey, prompt, `Analyze: ${lead.name}`);
  if (!["high", "medium", "low"].includes(result.score)) result.score = "medium";
  if (!result.reason) result.reason = "";
  return result;
}

/* ── Work Task Parsing ──────────────────────────────── */

export interface ParsedWorkTask {
  title: string;
  client: string;
  priority: "High" | "Medium" | "Low";
  column: string;
}

export async function parseWorkTask(
  text: string, clientNames: string[], lang: string,
  provider: AIProvider, apiKey: string
): Promise<ParsedWorkTask> {
  const isZh = lang === "zh";
  const clientList = clientNames.length ? clientNames.join(", ") : (isZh ? "无" : "none");

  const examples = isZh
    ? `示例：
"给Aegis设计logo 高优" → {"title":"设计Logo","client":"Aegis","priority":"High","column":"todo"}
"写周报" → {"title":"写周报","client":"","priority":"Medium","column":"todo"}
"紧急修复Acme的登录bug" → {"title":"修复登录Bug","client":"Acme","priority":"High","column":"todo"}`
    : `Examples:
"design logo for Aegis high priority" → {"title":"Design logo","client":"Aegis","priority":"High","column":"todo"}
"write weekly report" → {"title":"Write weekly report","client":"","priority":"Medium","column":"todo"}
"urgent fix login bug for Acme" → {"title":"Fix login bug","client":"Acme","priority":"High","column":"todo"}`;

  const prompt = isZh
    ? `把用户输入解析为一个工作任务。

已有客户列表：${clientList}
优先级：High / Medium / Low（默认 Medium）

规则：
- 标题：简洁、动词开头（如"设计..."、"修复..."、"编写..."）
- 客户：从已有客户列表中模糊匹配（拼音、简写都算），没提到就留空
- 优先级：检测关键词（高/紧急/重要→High，低/不急→Low）
- column 固定为 "todo"

${examples}

只返回 JSON：{"title":"...","client":"","priority":"Medium","column":"todo"}`
    : `Parse natural language into a work task.

Known clients: ${clientList}
Priorities: High, Medium, Low (default: Medium)

Rules:
- Title: concise, action-oriented verb phrase
- Client: fuzzy match from known clients if mentioned, otherwise empty string
- Priority: detect keywords (urgent/important/high → High, low/not urgent → Low)
- Column: always "todo"

${examples}

Return ONLY JSON: {"title":"...","client":"","priority":"Medium","column":"todo"}`;

  const result = await callJSON(provider, apiKey, prompt, text);
  if (!result.title) result.title = text;
  if (!["High", "Medium", "Low"].includes(result.priority)) result.priority = "Medium";
  result.column = "todo";
  return result;
}

/* ── Personal Task Breakdown ──────────────────────────────── */

export interface TaskBreakdown {
  title: string;
  steps: string[];
}

export async function parseTaskBreakdown(
  text: string, lang: string,
  provider: AIProvider, apiKey: string
): Promise<TaskBreakdown> {
  const isZh = lang === "zh";

  const prompt = isZh
    ? `你是一个效率助手。用户描述一个任务或目标，你把它拆解成5-8个可执行的小步骤。

拆解原则：
- 每步5-30分钟可完成
- 按执行顺序排列
- 动词开头，具体可执行（"打电话给XX确认需求"而不是"联系相关方"）
- 每步都小到让人愿意立刻开始

示例：
输入："搬家"
输出：{"title":"搬家","steps":["��出所有需要搬的物品清单","联系3家���家公司比价","预约搬家日期和时间","打包不常用物品（书籍、冬衣等）","打包日常用品和电子设备","监督搬家公司搬运","到新家检查物品是否完好","整理新家布置家具"]}

输入："做一个产品官网"
输出：{"title":"产品官网","steps":["收集3个喜欢的参考网站截图","写首页文案（标题+卖点+CTA）","用Figma画首页线框图","选定技术方案（框架+部署）","开发首页响应式布局","添加内容和图片素材","部署上线并测试各设备显示"]}

返回JSON（不要markdown）：
{"title":"简洁的任务名","steps":["步骤1","步骤2",...]}`
    : `You are a productivity assistant. Break down the user's task into 5-8 actionable steps.

Principles:
- Each step takes 5-30 minutes
- In execution order
- Start with a verb, be specific ("Call X to confirm requirements" not "Contact stakeholders")
- Each step should feel small enough to start immediately

Example:
Input: "Launch a product landing page"
Output: {"title":"Product landing page","steps":["Collect 3 reference sites for inspiration","Write hero copy (headline + value props + CTA)","Wireframe the page layout in Figma","Choose tech stack (framework + hosting)","Build responsive page layout","Add content, images, and SEO meta","Deploy, test on mobile/desktop, share link"]}

Return JSON only: {"title":"concise task name","steps":["step 1","step 2",...]}`;

  const result = await callJSON(provider, apiKey, prompt, text);
  if (!result.title) result.title = text;
  if (!Array.isArray(result.steps) || result.steps.length === 0) {
    throw new Error("AI returned no steps");
  }
  return result;
}

/* ── API Key Test ──────────────────────────────── */

/** Fetch installed models from Ollama */
export async function fetchOllamaModels(url: string): Promise<string[]> {
  try {
    const res = await fetch(`${url}/api/tags`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m: { name: string }) => m.name);
  } catch { return []; }
}

export async function testApiKey(provider: AIProvider, apiKey: string): Promise<boolean> {
  try {
    if (provider === "ollama") {
      const { url } = getOllamaConfig();
      const models = await fetchOllamaModels(url);
      return models.length > 0;
    }
    if (provider === "gemini") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Say OK" }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
        }
      );
      return res.ok;
    }
    if (provider === "claude") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6-20250514",
          max_tokens: 5,
          messages: [{ role: "user", content: "Say OK" }],
        }),
      });
      return res.ok;
    }
    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [{ role: "user", content: "Say OK" }],
          max_tokens: 5,
        }),
      });
      return res.ok;
    }
    return false;
  } catch {
    return false;
  }
}
