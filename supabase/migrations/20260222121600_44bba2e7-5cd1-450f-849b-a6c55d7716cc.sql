
CREATE TABLE saved_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ig_account_id UUID NOT NULL,
  name TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '[]',
  username_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE saved_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own saved_lists" ON saved_lists
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_saved_lists_updated_at
  BEFORE UPDATE ON saved_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
