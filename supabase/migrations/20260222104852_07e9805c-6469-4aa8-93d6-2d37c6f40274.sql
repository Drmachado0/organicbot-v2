ALTER TABLE public.ig_accounts
  ADD COLUMN IF NOT EXISTS organic_timings jsonb
  DEFAULT '{"morning": true, "afternoon": true, "evening": true, "night": false}'::jsonb;