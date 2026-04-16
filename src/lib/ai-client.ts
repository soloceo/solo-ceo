/**
 * Unified AI client — expense parsing, task creation, lead analysis, outreach.
 * Supports Gemini, Claude, and OpenAI.
 */

import { todayDateKey } from "./date-utils";

export type AIProvider = "gemini" | "claude" | "openai" | "ollama" | "lmstudio";

export const AI_KEY_MAP: Record<string, string> = {
  gemini: "gemini_api_key",
  claude: "claude_api_key",
  openai: "openai_api_key",
};

/**
 * Default model IDs per cloud provider.
 * Centralized so upgrades only need to change one line instead of hunting
 * through callJSON / callText / streamChat / testApiKey.
 *
 * ── Claude Opus 4.7 notes ──────────────────────────────────────────
 * - Sampling parameters (temperature, top_p, top_k) are REMOVED on 4.7 and
 *   return a 400 if sent. All Claude request bodies below omit them.
 * - Adaptive thinking (`thinking: {type: "adaptive"}`) replaces the old
 *   `budget_tokens` API — the model decides when and how much to think.
 *   Enabled on text/chat paths where quality matters; omitted on JSON
 *   extraction paths where deterministic fast output matters more.
 * - `output_config.effort` ("low" | "medium" | "high" | "max") tunes the
 *   cost/quality tradeoff. We use "medium" for short text, "high" for chat.
 * - Response parsers look up the text block by `.type === "text"` instead
 *   of `content[0]` so adaptive thinking blocks (present but empty text on
 *   4.7 by default) are transparently skipped.
 */
export const MODEL_IDS = {
  claude: "claude-opus-4-7",
  openai: "gpt-4.1-mini",
  gemini: "gemini-2.5-flash",
} as const;

/** Extract the text string from a Claude `messages` response content array.
 *  Safe across 4.7 adaptive thinking (which adds `thinking` blocks that sit
 *  next to the text block) — we find the first `text` block explicitly. */
function claudeText(content: Array<{ type: string; text?: string }> | undefined): string {
  if (!Array.isArray(content)) return "";
  const block = content.find((b) => b?.type === "text");
  return block?.text || "";
}

// ── Device-level AI provider (localStorage) ──────────────────

const LS_PROVIDER = "solo_ai_provider";
const LS_OLLAMA_URL = "solo_ollama_url";
const LS_OLLAMA_MODEL = "solo_ollama_model";
const LS_LMSTUDIO_URL = "solo_lmstudio_url";
const LS_LMSTUDIO_MODEL = "solo_lmstudio_model";

export function getDeviceAIProvider(): AIProvider | "" {
  const val = localStorage.getItem(LS_PROVIDER);
  if (!val || val === "off") return "";
  return val as AIProvider;
}
export function setDeviceAIProvider(p: AIProvider | ""): void {
  // Store "off" explicitly so getAIConfig won't fall back to cloud settings
  try { localStorage.setItem(LS_PROVIDER, p || "off"); } catch { /* quota exceeded */ }
}
export function getOllamaConfig(): { url: string; model: string } {
  return {
    url: localStorage.getItem(LS_OLLAMA_URL) || "http://localhost:11434",
    model: localStorage.getItem(LS_OLLAMA_MODEL) || "gemma4",
  };
}
export function setOllamaConfig(url: string, model: string): void {
  try { localStorage.setItem(LS_OLLAMA_URL, url); } catch { /* quota exceeded */ }
  try { localStorage.setItem(LS_OLLAMA_MODEL, model); } catch { /* quota exceeded */ }
}
export function getLMStudioConfig(): { url: string; model: string } {
  return {
    url: localStorage.getItem(LS_LMSTUDIO_URL) || "http://localhost:1234",
    model: localStorage.getItem(LS_LMSTUDIO_MODEL) || "",
  };
}
export function setLMStudioConfig(url: string, model: string): void {
  try { localStorage.setItem(LS_LMSTUDIO_URL, url); } catch { /* quota exceeded */ }
  try { localStorage.setItem(LS_LMSTUDIO_MODEL, model); } catch { /* quota exceeded */ }
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
  if (provider === "ollama" || provider === "lmstudio") return { provider, apiKey: "" };
  const keyName = AI_KEY_MAP[provider];
  const apiKey = keyName ? (settings?.[keyName] || "") : "";
  if (!apiKey) return null;
  return { provider, apiKey };
}

/* ── Local-model helpers ──────────────────────────────────
 * Reasoning models served via Ollama/LM Studio (DeepSeek-R1, QwQ, Qwen3,
 * some Gemma variants) emit <think>…</think> blocks inline in content
 * even when think:false is sent. Cloud providers handle this structurally:
 * Claude via `thinking_delta` events, Gemini via `part.thought`. Local
 * models leak the raw tags into the UI — we strip them here. */

/** Strip <think>…</think> blocks from a complete string (non-streaming). */
function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

/** Streaming <think>…</think> filter — handles tag boundaries that span
 *  chunks. Call `.process(chunk)` on each delta; emits only non-thinking
 *  text. Call `.flush()` when the stream ends to drain any held buffer. */
class ThinkFilter {
  private inside = false;
  private held = ""; // tail that might be a partial tag
  private static readonly OPEN = "<think>";
  private static readonly CLOSE = "</think>";

  process(chunk: string): string {
    const text = this.held + chunk;
    this.held = "";
    let out = "";
    let i = 0;
    const len = text.length;

    while (i < len) {
      if (this.inside) {
        const end = text.indexOf(ThinkFilter.CLOSE, i);
        if (end === -1) {
          // Hold up to (CLOSE.length - 1) tail chars in case a partial `</think` spans the next chunk
          this.held = text.slice(Math.max(i, len - ThinkFilter.CLOSE.length + 1));
          return out;
        }
        this.inside = false;
        i = end + ThinkFilter.CLOSE.length;
      } else {
        const start = text.indexOf(ThinkFilter.OPEN, i);
        if (start === -1) {
          // Hold up to (OPEN.length - 1) tail chars for partial `<think`
          const safe = Math.max(i, len - ThinkFilter.OPEN.length + 1);
          out += text.slice(i, safe);
          this.held = text.slice(safe);
          return out;
        }
        out += text.slice(i, start);
        this.inside = true;
        i = start + ThinkFilter.OPEN.length;
      }
    }
    return out;
  }

  /** Drain any held tail at stream end. If we're still inside a think block
   *  (malformed stream — no closing tag), drop it. Otherwise emit the tail. */
  flush(): string {
    const out = this.inside ? "" : this.held;
    this.held = "";
    this.inside = false;
    return out;
  }
}

/** Normalize a local-server error into a message users can act on. */
async function localError(res: Response, serverLabel: string, url: string, model: string): Promise<Error> {
  let detail = "";
  try {
    const body = await res.json();
    detail = (body?.error || body?.message || "").toString();
  } catch { /* non-JSON response */ }

  if (res.status === 404) {
    return new Error(`${serverLabel}: model "${model}" not found. Open Settings → AI and pick a model that's installed.`);
  }
  if (res.status === 0 || res.status >= 500) {
    return new Error(`${serverLabel} error ${res.status}${detail ? ` — ${detail}` : ""}. The local server may have crashed or run out of memory.`);
  }
  return new Error(`${serverLabel} error ${res.status}${detail ? ` — ${detail}` : ` at ${url}`}`);
}

/** Wrap a fetch that targets a local model server with a clear connection error. */
async function localFetch(url: string, init: RequestInit, serverLabel: string): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    // Browser fetch throws a TypeError for network failures, CORS blocks, and refused connections alike.
    // Surface a single actionable message that covers the three common causes.
    const hint = serverLabel === "Ollama"
      ? `Cannot reach Ollama at ${url.split("/api/")[0]}. Start it with \`ollama serve\` and set \`OLLAMA_ORIGINS=*\` so the browser can connect.`
      : `Cannot reach LM Studio at ${url.split("/v1/")[0]}. Make sure the local server is running and CORS is allowed.`;
    throw new Error(hint + (e instanceof Error && e.message ? ` (${e.message})` : ""));
  }
}

/* ── Low-level API callers ──────────────────────────────── */

/** Safely extract JSON from AI output (handles markdown fences, leading text,
 *  and <think>…</think> reasoning blocks from local models). */
function extractJSON(text: string): any {
  // Strip reasoning blocks first — otherwise the `{...}` fallback below can
  // greedily match across thinking text that happens to contain braces.
  const cleaned = stripThinkTags(text);
  // Try direct parse first
  try { return JSON.parse(cleaned); } catch {}
  // Strip markdown fences
  const stripped = cleaned.replace(/```json\n?|\n?```/g, "").trim();
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
    const endpoint = `${url}/api/chat`;
    const res = await localFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userText }],
        format: "json",
        stream: false,
        think: false,                     // suppress thinking on models that honor it
        keep_alive: "30m",                // keep model resident between quick calls
        options: {
          temperature: 0,
          num_ctx: 8192,                  // default is 2048 — too small for system+user prompts
        },
      }),
    }, "Ollama");
    if (!res.ok) throw await localError(res, "Ollama", endpoint, model);
    const data = await res.json();
    const text = data.message?.content;
    if (!text) throw new Error("Empty Ollama response (model may have returned only thinking tokens)");
    return extractJSON(text); // extractJSON strips <think> tags before parsing
  }

  if (provider === "lmstudio") {
    const { url, model } = getLMStudioConfig();
    const endpoint = `${url}/v1/chat/completions`;
    const res = await localFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userText }],
        temperature: 0,
        stream: false,
      }),
    }, "LM Studio");
    if (!res.ok) throw await localError(res, "LM Studio", endpoint, model);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("Empty LM Studio response");
    return extractJSON(text);
  }

  if (provider === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_IDS.gemini}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userText }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
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
    // Opus 4.7: temperature removed (would 400); no thinking — JSON extraction
    // benefits from fast deterministic output, not reasoning. Effort "low"
    // keeps preamble/output terse — this is structured extraction.
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: MODEL_IDS.claude,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userText }],
        output_config: { effort: "low" },
      }),
    });
    if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
    const data = await res.json();
    const text = claudeText(data.content);
    if (!text) throw new Error("Empty Claude response");
    return extractJSON(text);
  }

  // OpenAI
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL_IDS.openai,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userText }],
      max_tokens: 512,
      temperature: 0,
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
    const endpoint = `${url}/api/chat`;
    const res = await localFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userText }],
        stream: false,
        think: false,
        keep_alive: "30m",
        options: { num_ctx: 8192 },
      }),
    }, "Ollama");
    if (!res.ok) throw await localError(res, "Ollama", endpoint, model);
    const data = await res.json();
    return stripThinkTags(data.message?.content || "");
  }

  if (provider === "lmstudio") {
    const { url, model } = getLMStudioConfig();
    const endpoint = `${url}/v1/chat/completions`;
    const res = await localFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userText }],
        temperature: 0.2,
        stream: false,
      }),
    }, "LM Studio");
    if (!res.ok) throw await localError(res, "LM Studio", endpoint, model);
    const data = await res.json();
    return stripThinkTags(data.choices?.[0]?.message?.content || "");
  }

  if (provider === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_IDS.gemini}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userText }] }],
          generationConfig: { responseMimeType: "text/plain", temperature: 0.2 },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  if (provider === "claude") {
    // Opus 4.7: temperature removed. Adaptive thinking helps email/content
    // writing quality; effort "medium" is a reasonable cost/quality point
    // for short-text generation (outreach emails, etc.).
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: MODEL_IDS.claude,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userText }],
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
      }),
    });
    if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
    const data = await res.json();
    return claudeText(data.content);
  }

  // OpenAI
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL_IDS.openai,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userText }],
      max_tokens: 1024,
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

/* ── Streaming chat ──────────────────────────────── */

/** Attachment (image/file) embedded in a chat message */
export interface ChatAttachment {
  /** MIME type, e.g. "image/png", "image/jpeg", "application/pdf" */
  mimeType: string;
  /** Base64-encoded data (no data-URL prefix) */
  base64: string;
  /** Original filename for display */
  fileName: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  /** Optional image/file attachments (only for user messages) */
  attachments?: ChatAttachment[];
}

export interface NativeToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface StreamResult {
  text: string;
  truncated: boolean;
  toolCalls?: NativeToolCall[];
}

/** Tool definition for native function calling (Ollama OpenAI-compatible format) */
export interface NativeToolDef {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

/**
 * Stream a chat completion. Calls `onChunk` with each text delta.
 * Returns the full accumulated text and whether it was truncated.
 * Optionally passes native tool definitions for models that support function calling.
 */
export async function streamChat(
  provider: AIProvider,
  apiKey: string,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  nativeTools?: NativeToolDef[],
): Promise<StreamResult> {
  // Build request based on provider
  let url: string;
  let headers: Record<string, string>;
  let body: string;

  // Helper: build Ollama messages with image support
  const buildOllamaMessages = (msgs: ChatMessage[]) =>
    msgs.map(m => {
      const images = m.attachments?.filter(a => a.mimeType.startsWith("image/")).map(a => a.base64);
      return images && images.length > 0
        ? { role: m.role, content: m.content, images }
        : { role: m.role, content: m.content };
    });

  // Helper: build OpenAI messages with vision support
  const buildOpenAIMessages = (msgs: ChatMessage[]) =>
    msgs.map(m => {
      if (!m.attachments?.length) return { role: m.role, content: m.content };
      const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
      if (m.content) parts.push({ type: "text", text: m.content });
      for (const a of m.attachments) {
        if (a.mimeType.startsWith("image/")) {
          parts.push({ type: "image_url", image_url: { url: `data:${a.mimeType};base64,${a.base64}` } });
        }
      }
      return { role: m.role, content: parts.length ? parts : m.content };
    });

  // Helper: build Claude messages with image support
  const buildClaudeMessages = (msgs: ChatMessage[]) =>
    msgs.filter(m => m.role !== "system").map(m => {
      if (!m.attachments?.length) return { role: m.role, content: m.content };
      const content: Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }> = [];
      for (const a of m.attachments) {
        if (a.mimeType.startsWith("image/")) {
          content.push({ type: "image", source: { type: "base64", media_type: a.mimeType, data: a.base64 } });
        }
      }
      if (m.content) content.push({ type: "text", text: m.content });
      return { role: m.role, content };
    });

  // Helper: build Gemini messages with image support
  const buildGeminiMessages = (msgs: ChatMessage[]) =>
    msgs.filter(m => m.role !== "system").map(m => {
      const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [];
      if (m.attachments?.length) {
        for (const a of m.attachments) {
          if (a.mimeType.startsWith("image/")) {
            parts.push({ inline_data: { mime_type: a.mimeType, data: a.base64 } });
          }
        }
      }
      if (m.content) parts.push({ text: m.content });
      return { role: m.role === "assistant" ? "model" : "user", parts };
    });

  if (provider === "ollama") {
    const cfg = getOllamaConfig();
    url = `${cfg.url}/api/chat`;
    headers = { "Content-Type": "application/json" };
    const reqBody: Record<string, unknown> = {
      model: cfg.model,
      messages: buildOllamaMessages(messages),
      stream: true,
      think: false,                       // suppress structured thinking on models that honor it
      keep_alive: "30m",                  // keep model resident — avoids 30–60s cold starts between chats
      options: {
        temperature: 0.2,
        num_ctx: 8192,                    // default 2048 silently truncates system+history+user
      },
    };
    // Pass native tools for function calling (supported by gemma, qwen, llama3.1, etc.)
    if (nativeTools && nativeTools.length > 0) {
      (reqBody.options as Record<string, unknown>).temperature = 0;
      reqBody.tools = nativeTools.map(t => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    }
    body = JSON.stringify(reqBody);
  } else if (provider === "lmstudio") {
    const cfg = getLMStudioConfig();
    url = `${cfg.url}/v1/chat/completions`;
    headers = { "Content-Type": "application/json" };
    const reqBody: Record<string, unknown> = {
      model: cfg.model,
      messages: buildOpenAIMessages(messages),
      stream: true,
      temperature: 0.2,
      max_tokens: 16384,
    };
    // Pass native tools for function calling (LM Studio supports OpenAI tools format)
    if (nativeTools && nativeTools.length > 0) {
      reqBody.temperature = 0;
      reqBody.tools = nativeTools.map(t => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
      reqBody.tool_choice = "auto";
    }
    body = JSON.stringify(reqBody);
  } else if (provider === "openai") {
    url = "https://api.openai.com/v1/chat/completions";
    headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
    body = JSON.stringify({ model: MODEL_IDS.openai, messages: buildOpenAIMessages(messages), stream: true, max_tokens: 16384 });
  } else if (provider === "claude") {
    // Opus 4.7: temperature removed. Adaptive thinking + effort "high" gives
    // the chat surface the quality users expect from the flagship model;
    // thinking_delta events are filtered out below so reasoning stays
    // invisible (Opus 4.7 ships empty thinking text by default anyway).
    url = "https://api.anthropic.com/v1/messages";
    headers = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    };
    const sysMsg = messages.find(m => m.role === "system")?.content || "";
    body = JSON.stringify({
      model: MODEL_IDS.claude,
      max_tokens: 16384,
      system: sysMsg,
      messages: buildClaudeMessages(messages),
      stream: true,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
    });
  } else if (provider === "gemini") {
    const sysMsg = messages.find(m => m.role === "system")?.content || "";
    url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_IDS.gemini}:streamGenerateContent?alt=sse`;
    headers = { "Content-Type": "application/json", "x-goog-api-key": apiKey };
    body = JSON.stringify({
      system_instruction: { parts: [{ text: sysMsg }] },
      contents: buildGeminiMessages(messages),
      generationConfig: { maxOutputTokens: 65536 },
    });
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  // For local providers we need to handle `fetch` network errors specially
  // (server-not-running / CORS / refused connection all throw TypeError).
  const isLocal = provider === "ollama" || provider === "lmstudio";
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers, body, signal });
  } catch (e) {
    if (isLocal) {
      const base = url.split(provider === "ollama" ? "/api/" : "/v1/")[0];
      const hint = provider === "ollama"
        ? `Cannot reach Ollama at ${base}. Start it with \`ollama serve\` and set \`OLLAMA_ORIGINS=*\` so the browser can connect.`
        : `Cannot reach LM Studio at ${base}. Make sure the local server is running and CORS is allowed.`;
      throw new Error(hint + (e instanceof Error && e.message ? ` (${e.message})` : ""));
    }
    throw e;
  }
  if (!res.ok) {
    if (isLocal) {
      const serverLabel = provider === "ollama" ? "Ollama" : "LM Studio";
      const model = provider === "ollama" ? getOllamaConfig().model : getLMStudioConfig().model;
      throw await localError(res, serverLabel, url, model);
    }
    throw new Error(`AI error: ${res.status}`);
  }
  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";
  let truncated = false;
  const parsedToolCalls: NativeToolCall[] = [];

  // <think>…</think> filter — only for local models (cloud providers handle
  // reasoning structurally via thinking_delta / part.thought / etc.)
  const thinkFilter = isLocal ? new ThinkFilter() : null;

  /** Emit a text delta to `onChunk` and accumulate into `full`, transparently
   *  stripping <think>…</think> blocks for local providers. */
  const emit = (chunk: string) => {
    if (!chunk) return;
    const out = thinkFilter ? thinkFilter.process(chunk) : chunk;
    if (out) {
      full += out;
      onChunk(out);
    }
  };

  // Helper to parse native tool calls from Ollama response
  const parseOllamaToolCalls = (toolCalls: unknown[]) => {
    for (const tc of toolCalls as Array<{ function?: { name?: string; arguments?: unknown } }>) {
      if (tc.function?.name) {
        const args = tc.function.arguments;
        let parsed: Record<string, unknown> = {};
        try {
          parsed = typeof args === "string" ? JSON.parse(args) : (args as Record<string, unknown> ?? {});
        } catch { /* malformed args — use empty */ }
        parsedToolCalls.push({ name: tc.function.name, args: parsed });
      }
    }
  };

  if (provider === "ollama") {
    // ── Ollama native format: JSON lines (not SSE) ──
    const handleOllamaLine = (json: Record<string, unknown>) => {
      // Text content — routed through emit() which strips <think>…</think>
      const msg = json.message as Record<string, unknown> | undefined;
      if (typeof msg?.content === "string") emit(msg.content);
      // Native tool calls (arguments already parsed as object in native API)
      if (Array.isArray(msg?.tool_calls)) parseOllamaToolCalls(msg.tool_calls);
      // Final chunk carries the stop reason — Ollama sets done_reason: "length"
      // when the response was cut off at the model's context or output limit.
      if (json.done === true && json.done_reason === "length") truncated = true;
    };
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try { handleOllamaLine(JSON.parse(trimmed)); } catch { /* skip unparseable */ }
        }
      }
      // Flush remaining buffer
      if (buffer.trim()) {
        try { handleOllamaLine(JSON.parse(buffer.trim())); } catch { /* skip */ }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return { text: full, truncated: true };
      throw err;
    } finally {
      reader.releaseLock();
    }
  } else {
    // ── SSE format (OpenAI, Claude, Gemini) ──
    const toolCallsAccum: Array<{ name: string; args: string }> = [];

    const parseLine = (trimmed: string) => {
      if (!trimmed || trimmed === "data: [DONE]") return;
      if (trimmed.startsWith("event:")) return;
      if (!trimmed.startsWith("data: ")) return;
      try {
        const json = JSON.parse(trimmed.slice(6));
        // OpenAI / LM Studio format
        const finish = json.choices?.[0]?.finish_reason;
        if (finish === "length") truncated = true;
        const delta = json.choices?.[0]?.delta;
        if (delta?.content) { emit(delta.content); return; }
        // OpenAI native tool calls (streamed in delta.tool_calls)
        if (Array.isArray(delta?.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCallsAccum[idx]) toolCallsAccum[idx] = { name: '', args: '' };
            if (tc.function?.name) toolCallsAccum[idx].name = tc.function.name;
            if (tc.function?.arguments) toolCallsAccum[idx].args += tc.function.arguments;
          }
          return;
        }
        // Claude format
        if (json.type === "content_block_delta") {
          const text = json.delta?.text;
          if (text) { emit(text); return; }
        }
        if (json.type === "message_delta" && json.delta?.stop_reason === "max_tokens") truncated = true;
        // Gemini format
        const geminiFinish = json.candidates?.[0]?.finishReason;
        if (geminiFinish === "MAX_TOKENS") truncated = true;
        // Skip thinking parts (Gemini 2.5 Flash sends { thought: true, text: "..." })
        const geminiParts = json.candidates?.[0]?.content?.parts as Array<{ text?: string; thought?: boolean }> | undefined;
        if (geminiParts) {
          for (const part of geminiParts) {
            if (part.thought) continue; // skip thinking/reasoning tokens
            if (part.text) emit(part.text);
          }
          return;
        }
      } catch { /* skip unparseable lines */ }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) parseLine(line.trim());
      }
      if (buffer.trim()) parseLine(buffer.trim());
    } catch (err) {
      if ((err as Error).name === "AbortError") return { text: full, truncated: true };
      throw err;
    } finally {
      reader.releaseLock();
    }

    // Parse accumulated SSE tool calls
    for (const tc of toolCallsAccum) {
      if (!tc.name) continue;
      try {
        parsedToolCalls.push({ name: tc.name, args: tc.args ? JSON.parse(tc.args) : {} });
      } catch {
        parsedToolCalls.push({ name: tc.name, args: {} });
      }
    }
  }

  // Drain any tail held by the <think> filter (partial tag at stream end).
  // If we're still inside a think block with no closing tag, flush() drops it.
  if (thinkFilter) {
    const tail = thinkFilter.flush();
    if (tail) {
      full += tail;
      onChunk(tail);
    }
  }

  return { text: full, truncated, toolCalls: parsedToolCalls.length > 0 ? parsedToolCalls : undefined };
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

export async function fetchLMStudioModels(url: string): Promise<string[]> {
  try {
    const res = await fetch(`${url}/v1/models`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map((m: { id: string }) => m.id);
  } catch { return []; }
}

export async function testApiKey(provider: AIProvider, apiKey: string): Promise<boolean> {
  try {
    if (provider === "ollama") {
      const { url } = getOllamaConfig();
      const models = await fetchOllamaModels(url);
      return models.length > 0;
    }
    if (provider === "lmstudio") {
      const { url } = getLMStudioConfig();
      const models = await fetchLMStudioModels(url);
      return models.length > 0;
    }
    if (provider === "gemini") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_IDS.gemini}:generateContent`,
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
          model: MODEL_IDS.claude,
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
          model: MODEL_IDS.openai,
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
