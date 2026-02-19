import { useState, useEffect, useCallback } from "react";
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

export default function Actions() {
  const { user } = useAuth();
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const load = useCallback(async (p = 0) => {
    if (!user) return;
    setIsLoading(true);
    let q = supabase
      .from("action_log")
      .select("id, executed_at, action_type, target_username, status")
      .eq("user_id", user.id)
      .order("executed_at", { ascending: false })
      .range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1);

    if (filterType !== "all") q = q.eq("action_type", filterType);
    if (filterStatus !== "all") q = q.eq("status", filterStatus);

    const { data, error } = await q;
    if (error) toast.error("Erro ao carregar ações");
    else setActions(p === 0 ? (data ?? []) : (prev) => [...prev, ...(data ?? [])] as ActionRow[]);
    setIsLoading(false);
  }, [user, filterType, filterStatus]);

  useEffect(() => { setPage(0); load(0); }, [load]);

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
                    {["Data / Hora", "Tipo", "Target", "Status"].map((h) => (
                      <th key={h} className="text-left py-2.5 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id} className="border-b border-border/10 hover:bg-muted/20 transition-colors">
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
