import { describe, expect, it } from 'vitest';

import { agentLaneRow, laneBadgeClasses, LANE_META, toolReachabilityPill } from './agentLanes';

describe('agentLanes', () => {
  it('labels tool-capable lane', () => {
    const row = agentLaneRow('forge');
    expect(row?.lane).toBe('tool_capable');
    expect(row?.lane_label).toBe(LANE_META.tool_capable.label);
  });

  it('labels prefetch lane for kitt', () => {
    expect(agentLaneRow('kitt')?.lane).toBe('prefetch_only');
  });

  it('labels reasoning lane for eddie', () => {
    expect(agentLaneRow('eddie')?.lane).toBe('reasoning_no_tools');
  });

  it('badge classes exist for each lane', () => {
    expect(laneBadgeClasses('tool_capable')).toContain('emerald');
    expect(laneBadgeClasses('prefetch_only')).toContain('sky');
    expect(laneBadgeClasses('reasoning_no_tools')).toContain('amber');
  });

  it('web search reachability', () => {
    expect(toolReachabilityPill('web_search')).toBe('both');
    expect(toolReachabilityPill('web_capture')).toBe('operator');
  });
});
