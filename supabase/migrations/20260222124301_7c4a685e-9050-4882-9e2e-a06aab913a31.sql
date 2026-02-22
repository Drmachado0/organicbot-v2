
ALTER TABLE public.ig_accounts
  ADD COLUMN IF NOT EXISTS daily_heat integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cooldown_remaining_minutes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cooldown_escalation integer DEFAULT 0;
