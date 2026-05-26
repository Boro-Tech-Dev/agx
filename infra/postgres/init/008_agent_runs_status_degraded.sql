-- Allow agent_runs.status = 'degraded' (model/router error but persisted fallback output).
-- Safe to re-run: drops named check if present, then adds expanded check.

ALTER TABLE agent_runs DROP CONSTRAINT IF EXISTS agent_runs_status_check;

ALTER TABLE agent_runs ADD CONSTRAINT agent_runs_status_check CHECK (
  status IN ('queued', 'running', 'needs_approval', 'completed', 'degraded', 'failed', 'cancelled')
);
