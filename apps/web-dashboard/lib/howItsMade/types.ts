import type { ToolCatalogId } from '../toolCatalog';

export type HowItsMadeAiUsage = {
  usesLlm: boolean;
  summary: string;
  details?: string[];
};

export type HowItsMadeSourceRef = {
  path: string;
  symbol?: string;
  note?: string;
};

export type HowItsMadeRouteRef = {
  method: string;
  path: string;
  handler?: string;
  proxyTarget?: string;
  timeout?: string;
  note?: string;
};

export type HowItsMadeQueueRef = {
  name: string;
  producer?: string;
  consumer?: string;
  usedByTool: boolean;
  note?: string;
};

export type HowItsMadeSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  formulas?: string[];
  routes?: HowItsMadeRouteRef[];
  queues?: HowItsMadeQueueRef[];
  sourceRefs?: HowItsMadeSourceRef[];
  mermaid?: string;
};

export type HowItsMadeDoc = {
  toolId: ToolCatalogId;
  title: string;
  lastVerifiedFromCode: string;
  ai: HowItsMadeAiUsage;
  architectureSummary: string;
  architectureMermaid?: string;
  sections: HowItsMadeSection[];
};
