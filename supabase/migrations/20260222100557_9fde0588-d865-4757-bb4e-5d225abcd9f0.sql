ALTER TABLE public.ig_accounts
  ADD COLUMN IF NOT EXISTS safety_limits jsonb DEFAULT '{"follow_daily": 150, "unfollow_daily": 100, "like_daily": 300}'::jsonb;