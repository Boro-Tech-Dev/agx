-- Phase 05 hardening additions
CREATE INDEX IF NOT EXISTS idx_runs_status_created ON agent_runs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_artifacts_run ON artifacts(run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status, created_at DESC);
