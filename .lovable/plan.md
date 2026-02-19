
# Integration: Chrome Extension "Organic Automator 7.2.0"

## What the Extension Does

The extension is a Chrome/Edge Manifest V3 automation tool that runs directly on instagram.com. It already shares the same Supabase project (`ebyruchdswmkuynthiqi`) as this dashboard. The integration is already partially wired: the extension writes to the database and the dashboard reads from it.

### Data Flow (Extension → Supabase → Dashboard)

```text
Chrome Extension (instagram.com)
  │
  ├─ lovable-supabase.js → INSERT action_log (follow, unfollow, like, error)
  ├─ lovable-sync.js     → UPDATE ig_accounts (bot_online, last_heartbeat, followers_count)
  ├─ lovable-sync.js     → INSERT session_stats (on session end)
  ├─ lovable-sync.js     → INSERT/UPDATE daily_action_cache
  ├─ lovable-sync.js     → INSERT growth_stats
  └─ lovable-supabase.js → SELECT bot_commands (polls every 45s for new commands)
  └─ lovable-supabase.js → SELECT target_queue (fetches pending targets)
  └─ lovable-supabase.js → SELECT user_settings (schedule, limits, delays)
```

### What the Dashboard Must Provide to the Extension

```text
Dashboard (React App)
  │
  ├─ INSERT bot_commands → extension picks up via poll (start, pause, stop)
  ├─ UPSERT user_settings → extension reads on settings_sync interval (2 min)
  ├─ INSERT target_queue  → extension fetches batches to process
  └─ Deep Link: /dashboard?account=@username (popup button "Open Dashboard")
```

## Gaps Identified

### 1. Deep link `?account=@username` not handled
The extension popup button opens `https://organicpublic.lovable.app/dashboard?account=meuusername`. The dashboard ignores this query param — it should auto-select the matching account.

### 2. Extension Download / Setup Page missing
Users need a dedicated page (`/extension`) explaining how to install and configure the extension, with a direct link to the GitHub release ZIP download.

### 3. Settings sync gap
The extension reads `user_settings.settings_json` for: `schedule_hours`, `delay_min`, `delay_max`, `follow_daily_limit`, etc. The dashboard Settings page saves these but uses different key names in some places — needs alignment verification and a "Sync to Extension" indicator.

### 4. Bot Commands not fully wired
The extension polls `bot_commands` every 45s for commands with `status = 'pending'`. Currently `send_bot_command` RPC is called from `useDashboardV2.toggleBot()`, but the command history UI and realtime status update (pending → executed) are not visually prominent.

### 5. Queue sync button missing in dashboard
The extension popup has a "Sync Queue" button (`FORCE_QUEUE_SYNC` message). This injects pending `target_queue` rows into the Organic UI. The dashboard should show the queue status clearly and let the user trigger manual injection from campaigns.

### 6. Extension-specific fields in `ig_accounts` not displayed
Fields like `bridge_version`, `device_id`, `max_actions_per_session` are written by the extension but not shown on the dashboard (only visible in Settings cards, partially).

## Implementation Plan

### Part 1 — Handle Deep Link `?account=username` in Dashboard

**File:** `src/pages/Dashboard.tsx`

Read `?account=` query param on mount. After accounts load, find the account whose `ig_username` matches the param and auto-call `setActiveAccountId()`.

```text
useEffect → searchParams.get("account") → 
  accounts.find(a => a.ig_username === param) → 
  setActiveAccountId(match.id)
```

### Part 2 — Extension Setup / Download Page

**New file:** `src/pages/Extension.tsx`  
**Edit:** `src/App.tsx` (add route `/extension`)  
**Edit:** `src/components/layout/AppSidebar.tsx` (add nav link)

A dedicated page with:
- Step-by-step installation instructions (numbered, visual)
- Download button linking to the GitHub ZIP: `https://github.com/Drmachado0/extensao/archive/refs/heads/main.zip`
- Visual showing the Chrome extensions page path (`chrome://extensions`)
- Section: "Connecting to Dashboard" — explain login with same email/password
- Section: "Safety Presets" — explain Nova / Média / Madura account types
- Section: "How it syncs" — diagram of Extension → Supabase → Dashboard
- Indicator showing if the account is currently connected (checks `last_heartbeat`)

### Part 3 — Extension Status Widget in Dashboard

**Edit:** `src/components/dashboard/LiveStatusBar.tsx`

Add extension connection status derived from `last_heartbeat`:
- If `last_heartbeat` < 6 minutes ago: show green "Extensão ativa" badge
- If `last_heartbeat` between 6–30 min ago: show yellow "Extensão ausente"
- If `last_heartbeat` > 30 min or null: show grey "Extensão offline"

This gives users instant feedback that the Chrome extension is running and syncing.

### Part 4 — Bot Commands Panel Enhancement

**Edit:** `src/pages/Dashboard.tsx`

The `recentCommands` list from `useDashboardV2` is already fetched. Make the commands panel more visible with:
- Command badges: `start` (green), `pause` (yellow), `stop` (red)
- Status chips: `pending` (pulsing dot), `executed` (checkmark), `failed` (X)
- Timestamp relative formatting ("há 2 min")
- Realtime already wired — just improve the visual rendering

### Part 5 — Settings Sync Alignment

**Edit:** `src/pages/Settings.tsx`

Add a visible "Extensão" section inside Settings that shows:
- Which fields are synced with the Chrome extension (with extension icon badges)
- A "Forçar sync agora" button that triggers `send_bot_command` with `command: 'reload_settings'`
- Explanation of the 2-minute sync delay

### Part 6 — Extension Installation Check (Dashboard Header)

**Edit:** `src/components/layout/AppSidebar.tsx` or `AppShell.tsx`

If user has an account with `last_heartbeat` null or > 1 hour ago, show a subtle persistent banner:
> "Extensão não detectada — Instalar extensão →"

## Technical Details

### Deep Link Implementation
```typescript
// In Dashboard.tsx
import { useSearchParams } from "react-router-dom";

const [searchParams] = useSearchParams();
const accountParam = searchParams.get("account");

useEffect(() => {
  if (!accountParam || !accounts.length || activeAccountId) return;
  const match = accounts.find(
    a => a.ig_username.toLowerCase() === accountParam.replace('@','').toLowerCase()
  );
  if (match) setActiveAccountId(match.id);
}, [accountParam, accounts]);
```

### Extension Status Calculation
```typescript
function getExtensionStatus(lastHeartbeat: string | null) {
  if (!lastHeartbeat) return "offline";
  const diff = Date.now() - new Date(lastHeartbeat).getTime();
  if (diff < 6 * 60 * 1000) return "online";     // < 6 min
  if (diff < 30 * 60 * 1000) return "away";       // 6–30 min
  return "offline";                                // > 30 min
}
```

### GitHub ZIP Download URL
```
https://github.com/Drmachado0/extensao/archive/refs/heads/main.zip
```

### Settings Fields Synced by Extension
The extension's `lovable-supabase.js` reads from `user_settings.settings_json`:
- `schedule_hours` (array of 24 booleans)
- `delay_min`, `delay_max`
- `follow_daily_limit`, `unfollow_daily_limit`, `like_daily_limit`
- `dont_unfollow_followers`, `dont_unfollow_fresh`, `dont_unfollow_fresh_days`
- `dont_unfollow_non_organicbot`
- `randomize_delay`, `randomize_percent`

All of these are already saved by the Settings page — the sync is functional. The missing piece is just the user-visible confirmation that the extension picked them up.

## Files to Create/Edit

| File | Change |
|---|---|
| `src/pages/Extension.tsx` | New page — installation guide + status |
| `src/pages/Dashboard.tsx` | Handle `?account=` deep link, improve commands panel |
| `src/components/dashboard/LiveStatusBar.tsx` | Add extension heartbeat status badge |
| `src/components/layout/AppSidebar.tsx` | Add "Extensão" nav link |
| `src/App.tsx` | Register `/extension` route |
| `src/pages/Settings.tsx` | Add extension sync section with field labels |
