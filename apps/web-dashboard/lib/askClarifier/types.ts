export type AskClarifierMode = 'intake' | 'feedback' | 'timeline' | 'scope' | 'handoff';

export type AskClarifierTone = 'direct' | 'diplomatic' | 'internal' | 'client_ready';

export type ClarifierQuestion = {
  question: string;
  why_it_matters: string;
  risk_if_unanswered: string;
  suggested_owner?: string;
  category: string;
  priority: 'critical' | 'important' | 'nice_to_have';
};

export type ClarifierAssumption = {
  assumption: string;
  confidence: 'low' | 'medium' | 'high';
  confirm_with?: string;
};

export type ClarifierRisk = {
  risk: string;
  severity: 'low' | 'medium' | 'high';
  mitigation: string;
};

export type AskClarifierResult = {
  request_type: string;
  clarity_score: number;
  overall_readiness: 'ready_to_assign' | 'needs_clarification' | 'high_risk';
  summary: string;
  clarifying_questions: ClarifierQuestion[];
  assumptions_to_validate: ClarifierAssumption[];
  risks: ClarifierRisk[];
  recommended_next_step: string;
  suggested_reply: string;
  internal_handoff_note: string;
  missing_inputs: string[];
  model_used?: string | null;
  error?: string | null;
  parse_failed?: boolean;
  grammar_failure_fallback_used?: boolean;
};

export type AskClarifierRequest = {
  request_text: string;
  mode?: AskClarifierMode;
  tone?: AskClarifierTone;
  project_context?: string;
  known_scope?: string;
  known_timeline?: string;
};
