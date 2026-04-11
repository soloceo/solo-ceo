/**
 * Custom AI Agent type definitions.
 */

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

/** All tool names available for agent assignment */
export type AgentToolName =
  | 'create_task' | 'update_task' | 'delete_task'
  | 'create_lead' | 'move_lead' | 'update_lead'
  | 'record_transaction' | 'create_client' | 'update_client'
  | 'search_data' | 'web_search'
  | 'create_memo' | 'get_dashboard' | 'analyze_finance' | 'generate_outreach';

export const ALL_TOOL_NAMES: AgentToolName[] = [
  'create_task', 'update_task', 'delete_task',
  'create_lead', 'move_lead', 'update_lead',
  'record_transaction', 'create_client', 'update_client',
  'search_data', 'web_search',
  'create_memo', 'get_dashboard', 'analyze_finance', 'generate_outreach',
];

/** Human-readable tool labels (bilingual) */
export const TOOL_LABELS: Record<AgentToolName, { zh: string; en: string }> = {
  create_task:        { zh: '创建任务',   en: 'Create Task' },
  update_task:        { zh: '更新任务',   en: 'Update Task' },
  delete_task:        { zh: '删除任务',   en: 'Delete Task' },
  create_lead:        { zh: '创建线索',   en: 'Create Lead' },
  move_lead:          { zh: '移动线索',   en: 'Move Lead' },
  update_lead:        { zh: '更新线索',   en: 'Update Lead' },
  record_transaction: { zh: '记录收支',   en: 'Record Transaction' },
  create_client:      { zh: '创建客户',   en: 'Create Client' },
  update_client:      { zh: '更新客户',   en: 'Update Client' },
  search_data:        { zh: '搜索数据',   en: 'Search Data' },
  web_search:         { zh: '网络搜索',   en: 'Web Search' },
  create_memo:        { zh: '创建备忘',   en: 'Create Memo' },
  get_dashboard:      { zh: '经营仪表盘', en: 'Dashboard' },
  analyze_finance:    { zh: '财务分析',   en: 'Finance Analysis' },
  generate_outreach:  { zh: '生成开发信', en: 'Generate Outreach' },
};
