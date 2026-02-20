import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DashboardAccount {
  id: string;
  ig_username: string;
  followers_count: number | null;
  following_count: number | null;
  posts_count: number | null;
  bot_online: boolean | null;
  bot_status: string | null;
  bot_mode: string | null;
  last_heartbeat: string | null;
  queue_total: number | null;
  queue_processed: number | null;
  profile_pic_url: string | null;
}

export interface TodayAction {
  action_type: string;
  count: number;
}

export interface DailyActionPoint {
  day: string;
  follow: number;
  unfollow: number;
  like: number;
}

export interface GrowthPoint {
  day: string;
  followers_count: number;
}

export interface SessionRow {
  id: string;
  session_start: string | null;
  session_end: string | null;
  follows_count: number | null;
  unfollows_count: number | null;
  likes_count: number | null;
  errors_count: number | null;
}

export interface ActionLogRow {
  id: string;
  executed_at: string | null;
  action_type: string;
  target_username: string | null;
  status: string;
  details: Record<string, unknown> | null;
}

export interface Campaign {
  id: string;
  name: string;
  is_active: boolean | null;
  niche: string | null;
}

export interface WhitelistRow {
  id: string;
  username: string;
  added_at: string | null;
}

export interface BotCommand {
  id: string;
  command: string;
  status: string;
  created_at: string | null;
  executed_at: string | null;
  params?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
}

export interface DailyLimits {
  follow: number;
  unfollow: number;
  like: number;
}

export interface DashboardData {
  accounts: DashboardAccount[];
  activeAccountId: string | null;
  setActiveAccountId: (id: string) => void;
  account: DashboardAccount | null;
  todayActions: TodayAction[];
  dailyHistory: DailyActionPoint[];
  growthHistory: GrowthPoint[];
  pendingQueueCount: number;
  sessions: SessionRow[];
  recentActions: ActionLogRow[];
  campaigns: Campaign[];
  whitelistCount: number;
  whitelistPreview: WhitelistRow[];
  automationPaused: boolean;
  recentCommands: BotCommand[];
  dailyLimits: DailyLimits;
  isLoading: boolean;
  error: string | null;
  toggleBot: () => Promise<void>;
  syncQueue: () => Promise<void>;
  sendCommand: (command: string) => Promise<void>;
  refresh: () => void;
}

export function useDashboardV2(): DashboardData {
  const [accounts, setAccounts] = useState<DashboardAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [todayActions, setTodayActions] = useState<TodayAction[]>([]);
  const [dailyHistory, setDailyHistory] = useState<DailyActionPoint[]>([]);
  const [growthHistory, setGrowthHistory] = useState<GrowthPoint[]>([]);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [recentActions, setRecentActions] = useState<ActionLogRow[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [whitelistCount, setWhitelistCount] = useState(0);
  const [whitelistPreview, setWhitelistPreview] = useState<WhitelistRow[]>([]);
  const [automationPaused, setAutomationPaused] = useState(false);
  const [recentCommands, setRecentCommands] = useState<BotCommand[]>([]);
  const [dailyLimits, setDailyLimits] = useState<DailyLimits>({ follow: 150, unfollow: 100, like: 300 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshCountRef = useRef(0);

  const fetchAll = useCallback(async (accountId: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsLoading(false); return; }

      const today = new Date().toISOString().split("T")[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString();

      const [
        accountsRes,
        todayActionsRes,
        dailyHistoryRes,
        growthRes,
        queueRes,
        sessionsRes,
        actionsRes,
        campaignsRes,
        whitelistRes,
        whitelistCountRes,
        settingsRes,
        commandsRes,
      ] = await Promise.all([
        // Filter by user_id to avoid seeing other users' accounts
        supabase.from("ig_accounts").select("id, ig_username, followers_count, following_count, posts_count, bot_online, bot_status, bot_mode, last_heartbeat, queue_total, queue_processed, profile_pic_url").eq("user_id", user.id).eq("is_active", true).order("created_at", { ascending: true }),
        accountId
          ? supabase.from("daily_action_cache").select("action_type, success_count").eq("ig_account_id", accountId).eq("day", today)
          : Promise.resolve({ data: [], error: null }),
        accountId
          ? supabase.from("daily_action_cache").select("day, action_type, success_count").eq("ig_account_id", accountId).gte("day", thirtyDaysAgo).order("day", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        accountId
          ? supabase.from("growth_stats").select("recorded_at, followers_count").eq("ig_account_id", accountId).gte("recorded_at", fourteenDaysAgo).order("recorded_at", { ascending: true }).limit(500)
          : Promise.resolve({ data: [], error: null }),
        accountId
          ? supabase.from("target_queue").select("id", { count: "exact", head: true }).eq("ig_account_id", accountId).eq("status", "pending")
          : Promise.resolve({ data: [], count: 0, error: null }),
        accountId
          ? supabase.from("session_stats").select("id, session_start, session_end, follows_count, unfollows_count, likes_count, errors_count").eq("ig_account_id", accountId).order("session_end", { ascending: false }).limit(5)
          : Promise.resolve({ data: [], error: null }),
        accountId
          ? supabase.from("action_log").select("id, executed_at, action_type, target_username, status, details").eq("ig_account_id", accountId).order("executed_at", { ascending: false }).limit(20)
          : Promise.resolve({ data: [], error: null }),
        supabase.from("targeting_campaigns").select("id, name, is_active, niche").eq("user_id", user.id).eq("is_active", true).limit(10),
        supabase.from("whitelist").select("id, username, added_at").eq("user_id", user.id).order("added_at", { ascending: false }).limit(3),
        supabase.from("whitelist").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("user_settings").select("automation_paused, settings_json").eq("user_id", user.id).limit(1).maybeSingle(),
        accountId
          ? supabase.from("bot_commands").select("id, command, status, created_at, executed_at, params, result").eq("ig_account_id", accountId).order("created_at", { ascending: false }).limit(10)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (accountsRes.data) {
        setAccounts(accountsRes.data as DashboardAccount[]);
        if (!accountId && accountsRes.data.length > 0) {
          setActiveAccountId(accountsRes.data[0].id);
        }
      }

      // Today's actions
      const todayMap: Record<string, number> = {};
      if (todayActionsRes.data) {
        for (const row of todayActionsRes.data as { action_type: string; success_count: number | null }[]) {
          todayMap[row.action_type] = (todayMap[row.action_type] || 0) + (row.success_count || 0);
        }
      }
      setTodayActions(Object.entries(todayMap).map(([action_type, count]) => ({ action_type, count })));

      // Daily history pivoted
      const historyMap: Record<string, DailyActionPoint> = {};
      if (dailyHistoryRes.data) {
        for (const row of dailyHistoryRes.data as { day: string; action_type: string; success_count: number | null }[]) {
          if (!historyMap[row.day]) historyMap[row.day] = { day: row.day, follow: 0, unfollow: 0, like: 0 };
          const t = row.action_type.toLowerCase();
          if (t === "follow") historyMap[row.day].follow += row.success_count || 0;
          else if (t === "unfollow") historyMap[row.day].unfollow += row.success_count || 0;
          else if (t === "like") historyMap[row.day].like += row.success_count || 0;
        }
      }
      setDailyHistory(Object.values(historyMap).sort((a, b) => a.day.localeCompare(b.day)));

      // Growth history
      if (growthRes.data) {
        const growthPivot: Record<string, number> = {};
        for (const row of growthRes.data as { recorded_at: string; followers_count: number | null }[]) {
          const day = row.recorded_at.split("T")[0];
          growthPivot[day] = row.followers_count || 0;
        }
        setGrowthHistory(Object.entries(growthPivot).sort((a, b) => a[0].localeCompare(b[0])).map(([day, followers_count]) => ({ day, followers_count })));
      }

      setPendingQueueCount(queueRes.count || 0);
      setSessions((sessionsRes.data as SessionRow[]) || []);
      setRecentActions(
        ((actionsRes.data || []) as { id: string; executed_at: string | null; action_type: string; target_username: string | null; status: string; details: unknown }[]).map((r) => ({
          ...r,
          details: (r.details as Record<string, unknown>) || null,
        }))
      );
      setCampaigns((campaignsRes.data as Campaign[]) || []);
      setWhitelistPreview((whitelistRes.data as WhitelistRow[]) || []);
      setWhitelistCount(whitelistCountRes.count || 0);
      setAutomationPaused(settingsRes.data?.automation_paused ?? false);
      // Extract daily limits from settings_json
      const sj = settingsRes.data?.settings_json as Record<string, unknown> | null;
      if (sj) {
        setDailyLimits({
          follow: Number(sj.follow_daily_limit ?? 150),
          unfollow: Number(sj.unfollow_daily_limit ?? 100),
          like: Number(sj.like_daily_limit ?? 300),
        });
      }
      setRecentCommands((commandsRes.data as BotCommand[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchAll(activeAccountId);
  }, [activeAccountId, fetchAll]);

  // Realtime subscription
  useEffect(() => {
    if (!activeAccountId) return;
    const channel = supabase
      .channel(`dashboard-realtime-${activeAccountId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "action_log", filter: `ig_account_id=eq.${activeAccountId}` }, (payload) => {
        const newAction = payload.new as ActionLogRow & { details: unknown };
        setRecentActions((prev) => [{ ...newAction, details: (newAction.details as Record<string, unknown>) || null }, ...prev].slice(0, 20));
        // debounce refetch KPIs
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchAll(activeAccountId), 2000);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bot_commands", filter: `ig_account_id=eq.${activeAccountId}` }, (payload) => {
        const updated = payload.new as BotCommand;
        setRecentCommands((prev) =>
          prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
        );
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bot_commands", filter: `ig_account_id=eq.${activeAccountId}` }, (payload) => {
        const newCmd = payload.new as BotCommand;
        setRecentCommands((prev) => [newCmd, ...prev].slice(0, 10));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ig_accounts", filter: `id=eq.${activeAccountId}` }, (payload) => {
        const row = payload.new as DashboardAccount;
        setAccounts((prev) => prev.map((a) => a.id === row.id ? { ...a, queue_total: row.queue_total, queue_processed: row.queue_processed, bot_online: row.bot_online, bot_status: row.bot_status } : a));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeAccountId, fetchAll]);

  const toggleBot = useCallback(async () => {
    if (!activeAccountId) return;
    try {
      const newPaused = !automationPaused;
      const command = newPaused ? "pause" : "start";

      // Send real bot command via RPC
      const { error: cmdError } = await supabase.rpc("send_bot_command", {
        p_ig_account_id: activeAccountId,
        p_command: command,
        p_params: {},
      });
      if (cmdError) throw cmdError;

      // Also update automation_paused flag as fallback state
      await supabase
        .from("user_settings")
        .upsert(
          {
            user_id: (await supabase.auth.getUser()).data.user?.id ?? "",
            automation_paused: newPaused,
            automation_paused_at: newPaused ? new Date().toISOString() : null,
          },
          { onConflict: "user_id" }
        );

      setAutomationPaused(newPaused);

      // Refresh commands list
      const { data } = await supabase
        .from("bot_commands")
        .select("id, command, status, created_at, executed_at, params, result")
        .eq("ig_account_id", activeAccountId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (data) setRecentCommands(data as BotCommand[]);
    } catch {
      // silently fail — caller shows toast
    }
  }, [automationPaused, activeAccountId]);

  const syncQueue = useCallback(async () => {
    if (!activeAccountId) return;
    const { error } = await supabase.rpc("send_bot_command", {
      p_ig_account_id: activeAccountId,
      p_command: "sync_queue",
      p_params: {},
    });
    if (error) throw error;
  }, [activeAccountId]);

  const sendCommand = useCallback(async (command: string) => {
    if (!activeAccountId) return;
    const { error } = await supabase.rpc("send_bot_command", {
      p_ig_account_id: activeAccountId,
      p_command: command,
      p_params: {},
    });
    if (error) throw error;
  }, [activeAccountId]);

  const refresh = useCallback(() => {
    refreshCountRef.current++;
    fetchAll(activeAccountId);
  }, [activeAccountId, fetchAll]);

  const account = accounts.find((a) => a.id === activeAccountId) ?? null;

  return {
    accounts,
    activeAccountId,
    setActiveAccountId,
    account,
    todayActions,
    dailyHistory,
    growthHistory,
    pendingQueueCount,
    sessions,
    recentActions,
    campaigns,
    whitelistCount,
    whitelistPreview,
    automationPaused,
    recentCommands,
    dailyLimits,
    isLoading,
    error,
    toggleBot,
    syncQueue,
    sendCommand,
    refresh,
  };
}
