-- Personal vs business PM: explicit project discriminator (existing DBs only; greenfield has pm_kind in 002_schema.sql).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'pm_kind'
  ) THEN
    ALTER TABLE projects ADD COLUMN pm_kind text NOT NULL DEFAULT 'business';
    ALTER TABLE projects ADD CONSTRAINT projects_pm_kind_check CHECK (pm_kind IN ('business', 'personal'));
  END IF;
END $$;
