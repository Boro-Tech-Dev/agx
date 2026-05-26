-- Brief template bundles (append-only published versions + mutable draft + active pointer)
BEGIN;

CREATE TABLE IF NOT EXISTS brief_template_bundle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INT NOT NULL,
  skeleton JSONB NOT NULL,
  tactic_overrides JSONB NOT NULL,
  presets JSONB NOT NULL,
  label TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS brief_template_bundle_version_uq ON brief_template_bundle (version);

CREATE TABLE IF NOT EXISTS brief_template_active (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  published_bundle_id UUID REFERENCES brief_template_bundle (id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO brief_template_active (id, published_bundle_id) VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS brief_template_draft (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  skeleton JSONB NOT NULL DEFAULT '{"version":1,"sections":[]}'::jsonb,
  tactic_overrides JSONB NOT NULL DEFAULT '{"version":1,"overrides":{}}'::jsonb,
  presets JSONB NOT NULL DEFAULT '{"version":1,"presets":[]}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO brief_template_draft (id, skeleton, tactic_overrides, presets)
VALUES (1, '{"version":1,"sections":[]}'::jsonb, '{"version":1,"overrides":{}}'::jsonb, '{"version":1,"presets":[]}'::jsonb)
ON CONFLICT (id) DO NOTHING;

COMMIT;
