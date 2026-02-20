ALTER TABLE public.bot_commands DROP CONSTRAINT bot_commands_command_check;

ALTER TABLE public.bot_commands ADD CONSTRAINT bot_commands_command_check 
  CHECK (command = ANY (ARRAY[
    'start'::text, 
    'stop'::text, 
    'pause'::text,
    'load_queue'::text, 
    'sync_queue'::text,
    'set_mode'::text, 
    'set_likes'::text, 
    'get_status'::text,
    'sync_settings'::text,
    'set_safety_preset'::text
  ]));