-- Run continuation: parent link and conversation grouping.
-- Safe on existing volumes (CREATE TABLE IF NOT EXISTS does not add new columns to old agent_runs).

ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS parent_run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL;
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS conversation_id UUID;

CREATE INDEX IF NOT EXISTS idx_agent_runs_parent ON agent_runs(parent_run_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_conversation ON agent_runs(conversation_id) WHERE conversation_id IS NOT NULL;

-- Manual one-off for operators who applied 002 before this file existed (same as above; IF NOT EXISTS is idempotent):
-- ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS parent_run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL;
-- ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS conversation_id UUID;
