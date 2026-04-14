/**
 * AI agent tools — public facade.
 *
 * Every tool (schema, executor, confirm builder, prompt hint, safety class) is
 * declared in `./tools/registry.ts`. This file derives the public API the rest
 * of the app consumes:
 *   - AGENT_TOOLS            — JSON-schema list for native tool-calling (Ollama)
 *   - TOOL_SAFETY            — read/write/destructive classification
 *   - executeTool            — dispatch + per-turn cache wiring
 *   - buildConfirmInfo       — human-readable confirm card
 *   - buildFilteredToolsPrompt / buildToolsPrompt — system-prompt tool section
 *
 * Adding a tool means editing `./tools/registry.ts` only.
 */

import { todayDateKey } from "../lib/date-utils";
import { TOOLS, TOOLS_TYPED, getTool, createToolContext } from "./tools/registry";
import type {
  AgentToolName,
  ToolCall,
  ToolContext,
  ToolResult,
  ToolSafety,
} from "./tools/registry";

export { createToolContext } from "./tools/registry";
export type {
  AgentToolName,
  ToolCall,
  ToolContext,
  ToolResult,
  ToolSafety,
} from "./tools/registry";

/* ── Public types (kept for existing import sites) ────────── */

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

export interface ToolConfirmInfo {
  toolName: string;
  label: string;
  details: string[];
  args: Record<string, unknown>;
}

/* ── Derived exports ──────────────────────────────────────── */

/** JSON-schema list fed to providers that support native tool calling (Ollama). */
export const AGENT_TOOLS: ToolDef[] = Object.entries(TOOLS).map(([name, t]) => ({
  name,
  description: t.schema.description,
  parameters: t.schema.parameters,
}));

/** read = auto-execute; write = requires user confirm; destructive = always confirm. */
export const TOOL_SAFETY: Record<string, ToolSafety> = Object.fromEntries(
  Object.entries(TOOLS).map(([name, t]) => [name, t.safety]),
);

/* ── Execution ────────────────────────────────────────────── */

/**
 * Execute a tool call.
 *
 * @param call The tool call (name + args) from the model.
 * @param ctxOrSymbol Either a ToolContext (with shared cache) or a currency
 *   symbol string. Passing a string creates a fresh one-shot context. For
 *   multi-step agent turns, create a single ToolContext via `createToolContext`
 *   and pass it to every `executeTool` call in the turn — shared cache avoids
 *   re-fetching the same endpoint, and mutations invalidate it automatically.
 */
export async function executeTool(
  call: ToolCall,
  ctxOrSymbol: ToolContext | string = "$",
): Promise<ToolResult> {
  const ctx: ToolContext = typeof ctxOrSymbol === "string"
    ? createToolContext(ctxOrSymbol)
    : ctxOrSymbol;

  const tool = getTool(call.name);
  if (!tool) return { success: false, message: `Unknown tool: ${call.name}` };

  try {
    return await tool.execute(call.args, ctx);
  } catch (err) {
    return { success: false, message: `Error: ${(err as Error).message}` };
  }
}

/* ── Confirm card ─────────────────────────────────────────── */

/** Build the human-readable confirm card shown before write/destructive tools run. */
export function buildConfirmInfo(
  call: ToolCall,
  lang: string,
  currencySymbol = "$",
): ToolConfirmInfo {
  const tool = getTool(call.name);
  const a = call.args;

  if (tool?.confirm) {
    const { label, details } = tool.confirm(a, lang, currencySymbol);
    return { toolName: call.name, label, details, args: a };
  }

  // Default: use the tool's own label + key/value dump of args
  return {
    toolName: call.name,
    label: tool ? tool.labels[lang === "zh" ? "zh" : "en"] : call.name,
    details: Object.entries(a).map(([k, v]) => `${k}: ${v}`),
    args: a,
  };
}

/* ── System-prompt tool section ───────────────────────────── */

function weekdayChar(lang: string): string {
  return lang === "zh"
    ? ["日", "一", "二", "三", "四", "五", "六"][new Date().getDay()]
    : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];
}

function renderPromptSection(
  lang: string,
  toolNames: AgentToolName[],
): string {
  const isZh = lang === "zh";
  const today = todayDateKey();
  const weekday = weekdayChar(lang);

  const descriptions = toolNames
    .map(n => `- ${TOOLS_TYPED[n].prompt[isZh ? "zh" : "en"]}`);

  const examples = toolNames
    .map(n => TOOLS_TYPED[n].example?.[isZh ? "zh" : "en"])
    .filter((e): e is string => Boolean(e))
    .map(e => e.replace(/__TODAY__/g, today)); // substitute today's date into example JSON

  if (descriptions.length === 0) return "";

  if (isZh) {
    const exSection = examples.length > 0 ? `\n### 示例\n\n${examples.join("\n\n")}\n` : "";
    return `
## 可用工具

今天是 ${today}（周${weekday}）。用户提到"明天""下周五""月底"等相对日期时，请根据今天推算出具体 YYYY-MM-DD。

当用户要求你执行操作时，你**必须**返回下面格式的 JSON（不要只用文字描述）：
\`\`\`json
{"tool_call": {"name": "工具名", "args": {参数}}}
\`\`\`
${exSection}
可用工具：
${descriptions.join("\n")}

规则：
- 你是 CEO 的 AI 员工，CEO 下达指令，你主动执行
- 如果指令需要多步操作（先搜索、再创建），你可以连续调用工具，每次回复调用一个
- search_data 和 web_search 会自动执行，结果会反馈给你继续下一步
- **重要：当用户要求执行操作时，你必须返回 JSON，不要只用文字回复**`;
  }

  const exSection = examples.length > 0 ? `\n### Examples\n\n${examples.join("\n\n")}\n` : "";
  return `
## Available Tools

Today is ${today} (${weekday}). When the user mentions relative dates like "tomorrow", "next Friday", "end of month", calculate the exact YYYY-MM-DD from today.

When the user asks you to DO something, you **MUST** return this JSON format (do NOT just describe the action in text):
\`\`\`json
{"tool_call": {"name": "tool_name", "args": {params}}}
\`\`\`
${exSection}
Tools:
${descriptions.join("\n")}

Rules:
- You are the CEO's AI employee. The CEO gives directives, you execute proactively
- If a directive requires multiple steps (search → create), chain tool calls across responses, one per response
- search_data and web_search execute automatically, results feed back for your next step
- **IMPORTANT: When the user asks you to do something, you MUST return JSON — do NOT just describe the action in text**
- **NEVER use other tool formats (<tool_code>, Python function call syntax, XML tags). Only use the JSON format above**`;
}

/** Build the tools section of the system prompt, filtered to `allowedTools`.
 *  If `allowedTools` is null/undefined, all tools are included. */
export function buildFilteredToolsPrompt(
  lang: string,
  allowedTools?: string[] | null,
): string {
  const all = Object.keys(TOOLS) as AgentToolName[];
  if (!allowedTools) return renderPromptSection(lang, all);
  if (allowedTools.length === 0) return ""; // agent explicitly has no tools

  const valid = allowedTools.filter((n): n is AgentToolName => n in TOOLS);
  return renderPromptSection(lang, valid);
}

/** Convenience alias — full tool list. */
export function buildToolsPrompt(lang: string): string {
  return renderPromptSection(lang, Object.keys(TOOLS) as AgentToolName[]);
}
