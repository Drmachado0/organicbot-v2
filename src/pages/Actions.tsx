import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { List, Search, RefreshCw } from "lucide-react";

interface ActionRow {
  id: string;
  executed_at: string | null;
  action_type: string;
  target_username: string | null;
  status: string;
  ig_account_id: string | null;
  isNew?: boolean;
}

interface IgAccount {
  id: string;
  ig_username: string;
}

const STATUS_COLOR: Record<string, string> = {
  success: "hsl(152 72% 48%)",
  failed:  "hsl(0 72% 55%)",
  skipped: "hsl(42 96% 56%)",
};

const ACTION_COLOR: Record<string, string> = {
  follow:   "hsl(152 72% 48%)",
  unfollow: "hsl(0 72% 55%)",
  like:     "hsl(320 65% 60%)",
  comment:  "hsl(252 62% 60%)",
};

const MAX_ACTIONS = 200;

export default function Actions() {
  const { user } = useAuth();
  const [igAccounts, setIgAccounts] = useState<IgAccount[]>([]);
  const [filterAccountId, setFilterAccountId] = useState<string>("all");
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const newBadgeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Load IG accounts for account filter
  useEffect(() => {
    if (!user) return;
    supabase
      .from("ig_accounts")
      .select("id, ig_username")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at")
      .then(({ data }) => setIgAccounts((data ?? []) as IgAccount[]));
  }, [user]);

  const load = useCallback(async (p = 0) => {
    if (!user) return;
    setIsLoading(true);
    let q = supabase
      .from("action_log")
      .select("id, executed_at, action_type, target_username, status, ig_account_id")
      .order("executed_at", { ascending: false })
      .range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1);

    // Filter by specific account or by user's accounts
    if (filterAccountId !== "all") {
      q = q.eq("ig_account_id", filterAccountId);
    } else {
      const accountIds = igAccounts.map((a) => a.id);
      if (accountIds.length > 0) {
        q = q.in("ig_account_id", accountIds);
      } else {
        q = q.eq("user_id", user.id);
      }
    }

    if (filterType !== "all") q = q.eq("action_type", filterType);
    if (filterStatus !== "all") q = q.eq("status", filterStatus);

    const { data, error } = await q;
    if (error) toast.error("Erro ao carregar ações");
    else setActions(p === 0 ? (data ?? []) : (prev) => [...prev, ...(data ?? [])] as ActionRow[]);
    setIsLoading(false);
  }, [user, filterType, filterStatus, filterAccountId]);

  useEffect(() => { setPage(0); load(0); }, [load]);

  // Realtime subscription — filtra por ig_account_id (mais preciso que user_id)
  useEffect(() => {
    if (!user) return;

    // Choose the best realtime filter: specific account or user-level
    const realtimeFilter = filterAccountId !== "all"
      ? `ig_account_id=eq.${filterAccountId}`
      : `user_id=eq.${user.id}`;

    const channel = supabase
      .channel(`actions-realtime-${user.id}-${filterAccountId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "action_log", filter: realtimeFilter },
        (payload) => {
          const newRow = payload.new as ActionRow;

          // Only show if it matches current filters
          const matchesType = filterType === "all" || newRow.action_type === filterType;
          const matchesStatus = filterStatus === "all" || newRow.status === filterStatus;
          const matchesAccount = filterAccountId === "all" || newRow.ig_account_id === filterAccountId;
          if (!matchesType || !matchesStatus || !matchesAccount) return;

          setActions((prev) => {
            const withNew = [{ ...newRow, isNew: true }, ...prev].slice(0, MAX_ACTIONS);
            return withNew;
          });

          // Remove "new" badge after 3s
          const timer = setTimeout(() => {
            setActions((prev) =>
              prev.map((a) => (a.id === newRow.id ? { ...a, isNew: false } : a))
            );
            newBadgeTimers.current.delete(newRow.id);
          }, 3000);
          newBadgeTimers.current.set(newRow.id, timer);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      newBadgeTimers.current.forEach((t) => clearTimeout(t));
      newBadgeTimers.current.clear();
    };
  }, [user, filterType, filterStatus, filterAccountId]);

  const loadMore = () => { const next = page + 1; setPage(next); load(next); };

  const filtered = actions.filter((a) =>
    !search || (a.target_username ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <div className="flex flex-wrap items-center gap-3 mb-6 animate-fade-in">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <List className="h-5 w-5 text-primary flex-shrink-0" />
          <h1 className="text-xl font-bold tracking-tight">Log de Ações</h1>
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 ml-1">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: "hsl(152 72% 48%)" }}
            />
            <span className="text-xs text-muted-foreground">live</span>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" onClick={() => load(0)} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por usuário…" className="pl-8 bg-secondary/50 border-border/60 h-9 text-sm" />
        </div>
        {igAccounts.length > 1 && (
          <Select value={filterAccountId} onValueChange={(v) => { setFilterAccountId(v); setPage(0); }}>
            <SelectTrigger className="w-40 h-9 text-sm glass-card border-border/60">
              <SelectValue placeholder="Conta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {igAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>@{a.ig_username}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 h-9 text-sm glass-card border-border/60">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="follow">Follow</SelectItem>
            <SelectItem value="unfollow">Unfollow</SelectItem>
            <SelectItem value="like">Like</SelectItem>
            <SelectItem value="comment">Comment</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-9 text-sm glass-card border-border/60">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="success">Sucesso</SelectItem>
            <SelectItem value="failed">Falha</SelectItem>
            <SelectItem value="skipped">Ignorado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden animate-fade-in">
        {isLoading && actions.length === 0 ? (
          <div className="p-4 space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <List className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma ação encontrada</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    {["Data / Hora", "Tipo", "Target", "Status", ""].map((h) => (
                      <th key={h} className="text-left py-2.5 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr
                      key={a.id}
                      className={`border-b border-border/10 hover:bg-muted/20 transition-colors ${a.isNew ? "animate-fade-in" : ""}`}
                      style={a.isNew ? { backgroundColor: "hsl(152 72% 48% / 0.05)" } : {}}
                    >
                      <td className="py-2.5 px-4 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {a.executed_at ? new Date(a.executed_at).toLocaleString("pt-BR") : "—"}
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge
                          className="text-xs capitalize"
                          style={{
                            backgroundColor: `${ACTION_COLOR[a.action_type.toLowerCase()] ?? "hsl(215 20% 45%)"}/15`,
                            color: ACTION_COLOR[a.action_type.toLowerCase()] ?? "hsl(215 20% 65%)",
                            border: `1px solid ${ACTION_COLOR[a.action_type.toLowerCase()] ?? "hsl(215 20% 45%)"}/30`,
                          }}
                        >
                          {a.action_type}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 font-medium">
                        {a.target_username ? `@${a.target_username}` : "—"}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: STATUS_COLOR[a.status] ?? "hsl(215 20% 45%)" }}
                          />
                          <span
                            className="text-xs capitalize"
                            style={{ color: STATUS_COLOR[a.status] ?? "hsl(215 20% 55%)" }}
                          >
                            {a.status}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {a.isNew && (
                          <span
                            className="text-xs font-semibold px-1.5 py-0.5 rounded-full animate-pulse"
                            style={{ backgroundColor: "hsl(152 72% 48% / 0.15)", color: "hsl(152 72% 48%)" }}
                          >
                            novo
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {actions.length % PAGE_SIZE === 0 && actions.length > 0 && (
              <div className="p-3 text-center border-t border-border/20">
                <Button variant="ghost" size="sm" onClick={loadMore} disabled={isLoading} className="text-xs text-muted-foreground">
                  {isLoading ? "Carregando…" : "Carregar mais"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
