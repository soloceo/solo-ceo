/**
 * Custom AI Agent type definitions.
 *
 * Tool metadata (names, labels, prompts, executors) lives in the central
 * registry at `src/app/tools/registry.ts`. This file derives the handful of
 * constants/types the UI needs and keeps AgentConfig here (it's not tool data).
 */

import { TOOLS } from "../app/tools/registry";
import type { AgentToolName } from "../app/tools/registry";

export type { AgentToolName } from "../app/tools/registry";

export interface AgentConfig {
  id: number;
  name: string;
  avatar: string;               // emoji identifier
  role: string;                 // system role description
  personality: string;          // tone/style instructions
  rules: string;                // behavioral constraints
  tools: string[];              // subset of AGENT_TOOL names
  conversation_starters: string[]; // starter prompt strings
  template_id: string;          // '' = custom
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** All tool names available for agent assignment (derived from registry). */
export const ALL_TOOL_NAMES: AgentToolName[] = Object.keys(TOOLS) as AgentToolName[];

/** Human-readable tool labels (bilingual, derived from registry). */
export const TOOL_LABELS: Record<AgentToolName, { zh: string; en: string }> = Object.fromEntries(
  Object.entries(TOOLS).map(([name, t]) => [name, t.labels]),
) as Record<AgentToolName, { zh: string; en: string }>;
