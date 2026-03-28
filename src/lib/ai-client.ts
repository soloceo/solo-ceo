/**
 * Unified AI client for expense parsing.
 * Supports Gemini, Claude, and OpenAI.
 */

export type AIProvider = "gemini" | "claude" | "openai";

export interface ParsedTx {
  category: string;
  amount: number;
  description: string;
  date: string;
}

const BIZ_CATS = ["收入", "软件支出", "外包支出", "其他支出"];
const PERSONAL_CATS = ["餐饮", "交通", "房租", "娱乐", "个人其他"];

function buildSystemPrompt(tab: "business" | "personal", lang: string): string {
  const cats = tab === "business" ? BIZ_CATS : PERSONAL_CATS;
  const today = new Date().toISOString().slice(0, 10);

  return `You are a bookkeeping assistant. Parse the user's natural language input into a structured transaction.

Available categories: ${JSON.stringify(cats)}
Today's date: ${today}
Language context: ${lang === "zh" ? "Chinese" : "English"}

Rules:
- Pick the most appropriate category from the list above
- Extract the amount as a positive number
- Write a short description
- Use today's date unless the user specifies otherwise
- For business tab: "收入" category means income, others are expenses
- For personal tab: all are expenses

Respond with ONLY a JSON object, no markdown, no explanation:
{"category": "...", "amount": 0, "description": "...", "date": "YYYY-MM-DD"}`;
}

async function callGemini(apiKey: string, systemPrompt: string, userText: string): Promise<ParsedTx> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

async function callClaude(apiKey: string, systemPrompt: string, userText: string): Promise<ParsedTx> {
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
      max_tokens: 256,
      system: systemPrompt,
      messages: [{ role: "user", content: userText }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error("Empty Claude response");
  return JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
}

async function callOpenAI(apiKey: string, systemPrompt: string, userText: string): Promise<ParsedTx> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
      max_tokens: 256,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty OpenAI response");
  return JSON.parse(text);
}

export async function parseExpense(
  text: string,
  tab: "business" | "personal",
  lang: string,
  provider: AIProvider,
  apiKey: string
): Promise<ParsedTx> {
  const systemPrompt = buildSystemPrompt(tab, lang);
  const callers = { gemini: callGemini, claude: callClaude, openai: callOpenAI };
  const result = await callers[provider](apiKey, systemPrompt, text);

  // Validate
  const validCats = tab === "business" ? BIZ_CATS : PERSONAL_CATS;
  if (!validCats.includes(result.category)) result.category = validCats[validCats.length - 1];
  if (!result.amount || result.amount <= 0) throw new Error("Invalid amount");
  if (!result.date) result.date = new Date().toISOString().slice(0, 10);
  if (!result.description) result.description = text;

  return result;
}

export interface TaskBreakdown {
  title: string;
  steps: string[];
}

export async function parseTaskBreakdown(
  text: string,
  lang: string,
  provider: AIProvider,
  apiKey: string
): Promise<TaskBreakdown> {
  const systemPrompt = `You are a productivity assistant. The user describes a task or goal.
Break it down into 5-8 small, concrete, actionable steps in execution order.
Each step should be something that takes 5-30 minutes and is easy to start.
The goal is to reduce procrastination by making each step feel small and doable.
Language: ${lang === "zh" ? "Chinese" : "English"}

Respond with ONLY a JSON object, no markdown:
{"title": "concise task name", "steps": ["step 1", "step 2", ...]}`;

  const callers = { gemini: callGemini, claude: callClaude, openai: callOpenAI };
  const result = await callers[provider](apiKey, systemPrompt, text) as unknown as TaskBreakdown;

  if (!result.title) result.title = text;
  if (!Array.isArray(result.steps) || result.steps.length === 0) {
    throw new Error("AI returned no steps");
  }
  return result;
}

/** Test if an API key is valid by making a minimal request */
export async function testApiKey(provider: AIProvider, apiKey: string): Promise<boolean> {
  try {
    if (provider === "gemini") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
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
