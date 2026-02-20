
-- 1. Add campaign_id column to target_queue
ALTER TABLE public.target_queue 
ADD COLUMN campaign_id uuid REFERENCES public.targeting_campaigns(id) ON DELETE SET NULL;

-- 2. Create mark_targets_done RPC
CREATE OR REPLACE FUNCTION public.mark_targets_done(p_ig_account_id uuid, p_target_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM ig_accounts WHERE id = p_ig_account_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  -- Mark targets as done
  UPDATE target_queue
  SET status = 'done', processed_at = now()
  WHERE id = ANY(p_target_ids)
    AND ig_account_id = p_ig_account_id
    AND status IN ('pending', 'injected', 'processing');

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Update queue_processed on ig_accounts
  UPDATE ig_accounts SET
    queue_processed = (SELECT count(*) FROM target_queue WHERE ig_account_id = p_ig_account_id AND status = 'done'),
    updated_at = now()
  WHERE id = p_ig_account_id;

  RETURN v_count;
END;
$$;

-- 3. Create fetch_next_targets RPC
CREATE OR REPLACE FUNCTION public.fetch_next_targets(p_ig_account_id uuid, p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  username text,
  source text,
  priority integer,
  campaign_id uuid,
  campaign_name text,
  campaign_niche text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
    SELECT 
      t.id,
      t.username,
      t.source,
      t.priority,
      t.campaign_id,
      c.name AS campaign_name,
      c.niche AS campaign_niche
    FROM target_queue t
    LEFT JOIN targeting_campaigns c ON c.id = t.campaign_id
    WHERE t.ig_account_id = p_ig_account_id
      AND t.status IN ('pending', 'injected')
    ORDER BY t.priority DESC, t.created_at ASC
    LIMIT p_limit;
END;
$$;

-- 4. Update add_targets_batch to accept campaign_id
CREATE OR REPLACE FUNCTION public.add_targets_batch(
  p_ig_account_id uuid, 
  p_usernames text[], 
  p_source text DEFAULT 'manual',
  p_campaign_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_count integer := 0;
  v_username text;
BEGIN
  SELECT user_id INTO v_user_id FROM ig_accounts WHERE id = p_ig_account_id;
  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  FOREACH v_username IN ARRAY p_usernames LOOP
    IF NOT EXISTS (
      SELECT 1 FROM target_queue
      WHERE ig_account_id = p_ig_account_id
        AND username = v_username
        AND status IN ('pending', 'injected', 'processing')
    ) THEN
      INSERT INTO target_queue (ig_account_id, username, source, status, campaign_id)
      VALUES (p_ig_account_id, v_username, p_source, 'pending', p_campaign_id);
      v_count := v_count + 1;
    END IF;
  END LOOP;

  UPDATE ig_accounts SET
    queue_total = (SELECT count(*) FROM target_queue WHERE ig_account_id = p_ig_account_id AND status IN ('pending', 'injected')),
    updated_at = now()
  WHERE id = p_ig_account_id;

  RETURN v_count;
END;
$$;
