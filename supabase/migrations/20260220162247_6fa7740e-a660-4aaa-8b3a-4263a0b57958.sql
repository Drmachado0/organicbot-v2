
-- Update bot_commands check constraint to allow update_profile_pic
ALTER TABLE public.bot_commands DROP CONSTRAINT IF EXISTS bot_commands_command_check;
ALTER TABLE public.bot_commands ADD CONSTRAINT bot_commands_command_check CHECK (command IN (
  'start', 'stop', 'pause', 'resume',
  'collect_followers', 'collect_following', 'collect_hashtag', 'collect_location', 'collect_via_api',
  'sync_settings', 'set_safety_preset', 'sync_queue',
  'mark_done', 'fetch_targets',
  'update_profile_pic'
));
