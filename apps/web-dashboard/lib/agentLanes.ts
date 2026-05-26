/**
 * Agent capability lanes — mirrors config/agent_lanes.json and worker/agent_lanes.py.
 */

export type AgentLaneId = 'tool_capable' | 'prefetch_only' | 'reasoning_no_tools';

export type AgentLaneMeta = {
  label: string;
  description: string;
};

export const LANE_META: Record<AgentLaneId, AgentLaneMeta> = {
  tool_capable: {
    label: 'Tool-capable',
    description:
      'Larger local model with an autonomous tool loop (web search, URL read, repo tools). Output is still strict JSON after a formatting pass.',
  },
  prefetch_only: {
    label: 'Pre-fetch only',
    description:
      'Compact model. Tools run in the worker before the model call; the model does not invoke tools itself.',
  },
  reasoning_no_tools: {
    label: 'Reasoning (no tools)',
    description:
      'Reasoning-oriented model without tool calling. Optional pre-fetch web search per run.',
  },
};

export type AgentKey =
  | 'pm'
  | 'builder'
  | 'forge'
  | 'canon'
  | 'synergy'
  | 'clinic'
  | 'kitt'
  | 'bubs'
  | 'eddie';

export type AgentLaneRow = {
  agent_key: AgentKey;
  lane: AgentLaneId;
  lane_label: string;
  lane_description: string;
  default_model?: string;
  tool_model?: string;
  tool_allowlist?: string[];
  default_web_search?: boolean;
  default_use_tools?: boolean;
};

const AGENT_LANE_ROWS: Record<AgentKey, Omit<AgentLaneRow, 'agent_key' | 'lane_label' | 'lane_description'>> = {
  pm: {
    lane: 'tool_capable',
    default_model: 'llama3.1:8b',
    tool_model: 'llama3.1:8b',
    tool_allowlist: ['searxng_web_search', 'web_url_read', 'web_extract'],
    default_web_search: false,
    default_use_tools: false,
  },
  builder: {
    lane: 'tool_capable',
    default_model: 'qwen2.5:7b',
    tool_model: 'qwen2.5:7b',
    tool_allowlist: [
      'searxng_web_search',
      'web_url_read',
      'web_extract',
      'repo_search',
      'repo_read',
      'repo_summarize',
    ],
    default_web_search: false,
    default_use_tools: false,
  },
  forge: {
    lane: 'tool_capable',
    default_model: 'llama3.2:3b',
    tool_model: 'llama3.2:3b',
    tool_allowlist: ['searxng_web_search', 'web_url_read', 'web_extract'],
    default_web_search: true,
    default_use_tools: false,
  },
  canon: {
    lane: 'tool_capable',
    default_model: 'llama3.2:3b',
    tool_model: 'llama3.2:3b',
    tool_allowlist: ['searxng_web_search', 'web_url_read', 'web_extract'],
    default_web_search: true,
    default_use_tools: false,
  },
  synergy: { lane: 'prefetch_only', default_model: 'llama3.2:3b', default_web_search: false, default_use_tools: false },
  clinic: { lane: 'prefetch_only', default_model: 'llama3.2:3b', default_web_search: false, default_use_tools: false },
  kitt: { lane: 'prefetch_only', default_model: 'gemma3:270m', default_web_search: false, default_use_tools: false },
  bubs: { lane: 'prefetch_only', default_model: 'tinyllama:1.1b', default_web_search: false, default_use_tools: false },
  eddie: {
    lane: 'reasoning_no_tools',
    default_model: 'deepseek-r1:1.5b',
    default_web_search: false,
    default_use_tools: false,
  },
};

export function agentLaneRow(agentKey: string): AgentLaneRow | null {
  const k = agentKey as AgentKey;
  const row = AGENT_LANE_ROWS[k];
  if (!row) return null;
  const meta = LANE_META[row.lane];
  return {
    agent_key: k,
    lane: row.lane,
    lane_label: meta.label,
    lane_description: meta.description,
    ...row,
  };
}

export function laneBadgeClasses(lane: AgentLaneId): string {
  switch (lane) {
    case 'tool_capable':
      return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100';
    case 'prefetch_only':
      return 'bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-100';
    case 'reasoning_no_tools':
      return 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100';
  }
}

/** Tools autonomous agents can call vs operator-only dashboard tools. */
export function toolReachabilityPill(toolId: string): 'agent' | 'operator' | 'both' {
  if (toolId === 'web_search') return 'both';
  if (toolId === 'web_capture') return 'operator';
  return 'operator';
}
