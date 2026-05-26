/**
 * Static reference copy for models that may appear in required-model tiles.
 * Keys match router defaults; lookup falls back by base name (before ':').
 */

export type ModelCatalogEntry = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
};

const ENTRIES: Record<string, ModelCatalogEntry> = {
  'deepseek-r1:1.5b': {
    summary:
      'A compact reasoning-focused chat model that emits explicit chain-of-thought style reasoning—good when you want step-by-step logic without a huge footprint.',
    strengths: ['Strong reasoning-to-size ratio', 'Useful for math-like and structured problems', 'Small enough for frequent local use'],
    weaknesses: ['Still easy to fool on obscure facts', 'Shallower world knowledge than larger chat models', 'Reasoning traces add latency and tokens'],
  },
  'gemma3:270m': {
    summary:
      'An extremely small Google Gemma variant aimed at ultra-low latency and minimal RAM—best for simple classification, routing, or smoke tests—not heavy reasoning.',
    strengths: ['Very fast inference', 'Tiny memory footprint', 'Fine for light classification / formatting'],
    weaknesses: ['Limited reasoning and factual depth', 'Easy quality cliffs on open-ended tasks', 'Not a substitute for larger LLMs on complex work'],
  },
  'llama3.1:8b': {
    summary:
      "Meta's Llama 3.1 instruct at 8B—default for HAL9000 (PM): stronger structured breakdowns and tool loops than 3B, at higher RAM and latency.",
    strengths: ['Solid PM-style synthesis and JSON adherence', 'Good general instruction following', 'Meaningful step up from 3B on complex inputs'],
    weaknesses: ['~6–10 GB loaded RAM typical', 'Slower than 3B on long tool + schema passes', 'Not a substitute for cloud-scale models'],
  },
  'llama3.2:1b': {
    summary:
      "Meta's lightweight Llama 3.2 instruct model—balanced for edge-style deployments: chat, drafting, and general assistant turns where a bigger model isn't justified.",
    strengths: ['Good instruction following for its size', 'Runs comfortably on modest hardware', 'Solid default for broad agent chat'],
    weaknesses: ['Weak on hard coding and deep analysis vs 3B+', 'Can drift or hallucinate on niche topics', 'Limited context vs enterprise models'],
  },
  'llama3.2:3b': {
    summary:
      "Meta's Llama 3.2 instruct at 3B—default for Forge, Canon, Synergy, and Clinic: better quality than 1B while staying relatively light.",
    strengths: ['Good balance of quality and footprint', 'Shared tag across several agents', 'Comfortable on modest Docker hosts'],
    weaknesses: ['Weaker than 8B on dense PM breakdowns', 'Can still struggle on long structured schemas', '~3–4 GB loaded RAM per model'],
  },
  'nomic-embed-text': {
    summary:
      'An open text embedding model used for semantic search and retrieval—not for chat. Turns text into vectors for similarity, RAG, and clustering.',
    strengths: ['Strong open-source retrieval embeddings', 'Predictable for chunk / document matching', 'Common choice for local RAG stacks'],
    weaknesses: ['Not a generative model—cannot answer prompts directly', 'Quality varies by domain vs latest closed embeddings', 'Sensitive to chunking and preprocessing'],
  },
  'qwen2.5:3b': {
    summary:
      "Alibaba's Qwen 2.5 instruct line in a 3B slice—often favored for code snippets, tighter structured output, and math-ish prompts versus similarly sized peers.",
    strengths: ['Solid coding and structured outputs for the size', 'Good multilingual coverage', 'Reasonable tradeoff of quality vs resource use'],
    weaknesses: ['Not on par with 7B+ models for difficult tasks', 'May need careful prompting for edge cases', 'Heavier than 1B router defaults'],
  },
  'qwen2.5:7b': {
    summary:
      "Alibaba's Qwen 2.5 instruct at 7B—default for Bot the Builder: stronger code and structured repo work than 3B.",
    strengths: ['Strong coding and tool-loop behavior for local use', 'Good multilingual coverage', 'Clear upgrade path from 3B Builder'],
    weaknesses: ['~5–8 GB loaded RAM typical', 'Concurrent 8B HAL + 7B Builder needs a large host', 'Slower tool + schema passes'],
  },
  'tinyllama:1.1b': {
    summary:
      'A compact Llama-architecture model built for constrained environments—useful as a minimal assistant when throughput and footprint matter more than peak quality.',
    strengths: ['Very small download and RAM use', 'Quick responses', 'Enough for simple rewriting and short answers'],
    weaknesses: ['Weakest reasoning in this lineup', 'Struggles with multi-step or technical tasks', 'Higher hallucination risk on complex prompts'],
  },
};

/** Base model name before tag (e.g. llama3.2 from llama3.2:1b). */
function baseName(modelId: string): string {
  const i = modelId.indexOf(':');
  return (i === -1 ? modelId : modelId.slice(0, i)).toLowerCase();
}

export function getModelCatalogEntry(modelId: string): ModelCatalogEntry | null {
  const exact = ENTRIES[modelId];
  if (exact) return exact;

  const base = baseName(modelId);
  const matchKey = Object.keys(ENTRIES).find((k) => baseName(k) === base);
  return matchKey ? ENTRIES[matchKey] : null;
}
