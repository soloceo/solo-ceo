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
  return (localStorage.getItem(LS_PROVIDER) || "") as AIProvider | "";
}
export function setDeviceAIProvider(p: AIProvider | ""): void {
  if (p) localStorage.setItem(LS_PROVIDER, p);
  else localStorage.removeItem(LS_PROVIDER);
}
export function getOllamaConfig(): { url: string; model: string } {
  return {
    url: localStorage.getItem(LS_OLLAMA_URL) || "http://localhost:11434",
    model: localStorage.getItem(LS_OLLAMA_MODEL) || "gemma3",
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
  const provider = getDeviceAIProvider() || (settings?.ai_provider as AIProvider | "");
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

/* ── Expense Parsing ──────────────────────────────── */

export interface ParsedTx {
  category: string;
  amount: number;
  description: string;
  date: string;
}

const BIZ_CATS = ["收入", "软件支出", "外包支出", "其他支出"];
const PERSONAL_CATS = ["餐饮", "交通", "房租", "娱乐", "个人其他"];

export async function parseExpense(
  text: string, tab: "business" | "personal", lang: string,
  provider: AIProvider, apiKey: string
): Promise<ParsedTx> {
  const cats = tab === "business" ? BIZ_CATS : PERSONAL_CATS;
  const today = todayDateKey();

  const prompt = `You are a bookkeeping assistant. Parse natural language into a transaction.

Categories: ${JSON.stringify(cats)}
Today: ${today}
Language: ${lang === "zh" ? "Chinese" : "English"}

Rules:
- Pick the best category from the list
- Amount must be a positive number
- Description: short summary of what the expense is for
- Date: use today unless user specifies another date
- ${tab === "business" ? '"收入" = income, others = expenses' : 'All categories are expenses'}

Return ONLY JSON: {"category":"...","amount":0,"description":"...","date":"YYYY-MM-DD"}`;

  const result = await callJSON(provider, apiKey, prompt, text);
  const validCats = tab === "business" ? BIZ_CATS : PERSONAL_CATS;
  if (!validCats.includes(result.category)) result.category = validCats[validCats.length - 1];
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
  provider: AIProvider, apiKey: string
): Promise<string> {
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
    ? `你是一位独立设计师/开发者的销售文案助手。根据以下线索信息撰写一封冷开发邮件。

线索信息：
- 公司/姓名：${lead.name}
- 行业：${lead.industry || "未知"}
- 潜在需求：${lead.needs || "未说明"}
- 网站/简介：${lead.website || "无"}

写作要求：
- 语气：${toneGuide[tone]}
- 第一行写邮件主题（格式：主题：xxx）
- 正文开头表明你了解他们的业务
- 中间说明你能提供的具体价值（设计/开发服务）
- 结尾给出明确的行动号召（比如约个15分钟电话）
- 控制在150字以内
- 纯文本格式，不要用markdown

直接输出邮件内容，不要额外解释。`
    : `You are a sales copywriter for a solo designer/developer. Write a cold outreach email.

Lead info:
- Company/Name: ${lead.name}
- Industry: ${lead.industry || "unknown"}
- Potential needs: ${lead.needs || "not specified"}
- Website/Bio: ${lead.website || "none"}

Requirements:
- Tone: ${toneGuide[tone]}
- First line: Subject: xxx
- Opening: show you understand their business
- Middle: specific value you can provide (design/dev services)
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
  lang: string, provider: AIProvider, apiKey: string
): Promise<LeadAnalysis> {
  const prompt = lang === "zh"
    ? `你是一位独立设计师/开发者的销售顾问。分析以下线索的跟进价值。

线索信息：
- 公司/姓名：${lead.name}
- 行业：${lead.industry || "未知"}
- 潜在需求：${lead.needs || "未说明"}
- 网站/简介：${lead.website || "无"}

评估标准：
- 需求匹配度：是否需要设计/网站/品牌服务？
- 预算潜力：该行业通常有多少预算？
- 信息完整度：是否有足够信息开始跟进？

评为 "high"（值得立即跟进）、"medium"（可以跟进）或 "low"（暂时搁置）。
用中文写一句话理由。

返回JSON：{"score":"high|medium|low","reason":"一句话理由"}`
    : `You are a sales advisor for a solo designer/developer. Analyze this lead.

Lead info:
- Company/Name: ${lead.name}
- Industry: ${lead.industry || "unknown"}
- Needs: ${lead.needs || "not specified"}
- Website/Bio: ${lead.website || "none"}

Criteria:
- Need match: do they need design/web/branding services?
- Budget potential: typical budget in this industry?
- Info completeness: enough to start outreach?

Rate as "high" (pursue now), "medium" (worth following up), or "low" (park for later).
One sentence reason.

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
  const prompt = `Parse natural language into a work task.

Known clients: ${clientNames.length ? clientNames.join(", ") : "none"}
Priorities: High, Medium, Low (default: Medium)
Language: ${lang === "zh" ? "Chinese" : "English"}

Rules:
- Title: concise, action-oriented (${lang === "zh" ? "用中文" : "in English"})
- Client: match from known list if mentioned, otherwise empty string
- Priority: detect from text (高/urgent/important → High, 低/low → Low)
- Column: always "todo"

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
  const prompt = lang === "zh"
    ? `你是一个效率助手。用户描述一个任务或目标，你把它拆解成5-8个小步骤。

拆解原则：
- 每步5-30分钟可完成
- 按执行顺序排列
- 动词开头，具体可执行（如"打电话给..."而不是"联系相关方"）
- 目标是让每步都小到不会拖延

返回JSON（不要markdown）：
{"title":"简洁的任务名","steps":["步骤1","步骤2",...]}`
    : `You are a productivity assistant. Break down the user's task into 5-8 small steps.

Principles:
- Each step takes 5-30 minutes
- In execution order
- Start with a verb, be specific (e.g., "Call the..." not "Contact relevant parties")
- Goal: each step should feel small enough to start immediately

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
