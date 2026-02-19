import { useState, useEffect, useCallback, useRef } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
}

// ── Helpers ────────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  followers: "Seguidores",
  following: "Seguindo",
  hashtag: "Hashtag",
  location: "Localização",
};

const SOURCE_COLORS: Record<string, string> = {
  manual: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  followers: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  following: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  hashtag: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  location: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
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
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingRows, setPendingRows] = useState<TargetRow[]>([]);
  const [allRows, setAllRows] = useState<TargetRow[]>([]);

  // UI states
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [manualText, setManualText] = useState("");
  const [hashtagInput, setHashtagInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [delayValue, setDelayValue] = useState(60);
  const [loadingCmd, setLoadingCmd] = useState<string | null>(null);

  // Filters for Aba 2
  const [searchQ, setSearchQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

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

  const loadQueue = useCallback(async () => {
    if (!accountId) return;
    const { data } = await supabase
      .from("target_queue")
      .select("id, username, source, status, priority, created_at, processed_at")
      .eq("ig_account_id", accountId)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1000);

    const rows = (data ?? []) as TargetRow[];
    setAllRows(rows);
    const pending = rows.filter((r) => r.status === "pending" || r.status === "injected");
    setPendingCount(pending.length);
    setPendingRows(pending);
  }, [accountId]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

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

  // ── Export ───────────────────────────────────────────────────────────────

  const exportJSON = () => {
    downloadFile(JSON.stringify(pendingRows, null, 2), "queue.json", "application/json");
  };
  const exportCSV = () => {
    const header = "username,source,created_at";
    const rows = pendingRows.map((r) => `${r.username},${r.source ?? ""},${r.created_at ?? ""}`);
    downloadFile([header, ...rows].join("\n"), "queue.csv", "text/csv");
  };
  const exportTXT = () => {
    downloadFile(pendingRows.map((r) => r.username).join("\n"), "queue.txt", "text/plain");
  };

  // ── Import ───────────────────────────────────────────────────────────────

  const handleImport = async () => {
    const usernames = importText.split("\n").map((u) => u.trim().replace(/^@/, "")).filter(Boolean);
    if (!usernames.length || !accountId) return;
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

  const isOnline = account?.bot_online ?? false;

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

              {/* Import + Clear */}
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" className="text-xs h-8 flex-1" onClick={() => setImportOpen(true)}>
                  <Upload className="w-3 h-3" /> Importar Lista
                </Button>
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

            {/* FILTROS (colapsível) */}
            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
              <div className="rounded-xl border border-border bg-card">
                <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Filtros Ativos</p>
                  {filtersOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-3">
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
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-foreground">Delay entre ações (s)</p>
                        <p className="text-[10px] text-muted-foreground">Pausa após cada follow/like</p>
                      </div>
                      <Input
                        type="number"
                        min={5}
                        max={300}
                        value={delayValue}
                        onChange={(e) => setDelayValue(Number(e.target.value))}
                        className="w-20 h-8 text-xs text-center border-border bg-secondary"
                      />
                      <Button size="sm" className="h-8 text-xs" onClick={async () => {
                        if (!user) return;
                        const { data: existing } = await supabase.from("user_settings").select("settings_json").eq("user_id", user.id).maybeSingle();
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const prevJson: any = existing?.settings_json ?? {};
                        await supabase.from("user_settings").upsert({ user_id: user.id, settings_json: { ...prevJson, wait_after_action: delayValue } as never }, { onConflict: "user_id" });
                        toast({ title: "Delay salvo" });
                      }}>
                        Salvar
                      </Button>
                    </div>
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
                    <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Fonte</th>
                    <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Status</th>
                    <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Prioridade</th>
                    <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Adicionado</th>
                    <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Processado</th>
                    <th className="px-3 py-2.5 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-muted-foreground py-12">
                        Nenhum target encontrado.
                      </td>
                    </tr>
                  ) : (
                    pagedRows.map((row) => (
                      <tr key={row.id} className="border-b border-border/50 hover:bg-secondary/40 transition-colors">
                        <td className="px-3 py-2 font-medium text-foreground">@{row.username}</td>
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
                        <td className="px-3 py-2 text-muted-foreground">{row.priority ?? 0}</td>
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
      <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) setImportText(""); }}>
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
                reader.onload = (ev) => setImportText((prev) => [prev, ev.target?.result as string].filter(Boolean).join("\n"));
                reader.readAsText(file);
              }}
            >
              <input
                type="file"
                accept=".txt,.csv,.text"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => setImportText((prev) => [prev, ev.target?.result as string].filter(Boolean).join("\n"));
                  reader.readAsText(file);
                  e.target.value = "";
                }}
              />
              <Upload className="w-5 h-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Arraste um arquivo <span className="text-primary font-medium">.txt / .csv</span> ou clique para selecionar
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

            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {importText.split("\n").filter((u) => u.trim()).length}
                </span>{" "}
                username(s) detectado(s)
              </p>
              {importText.split("\n").filter((u) => u.trim()).length > 0 && (
                <p className="text-[10px] text-primary">Pronto para importar</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => { setImportOpen(false); setImportText(""); }}>Cancelar</Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={!importText.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Upload className="w-3.5 h-3.5" />
              Importar {importText.split("\n").filter((u) => u.trim()).length > 0 ? `(${importText.split("\n").filter((u) => u.trim()).length})` : ""}
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
    </AppShell>
  );
}
