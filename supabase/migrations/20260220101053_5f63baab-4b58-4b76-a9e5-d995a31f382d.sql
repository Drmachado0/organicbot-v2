UPDATE user_settings 
SET settings_json = settings_json || '{"dashboard_url": "https://organicbot.lovable.app"}'::jsonb
WHERE settings_json IS NOT NULL 
  AND NOT (settings_json ? 'dashboard_url');