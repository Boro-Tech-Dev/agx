export type ReplyCoachSituation =
  | 'client_pushback'
  | 'scope_pressure'
  | 'timeline_pressure'
  | 'feedback_response'
  | 'internal_alignment'
  | 'general';

export type ReplyCoachTone = 'diplomatic' | 'firm' | 'warm' | 'executive' | 'internal_direct';
export type ReplyCoachAudience = 'client' | 'internal' | 'vendor' | 'mixed';
export type ReplyCoachRiskLevel = 'low' | 'medium' | 'high';

export type ReplyCoachResult = {
  situation_summary: string;
  recommended_posture: string;
  risk_level: ReplyCoachRiskLevel;
  primary_risk: string;
  reply_strategy: string;
  suggested_reply: string;
  short_reply: string;
  firm_reply: string;
  internal_note: string;
  do_not_say: string[];
  questions_to_ask: string[];
  commitments_to_avoid: string[];
  next_steps: string[];
  model_used?: string | null;
  error?: string | null;
  parse_failed?: boolean;
  grammar_failure_fallback_used?: boolean;
};
