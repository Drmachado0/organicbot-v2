import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  UserCheck,
  Hash,
  MapPin,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Search,
  SkipForward,
  Wifi,
  WifiOff,
  ListOrdered,
  ChevronLeft,
  ChevronRight,
  Zap,
  Settings2,
  Lock,
  BadgeCheck,
  ImageOff,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Types ──────────────────────────────────────────────────────────────────

interface IgAccount {
  id: string;
  ig_username: string;
  ig_user_id: string | null;
  profile_pic_url: string | null;
  followers_count: number | null;
  following_count: number | null;
  bot_online: boolean | null;
  bot_status: string | null;
  last_heartbeat: string | null;
  bot_mode: string | null;
}

interface TargetRow {
  id: string;
  username: string;
  source: string | null;
  status: string | null;
  priority: number | null;
  created_at: string | null;
  processed_at: string | null;
  details: Record<string, unknown> | null;
  campaign_id: string | null;
  campaign_name?: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  followers: "Seguidores",
  following: "Seguindo",
  hashtag: "Hashtag",
  location: "Localização",
  campaign: "Campanha",
};

const SOURCE_COLORS: Record<string, string> = {
  manual: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  followers: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  following: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  hashtag: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  location: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  campaign: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  processing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  injected: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  done: "bg-green-500/20 text-green-400 border-green-500/30",
  skipped: "bg-muted text-muted-foreground border-border",
};

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function QueuePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Account selector
  const [accounts, setAccounts] = useState<IgAccount[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [account, setAccount] = useState<IgAccount | null>(null);

  // Queue data
  // pendingCount is now derived from filteredPendingRows
  const [pendingRows, setPendingRows] = useState<TargetRow[]>([]);
  const [allRows, setAllRows] = useState<TargetRow[]>([]);

  // UI states
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importFilterPrivate, setImportFilterPrivate] = useState(true);
  const [importFilterNoPhoto, setImportFilterNoPhoto] = useState(true);
  const [importFilterStats, setImportFilterStats] = useState<{ total: number; removedPrivate: number; removedNoPhoto: number } | null>(null);
  const [manualText, setManualText] = useState("");
  const [hashtagInput, setHashtagInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [loadingCmd, setLoadingCmd] = useState<string | null>(null);
  const [manualPicOpen, setManualPicOpen] = useState(false);
  const [manualPicUrl, setManualPicUrl] = useState("");

  // Synced settings (from user_settings.settings_json)
  const [cfgDelayMin, setCfgDelayMin] = useState(25);
  const [cfgDelayMax, setCfgDelayMax] = useState(45);
  const [cfgFollowDaily, setCfgFollowDaily] = useState(150);
  const [cfgMaxSession, setCfgMaxSession] = useState(50);
  const [savingConfig, setSavingConfig] = useState(false);

  // Filters for Aba 2
  const [searchQ, setSearchQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Account type filters
  const [removePrivate, setRemovePrivate] = useState(false);
  const [removePublic, setRemovePublic] = useState(false);
  const [removeVerified, setRemoveVerified] = useState(false);
  const [removeUnverified, setRemoveUnverified] = useState(false);
  const [removeNoPhoto, setRemoveNoPhoto] = useState(false);
  const [removeDuplicates, setRemoveDuplicates] = useState(true);

  // ── Load accounts ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    supabase
      .from("ig_accounts")
      .select("id, ig_username, ig_user_id, profile_pic_url, followers_count, following_count, bot_online, bot_status, last_heartbeat, bot_mode")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at")
      .then(({ data }) => {
        if (data && data.length > 0) {
          setAccounts(data as IgAccount[]);
          setAccountId(data[0].id);
        }
      });
  }, [user]);

  useEffect(() => {
    if (!accountId) return;
    const found = accounts.find((a) => a.id === accountId) ?? null;
    setAccount(found);
  }, [accountId, accounts]);

  // ── Load queue counts & rows ─────────────────────────────────────────────

  // Campaign name cache
  const [campaignNames, setCampaignNames] = useState<Record<string, string>>({});

  const loadQueue = useCallback(async () => {
    if (!accountId) return;
    const { data } = await supabase
      .from("target_queue")
      .select("id, username, source, status, priority, created_at, processed_at, details, campaign_id")
      .eq("ig_account_id", accountId)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1000);

    const rows = (data ?? []) as TargetRow[];

    // Fetch campaign names for any campaign_ids found
    const campaignIds = [...new Set(rows.map((r) => r.campaign_id).filter(Boolean))] as string[];
    const names: Record<string, string> = {};
    if (campaignIds.length > 0) {
      const { data: camps } = await supabase
        .from("targeting_campaigns")
        .select("id, name")
        .in("id", campaignIds);
      if (camps) {
        for (const c of camps) names[c.id] = c.name;
      }
    }
    setCampaignNames(names);

    // Attach campaign_name using local `names` (avoids stale state)
    const enriched = rows.map((r) => ({
      ...r,
      campaign_name: r.campaign_id ? names[r.campaign_id] ?? null : null,
    }));

    setAllRows(enriched);
    const pending = enriched.filter((r) => r.status === "pending" || r.status === "injected");
    setPendingRows(pending);
  }, [accountId]);

  // ── Load synced settings from user_settings + ig_accounts ───────────────
  const loadSettings = useCallback(async () => {
    if (!user || !accountId) return;
    const [settingsRes, accountRes] = await Promise.all([
      supabase.from("user_settings").select("settings_json").eq("user_id", user.id).maybeSingle(),
      supabase.from("ig_accounts").select("delay_min, delay_max, max_actions_per_session").eq("id", accountId).maybeSingle(),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sj = (settingsRes.data?.settings_json as any) ?? {};
    const acc = accountRes.data;
    setCfgDelayMin(acc?.delay_min ?? Number(sj.delay_min ?? 25));
    setCfgDelayMax(acc?.delay_max ?? Number(sj.delay_max ?? 45));
    setCfgFollowDaily(Number(sj.follow_daily_limit ?? 150));
    setCfgMaxSession(acc?.max_actions_per_session ?? Number(sj.max_actions_per_session ?? 50));
  }, [user, accountId]);

  useEffect(() => { loadQueue(); loadSettings(); }, [loadQueue, loadSettings]);

  // ── Campaign progress stats ──────────────────────────────────────────────
  const campaignProgress = useMemo(() => {
    const map: Record<string, { name: string; done: number; total: number }> = {};
    for (const row of allRows) {
      if (!row.campaign_id) continue;
      if (!map[row.campaign_id]) {
        map[row.campaign_id] = {
          name: campaignNames[row.campaign_id] ?? "Sem nome",
          done: 0,
          total: 0,
        };
      }
      map[row.campaign_id].total++;
      if (row.status === "done") map[row.campaign_id].done++;
    }
    return Object.entries(map).map(([id, v]) => ({ id, ...v }));
  }, [allRows, campaignNames]);

  // ── Apply account type filters to pending rows ───────────────────────────
  const filteredPendingRows = useMemo(() => {
    let filtered = [...pendingRows];
    if (removeDuplicates) {
      const seen = new Set<string>();
      filtered = filtered.filter((r) => {
        const key = r.username.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    if (removePrivate) filtered = filtered.filter((r) => !(r.details as any)?.is_private);
    if (removePublic) filtered = filtered.filter((r) => (r.details as any)?.is_private !== false);
    if (removeVerified) filtered = filtered.filter((r) => !(r.details as any)?.is_verified);
    if (removeUnverified) filtered = filtered.filter((r) => (r.details as any)?.is_verified !== false);
    if (removeNoPhoto) filtered = filtered.filter((r) => {
      const url = (r.details as any)?.profile_pic_url ?? "";
      return url && !url.includes("default");
    });
    return filtered;
  }, [pendingRows, removeDuplicates, removePrivate, removePublic, removeVerified, removeUnverified, removeNoPhoto]);

  const pendingCount = filteredPendingRows.length;

  // IDs to remove when applying filters permanently
  const idsToRemove = useMemo(() => {
    return pendingRows
      .filter((r) => !filteredPendingRows.some((f) => f.id === r.id))
      .map((r) => r.id);
  }, [pendingRows, filteredPendingRows]);

  const [applyingFilters, setApplyingFilters] = useState(false);

  const handleApplyFilters = async () => {
    if (!idsToRemove.length || !accountId) return;
    setApplyingFilters(true);
    try {
      // Batch in chunks of 200 to avoid query limits
      for (let i = 0; i < idsToRemove.length; i += 200) {
        const chunk = idsToRemove.slice(i, i + 200);
        const { error } = await supabase
          .from("target_queue")
          .update({ status: "skipped" })
          .in("id", chunk);
        if (error) {
          toast({ title: "Erro", description: error.message, variant: "destructive" });
          return;
        }
      }
      toast({ title: `${idsToRemove.length} target(s) removidos`, description: "Filtros aplicados permanentemente." });
      loadQueue();
    } finally {
      setApplyingFilters(false);
    }
  };

  // ── Realtime subscription ────────────────────────────────────────────────

  useEffect(() => {
    if (!accountId) return;
    const channel = supabase
      .channel(`queue-page-${accountId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "target_queue", filter: `ig_account_id=eq.${accountId}` }, () => loadQueue())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "target_queue", filter: `ig_account_id=eq.${accountId}` }, () => loadQueue())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "target_queue", filter: `ig_account_id=eq.${accountId}` }, () => loadQueue())
      .subscribe();

    // Also subscribe to account changes
    const accChannel = supabase
      .channel(`queue-account-${accountId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ig_accounts", filter: `id=eq.${accountId}` }, (payload) => {
        setAccount((prev) => prev ? { ...prev, ...(payload.new as IgAccount) } : prev);
        setAccounts((prev) => prev.map((a) => a.id === accountId ? { ...a, ...(payload.new as IgAccount) } : a));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(accChannel);
    };
  }, [accountId, loadQueue]);

  // ── Bot commands ─────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sendCmd = async (command: string, params: any = {}) => {
    if (!accountId) return;
    setLoadingCmd(command);
    try {
      await supabase.rpc("send_bot_command", {
        p_ig_account_id: accountId,
        p_command: command,
        p_params: params,
      });
      toast({ title: `Comando "${command}" enviado`, description: "A extensão processará em breve." });
    } catch {
      toast({ title: "Erro", description: "Falha ao enviar comando.", variant: "destructive" });
    } finally {
      setLoadingCmd(null);
    }
  };




  const handleUpdateProfilePic = async () => {
    if (!accountId || !account?.ig_username) return;
    setLoadingCmd("update_profile_pic");
    try {
      const { data, error } = await supabase.functions.invoke("fetch-profile-pic", {
        body: { ig_account_id: accountId, username: account.ig_username },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Foto atualizada!", description: "A foto de perfil foi atualizada com sucesso." });
    } catch {
      // Auto-fetch failed — open manual input dialog
      setManualPicOpen(true);
    } finally {
      setLoadingCmd(null);
    }
  };

  const handleManualPicSave = async () => {
    if (!accountId || !manualPicUrl.trim()) return;
    setLoadingCmd("update_profile_pic");
    try {
      const { error } = await supabase
        .from("ig_accounts")
        .update({ profile_pic_url: manualPicUrl.trim() })
        .eq("id", accountId);
      if (error) throw error;
      toast({ title: "Foto atualizada!", description: "A foto de perfil foi salva manualmente." });
      setManualPicOpen(false);
      setManualPicUrl("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha ao salvar foto.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setLoadingCmd(null);
    }
  };


  const exportJSON = () => {
    downloadFile(JSON.stringify(filteredPendingRows, null, 2), "queue.json", "application/json");
  };
  const exportCSV = () => {
    const header = "username,source,created_at";
    const rows = filteredPendingRows.map((r) => `${r.username},${r.source ?? ""},${r.created_at ?? ""}`);
    downloadFile([header, ...rows].join("\n"), "queue.csv", "text/csv");
  };
  const exportTXT = () => {
    downloadFile(filteredPendingRows.map((r) => r.username).join("\n"), "queue.txt", "text/plain");
  };

  // ── Import ───────────────────────────────────────────────────────────────

  // Store parsed JSON items with details for import
  const importJsonItemsRef = useRef<Record<string, Record<string, unknown>>>({});

  // Smart parser: tries JSON first (works for .txt/.csv/.json), falls back to text
  const parseFileContent = (text: string): string => {
    try {
      const parsed = JSON.parse(text);
      const allUsernames: string[] = [];
      let countPrivate = 0;
      let countNoPhoto = 0;
      if (Array.isArray(parsed)) {
        parsed.forEach((item: any) => {
          const uname = typeof item === "string" ? item : item?.username;
          if (uname) {
            allUsernames.push(uname);
            if (typeof item === "object") {
              const { username, ...rest } = item;
              importJsonItemsRef.current[uname] = rest;
              if (item.is_private === true || item.is_private === "true") countPrivate++;
              const picUrl = item.profile_pic_url ?? "";
              if (!picUrl || picUrl.includes("default") || picUrl === "") countNoPhoto++;
            }
          }
        });
      } else if (typeof parsed === "object" && parsed !== null) {
        allUsernames.push(...Object.keys(parsed));
      }
      if (allUsernames.length > 0) {
        setImportFilterStats({ total: allUsernames.length, removedPrivate: countPrivate, removedNoPhoto: countNoPhoto });
        return allUsernames.join("\n");
      }
    } catch {
      // Not JSON — fall through to text parsing
      setImportFilterStats(null);
    }
    return text;
  };

  // Compute filtered import count
  const importUsernames = useMemo(() => {
    const all = importText.split("\n").map((u) => u.trim().replace(/^@/, "")).filter(Boolean);
    const jsonItems = importJsonItemsRef.current;
    const hasDetails = Object.keys(jsonItems).length > 0;
    if (!hasDetails) return all;
    return all.filter((uname) => {
      const details = jsonItems[uname] as any;
      if (!details) return true;
      if (importFilterPrivate && (details.is_private === true || details.is_private === "true")) return false;
      if (importFilterNoPhoto) {
        const pic = details.profile_pic_url ?? "";
        if (!pic || pic.includes("default")) return false;
      }
      return true;
    });
  }, [importText, importFilterPrivate, importFilterNoPhoto]);

  const handleImport = async () => {
    const usernames = importUsernames;
    if (!usernames.length || !accountId) return;

    // Check if we have JSON details to attach
    const jsonItems = importJsonItemsRef.current;
    const hasDetails = Object.keys(jsonItems).length > 0;

    if (hasDetails) {
      // Insert directly with details
      const rows = usernames.map((username) => ({
        ig_account_id: accountId,
        username,
        source: "manual" as const,
        details: jsonItems[username] ?? {},
      }));
      const { error } = await supabase.from("target_queue").insert(rows as never[], {
        count: "exact",
      });
      if (error) {
        toast({ title: "Erro ao importar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: `${usernames.length} target(s) adicionados`, description: "Fila atualizada." });
        await sendCmd("sync_queue", {});
        setImportText("");
        importJsonItemsRef.current = {};
        setImportOpen(false);
        loadQueue();
      }
    } else {
      const { data, error } = await supabase.rpc("add_targets_batch", {
        p_ig_account_id: accountId,
        p_usernames: usernames,
        p_source: "manual",
      });
      if (error) {
        toast({ title: "Erro ao importar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: `${data} target(s) adicionados`, description: "Fila atualizada." });
        await sendCmd("sync_queue", {});
        setImportText("");
        setImportOpen(false);
        loadQueue();
      }
    }
  };

  // ── Manual entry ─────────────────────────────────────────────────────────

  const handleManual = async () => {
    const usernames = manualText.split("\n").map((u) => u.trim().replace(/^@/, "")).filter(Boolean);
    if (!usernames.length || !accountId) return;
    const { data, error } = await supabase.rpc("add_targets_batch", {
      p_ig_account_id: accountId,
      p_usernames: usernames,
      p_source: "manual",
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${data} target(s) adicionados` });
      setManualText("");
      setManualOpen(false);
      loadQueue();
    }
  };

  // ── Clear queue ──────────────────────────────────────────────────────────

  const handleClear = async () => {
    if (!accountId) return;
    const { error } = await supabase.rpc("clear_target_queue", {
      p_ig_account_id: accountId,
      p_status: "pending",
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Fila limpa", description: "Todos os targets pendentes foram removidos." });
      loadQueue();
    }
  };

  // ── Skip (soft delete) ───────────────────────────────────────────────────

  const skipTarget = async (id: string) => {
    await supabase.from("target_queue").update({ status: "skipped" }).eq("id", id);
    loadQueue();
  };

  // ── Filtered rows for Aba 2 ──────────────────────────────────────────────

  const filteredRows = allRows.filter((r) => {
    const matchSearch = !searchQ || r.username.toLowerCase().includes(searchQ.toLowerCase());
    const matchStatus = filterStatus === "all" || r.status === filterStatus;
    const matchSource = filterSource === "all" || r.source === filterSource;
    return matchSearch && matchStatus && matchSource;
  });
  const pagedRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);

  // ── Heartbeat display ────────────────────────────────────────────────────

  const heartbeatStr = account?.last_heartbeat
    ? formatDistanceToNow(new Date(account.last_heartbeat), { addSuffix: true, locale: ptBR })
    : "nunca";

  const isOnline = (() => {
    if (!account?.bot_online || !account?.last_heartbeat) return false;
    const diff = Date.now() - new Date(account.last_heartbeat).getTime();
    return diff < 6 * 60 * 1000;
  })();

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "hsl(var(--primary)/0.15)", border: "1px solid hsl(var(--primary)/0.4)" }}>
              <ListOrdered className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground leading-tight">Fila de Targets</h1>
              <p className="text-xs text-muted-foreground">IG List Collector</p>
            </div>
          </div>

          {/* Account selector */}
          {accounts.length > 1 && (
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-48 h-8 text-xs border-border bg-secondary">
                <SelectValue placeholder="Selecionar conta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    @{a.ig_username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="collector" className="flex flex-col flex-1 min-h-0">
          <TabsList className="mx-6 mt-4 mb-0 w-fit rounded-lg bg-secondary border border-border">
            <TabsTrigger value="collector" className="text-xs px-4">Coletor</TabsTrigger>
            <TabsTrigger value="reader" className="text-xs px-4">Leitor de Lista</TabsTrigger>
          </TabsList>

          {/* ── TAB 1: COLETOR ── */}
          <TabsContent value="collector" className="flex-1 overflow-y-auto px-6 py-4 space-y-3 mt-0">

            {/* PERFIL ATUAL */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Perfil Atual</p>
              {account ? (
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-lg font-bold"
                      style={{
                        border: `2px solid ${isOnline ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}`,
                        background: "hsl(var(--secondary))",
                      }}
                    >
                      {account.profile_pic_url ? (
                        <img src={account.profile_pic_url} alt={account.ig_username} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-foreground">@</span>
                      )}
                    </div>
                    <span
                      className={cn(
                        "absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-card",
                        isOnline ? "bg-primary animate-pulse" : "bg-muted-foreground"
                      )}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">@{account.ig_username}</p>
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      <span><span className="font-semibold text-foreground">{(account.followers_count ?? 0).toLocaleString()}</span> seguidores</span>
                      <span><span className="font-semibold text-foreground">{(account.following_count ?? 0).toLocaleString()}</span> seguindo</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {account.ig_user_id ? (
                        <Badge className="text-[9px] px-1.5 py-0 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full">
                          ✓ ID detectado
                        </Badge>
                      ) : (
                        <Badge className="text-[9px] px-1.5 py-0 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full">
                          ⚠ Sem ID
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {isOnline ? <span className="text-primary flex items-center gap-1"><Wifi className="w-3 h-3" /> Online · {heartbeatStr}</span>
                          : <span className="flex items-center gap-1"><WifiOff className="w-3 h-3" /> Offline · {heartbeatStr}</span>}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma conta selecionada.</p>
              )}

              {/* Detection buttons */}
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={() => sendCmd("sync_settings")} disabled={loadingCmd === "sync_settings"}>
                  <RefreshCw className={cn("w-3 h-3", loadingCmd === "sync_settings" && "animate-spin")} />
                  Re-detectar
                </Button>
                <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={handleUpdateProfilePic} disabled={loadingCmd === "update_profile_pic"}>
                  <RefreshCw className={cn("w-3 h-3", loadingCmd === "update_profile_pic" && "animate-spin")} />
                  Atualizar Foto
                </Button>
                <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={() => sendCmd("collect_via_api")} disabled={loadingCmd === "collect_via_api"}>
                  <Zap className="w-3 h-3" />
                  API
                </Button>
                <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={() => setManualOpen(true)}>
                  <Upload className="w-3 h-3" />
                  Manual
                </Button>
              </div>
            </div>

            {/* COLETAR */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Coletar</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => sendCmd("collect_followers", {})}
                  disabled={!!loadingCmd}
                >
                  <Users className="w-3.5 h-3.5" />
                  Seguidores
                </Button>
                <Button
                  className="text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => sendCmd("collect_following", {})}
                  disabled={!!loadingCmd}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Seguindo
                </Button>
                <div className="flex gap-1.5">
                  <Input
                    placeholder="#hashtag"
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value)}
                    className="h-9 text-xs border-border bg-secondary"
                  />
                  <Button
                    className="text-xs h-9 px-3 bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0"
                    onClick={() => { if (hashtagInput) sendCmd("collect_hashtag", { hashtag: hashtagInput }); }}
                    disabled={!!loadingCmd || !hashtagInput}
                  >
                    <Hash className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex gap-1.5">
                  <Input
                    placeholder="Localização"
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    className="h-9 text-xs border-border bg-secondary"
                  />
                  <Button
                    className="text-xs h-9 px-3 bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0"
                    onClick={() => { if (locationInput) sendCmd("collect_location", { location: locationInput }); }}
                    disabled={!!loadingCmd || !locationInput}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* FILA COLETADA */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Fila Coletada</p>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-3xl font-bold text-foreground">{pendingCount}</p>
                  <p className="text-xs text-muted-foreground">contas na fila (pendentes)</p>
                </div>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={loadQueue}>
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </div>

              {/* Export */}
              <p className="text-[10px] text-muted-foreground mb-2">Exportar fila pendente:</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={exportJSON} disabled={pendingCount === 0}
                  className="text-xs h-7 flex-1 border-green-500/40 text-green-400 hover:bg-green-500/10">
                  <Download className="w-3 h-3" /> JSON
                </Button>
                <Button size="sm" variant="outline" onClick={exportCSV} disabled={pendingCount === 0}
                  className="text-xs h-7 flex-1 border-green-500/40 text-green-400 hover:bg-green-500/10">
                  <Download className="w-3 h-3" /> CSV
                </Button>
                <Button size="sm" variant="outline" onClick={exportTXT} disabled={pendingCount === 0}
                  className="text-xs h-7 flex-1 border-green-500/40 text-green-400 hover:bg-green-500/10">
                  <Download className="w-3 h-3" /> TXT
                </Button>
              </div>

              {/* Import + Clear + Remove Duplicates */}
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" className="text-xs h-8 flex-1" onClick={() => setImportOpen(true)}>
                  <Upload className="w-3 h-3" /> Importar Lista
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8 flex-1 border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
                      disabled={pendingCount === 0 || !!loadingCmd}
                    >
                      <Trash2 className="w-3 h-3" /> Duplicatas
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover duplicatas?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Usernames duplicados serão removidos da fila, mantendo apenas a primeira ocorrência de cada um.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                        onClick={async () => {
                          if (!accountId) return;
                          setLoadingCmd("remove_duplicates");
                          try {
                            const { data, error } = await supabase.rpc("remove_duplicate_targets", { p_ig_account_id: accountId });
                            if (error) {
                              toast({ title: "Erro", description: error.message, variant: "destructive" });
                            } else {
                              toast({ title: `${data} duplicata(s) removida(s)`, description: "Fila atualizada." });
                              loadQueue();
                            }
                          } finally {
                            setLoadingCmd(null);
                          }
                        }}
                      >
                        Remover
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive" className="text-xs h-8 flex-1" disabled={pendingCount === 0}>
                      <Trash2 className="w-3 h-3" /> Limpar Fila
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Limpar fila pendente?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {pendingCount} target(s) pendente(s) serão removidos permanentemente. Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClear} className="bg-destructive hover:bg-destructive/90">
                        Limpar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {/* PROGRESSO POR CAMPANHA */}
            {campaignProgress.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-3.5 h-3.5 text-primary" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Progresso por Campanha</p>
                </div>
                <div className="space-y-3">
                  {campaignProgress.map((cp) => {
                    const pct = cp.total > 0 ? Math.round((cp.done / cp.total) * 100) : 0;
                    return (
                      <div key={cp.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-foreground truncate">{cp.name}</span>
                          <span className="text-[10px] text-muted-foreground ml-2 flex-shrink-0">
                            {cp.done}/{cp.total} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              background: pct === 100
                                ? "hsl(var(--primary))"
                                : "linear-gradient(90deg, hsl(var(--primary) / 0.7), hsl(var(--primary)))",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* FILTROS (colapsível) */}
            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
              <div className="rounded-xl border border-border bg-card">
                <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Filtros Ativos</p>
                  {filtersOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-3">
                    {/* TIPO DE CONTA */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Tipo de Conta</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "removePrivate", label: "Remover privadas", checked: removePrivate, set: setRemovePrivate },
                          { id: "removePublic", label: "Remover públicas", checked: removePublic, set: setRemovePublic },
                          { id: "removeVerified", label: "Remover verificadas", checked: removeVerified, set: setRemoveVerified },
                          { id: "removeUnverified", label: "Remover não-verificadas", checked: removeUnverified, set: setRemoveUnverified },
                          { id: "removeNoPhoto", label: "Remover sem foto", checked: removeNoPhoto, set: setRemoveNoPhoto },
                          { id: "removeDuplicates", label: "Remover duplicadas", checked: removeDuplicates, set: setRemoveDuplicates },
                        ].map((f) => (
                          <label key={f.id} className="flex items-center gap-2 cursor-pointer group">
                            <Checkbox
                              id={f.id}
                              checked={f.checked}
                              onCheckedChange={(v) => f.set(v === true)}
                              className="h-3.5 w-3.5 border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                            <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors select-none">
                              {f.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Aplicar Filtros button */}
                    {idsToRemove.length > 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            className="w-full text-xs h-8 bg-orange-600 hover:bg-orange-700 text-white"
                            disabled={applyingFilters}
                          >
                            {applyingFilters ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                            Aplicar Filtros ({idsToRemove.length} removidos)
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Aplicar filtros permanentemente?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {idsToRemove.length} target(s) serão marcados como "skipped" e removidos da fila permanentemente. Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-orange-600 hover:bg-orange-700 text-white"
                              onClick={handleApplyFilters}
                            >
                              Aplicar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    <div className="h-px bg-border" />

                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Fonte</p>
                      <div className="flex flex-wrap gap-1.5">
                        {["all", "manual", "followers", "following", "hashtag", "location"].map((s) => (
                          <button key={s} onClick={() => setFilterSource(s)}
                            className={cn("text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                              filterSource === s
                                ? "bg-primary/20 text-primary border-primary/40"
                                : "text-muted-foreground border-border hover:border-muted-foreground")}>
                            {s === "all" ? "Todos" : SOURCE_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Status</p>
                      <div className="flex flex-wrap gap-1.5">
                        {["all", "pending", "processing", "done", "skipped"].map((s) => (
                          <button key={s} onClick={() => setFilterStatus(s)}
                            className={cn("text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                              filterStatus === s
                                ? "bg-primary/20 text-primary border-primary/40"
                                : "text-muted-foreground border-border hover:border-muted-foreground")}>
                            {s === "all" ? "Todos" : s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* CONFIGURAÇÕES (colapsível) */}
            <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
              <div className="rounded-xl border border-border bg-card">
                <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Configurações</p>
                  </div>
                  {configOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Delay mín (s)</p>
                        <Input type="number" min={5} max={300} value={cfgDelayMin}
                          onChange={(e) => setCfgDelayMin(Number(e.target.value))}
                          className="h-8 text-xs text-center border-border bg-secondary" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Delay máx (s)</p>
                        <Input type="number" min={5} max={300} value={cfgDelayMax}
                          onChange={(e) => setCfgDelayMax(Number(e.target.value))}
                          className="h-8 text-xs text-center border-border bg-secondary" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Follows/dia</p>
                        <Input type="number" min={1} max={500} value={cfgFollowDaily}
                          onChange={(e) => setCfgFollowDaily(Number(e.target.value))}
                          className="h-8 text-xs text-center border-border bg-secondary" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Max ações/sessão</p>
                        <Input type="number" min={1} max={500} value={cfgMaxSession}
                          onChange={(e) => setCfgMaxSession(Number(e.target.value))}
                          className="h-8 text-xs text-center border-border bg-secondary" />
                      </div>
                    </div>
                    <Button size="sm" className="h-8 text-xs w-full" disabled={savingConfig} onClick={async () => {
                      if (!user || !accountId) return;
                      setSavingConfig(true);
                      try {
                        // 1. Merge into user_settings.settings_json
                        const { data: existing } = await supabase.from("user_settings").select("settings_json").eq("user_id", user.id).maybeSingle();
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const prevJson: any = existing?.settings_json ?? {};
                        const merged = {
                          ...prevJson,
                          delay_min: cfgDelayMin,
                          delay_max: cfgDelayMax,
                          follow_daily_limit: cfgFollowDaily,
                          max_actions_per_session: cfgMaxSession,
                        };
                        await supabase.from("user_settings").upsert(
                          { user_id: user.id, settings_json: merged as never, updated_at: new Date().toISOString() },
                          { onConflict: "user_id" }
                        );

                        // 2. Dual-write to ig_accounts
                        await supabase.from("ig_accounts").update({
                          delay_min: cfgDelayMin,
                          delay_max: cfgDelayMax,
                          max_actions_per_session: cfgMaxSession,
                          updated_at: new Date().toISOString(),
                        }).eq("id", accountId);

                        // 3. Send sync_settings command to extension
                        await supabase.rpc("send_bot_command", {
                          p_ig_account_id: accountId,
                          p_command: "sync_settings",
                          p_params: {},
                        });

                        toast({ title: "Configurações salvas", description: "Sincronizado com a extensão." });
                      } catch {
                        toast({ title: "Erro ao salvar", variant: "destructive" });
                      } finally {
                        setSavingConfig(false);
                      }
                    }}>
                      {savingConfig ? "Salvando..." : "Salvar e sincronizar"}
                    </Button>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </TabsContent>

          {/* ── TAB 2: LEITOR DE LISTA ── */}
          <TabsContent value="reader" className="flex-1 flex flex-col min-h-0 px-6 py-4 mt-0">

            {/* Filters bar */}
            <div className="flex gap-2 mb-3 flex-wrap">
              <div className="relative flex-1 min-w-40">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Buscar username..."
                  value={searchQ}
                  onChange={(e) => { setSearchQ(e.target.value); setPage(0); }}
                  className="pl-8 h-8 text-xs border-border bg-secondary"
                />
              </div>
              <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(0); }}>
                <SelectTrigger className="w-32 h-8 text-xs border-border bg-secondary">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todos status</SelectItem>
                  <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                  <SelectItem value="processing" className="text-xs">Processing</SelectItem>
                  <SelectItem value="done" className="text-xs">Done</SelectItem>
                  <SelectItem value="skipped" className="text-xs">Skipped</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterSource} onValueChange={(v) => { setFilterSource(v); setPage(0); }}>
                <SelectTrigger className="w-36 h-8 text-xs border-border bg-secondary">
                  <SelectValue placeholder="Fonte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todas fontes</SelectItem>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground self-center ml-auto">
                {filteredRows.length} resultado(s)
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 rounded-xl border border-border overflow-auto bg-card">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card border-b border-border z-10">
                  <tr>
                    <th className="text-left px-3 py-2.5 text-muted-foreground font-medium w-48">Username</th>
                    <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Campanha</th>
                    <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Fonte</th>
                    <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Status</th>
                    <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Adicionado</th>
                    <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Processado</th>
                    <th className="px-3 py-2.5 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center text-muted-foreground py-12">
                        Nenhum target encontrado.
                      </td>
                    </tr>
                  ) : (
                    pagedRows.map((row) => (
                      <tr key={row.id} className="border-b border-border/50 hover:bg-secondary/40 transition-colors">
                        <td className="px-3 py-2 font-medium text-foreground">
                          <span className="flex items-center gap-1.5">
                            @{row.username}
                            {(row.details as any)?.is_private && (
                              <span aria-label="Conta privada"><Lock className="w-3 h-3 text-yellow-400 flex-shrink-0" /></span>
                            )}
                            {(row.details as any)?.is_verified && (
                              <span aria-label="Verificada"><BadgeCheck className="w-3 h-3 text-blue-400 flex-shrink-0" /></span>
                            )}
                            {(() => {
                              const url = (row.details as any)?.profile_pic_url ?? "";
                              return (!url || url.includes("default")) ? (
                                <span aria-label="Sem foto"><ImageOff className="w-3 h-3 text-muted-foreground flex-shrink-0" /></span>
                              ) : null;
                            })()}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {row.campaign_id && campaignNames[row.campaign_id]
                            ? <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{campaignNames[row.campaign_id]}</span>
                            : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border", SOURCE_COLORS[row.source ?? "manual"] ?? SOURCE_COLORS.manual)}>
                            {SOURCE_LABELS[row.source ?? "manual"] ?? row.source}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border", STATUS_COLORS[row.status ?? "pending"] ?? STATUS_COLORS.pending)}>
                            {row.status ?? "pending"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {row.created_at ? formatDistanceToNow(new Date(row.created_at), { addSuffix: true, locale: ptBR }) : "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {row.processed_at ? formatDistanceToNow(new Date(row.processed_at), { addSuffix: true, locale: ptBR }) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {row.status === "pending" || row.status === "injected" ? (
                            <button
                              onClick={() => skipTarget(row.id)}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              title="Pular este target"
                            >
                              <SkipForward className="w-3.5 h-3.5" />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                  <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                </Button>
                <span className="text-xs text-muted-foreground">
                  Página {page + 1} de {totalPages}
                </span>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                  Próxima <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Import Modal ── */}
      <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) { setImportText(""); importJsonItemsRef.current = {}; setImportFilterStats(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Importar Lista de Targets</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* File upload drop zone */}
            <label
              className="flex flex-col items-center justify-center gap-2 w-full h-20 rounded-lg border-2 border-dashed border-border bg-secondary/50 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
              const file = e.dataTransfer.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const text = ev.target?.result as string;
                  const result = parseFileContent(text);
                  setImportText((prev) => [prev, result].filter(Boolean).join("\n"));
                };
                reader.readAsText(file);
              }}
            >
              <input
                type="file"
                accept=".txt,.csv,.text,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const text = ev.target?.result as string;
                    const result = parseFileContent(text);
                    setImportText((prev) => [prev, result].filter(Boolean).join("\n"));
                  };
                  reader.readAsText(file);
                  e.target.value = "";
                }}
              />
              <Upload className="w-5 h-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Arraste um arquivo <span className="text-primary font-medium">.txt / .csv / .json</span> ou clique para selecionar
              </span>
            </label>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground">ou cole manualmente</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="relative">
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={"@usuario1\n@usuario2\nusuario3"}
                className="w-full h-40 text-xs rounded-lg border border-border bg-secondary p-3 text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {importText && (
                <button
                  onClick={() => setImportText("")}
                  className="absolute top-2 right-2 text-muted-foreground hover:text-foreground text-[10px] px-1.5 py-0.5 rounded border border-border bg-card"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Auto-filter options for JSON imports */}
            {importFilterStats && (
              <div className="space-y-2 rounded-lg border border-border bg-secondary/50 p-3">
                <p className="text-[10px] font-medium text-foreground">Filtros automáticos</p>
                <div className="flex items-center gap-2">
                  <Checkbox id="import-filter-private" checked={importFilterPrivate} onCheckedChange={(v) => setImportFilterPrivate(!!v)} />
                  <label htmlFor="import-filter-private" className="text-[11px] text-muted-foreground cursor-pointer">
                    Remover contas privadas <span className="text-destructive font-medium">({importFilterStats.removedPrivate})</span>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="import-filter-nophoto" checked={importFilterNoPhoto} onCheckedChange={(v) => setImportFilterNoPhoto(!!v)} />
                  <label htmlFor="import-filter-nophoto" className="text-[11px] text-muted-foreground cursor-pointer">
                    Remover perfis sem foto <span className="text-destructive font-medium">({importFilterStats.removedNoPhoto})</span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {importUsernames.length}
                </span>{" "}
                username(s) após filtros
                {importFilterStats && importUsernames.length < importFilterStats.total && (
                  <span className="text-destructive ml-1">
                    ({importFilterStats.total - importUsernames.length} removido{importFilterStats.total - importUsernames.length > 1 ? "s" : ""})
                  </span>
                )}
              </p>
              {importUsernames.length > 0 && (
                <p className="text-[10px] text-primary">Pronto para importar</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => { setImportOpen(false); setImportText(""); }}>Cancelar</Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={importUsernames.length === 0}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Upload className="w-3.5 h-3.5" />
              Importar {importUsernames.length > 0 ? `(${importUsernames.length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Manual Entry Modal ── */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Adicionar Manualmente</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Cole os usernames, um por linha:</p>
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder={"@usuario1\n@usuario2"}
              className="w-full h-40 text-xs rounded-lg border border-border bg-secondary p-3 text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => setManualOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleManual} disabled={!manualText.trim()}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Manual Profile Pic Modal ── */}
      <Dialog open={manualPicOpen} onOpenChange={(open) => { setManualPicOpen(open); if (!open) setManualPicUrl(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Atualizar Foto de Perfil</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Não foi possível buscar a foto automaticamente (Instagram bloqueia servidores).
            Cole a URL da foto de perfil abaixo. Você pode copiar a URL clicando com o botão direito na foto do perfil no Instagram e selecionando "Copiar endereço da imagem".
          </p>
          <Input
            placeholder="https://instagram.f..."
            value={manualPicUrl}
            onChange={(e) => setManualPicUrl(e.target.value)}
            className="text-xs"
          />
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => setManualPicOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleManualPicSave} disabled={!manualPicUrl.trim() || loadingCmd === "update_profile_pic"}>
              {loadingCmd === "update_profile_pic" ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
