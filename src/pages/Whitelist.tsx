import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Shield,
  Search,
  Trash2,
  UserPlus,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

interface WhitelistEntry {
  id: string;
  username: string;
  full_name: string | null;
  reason: string | null;
  added_at: string | null;
  ig_user_id: string;
}

const PAGE_SIZE = 20;

export default function Whitelist() {
  const { user } = useAuth();

  // list state
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // add form state
  const [showAdd, setShowAdd] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newReason, setNewReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [usernameError, setUsernameError] = useState("");

  // delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<WhitelistEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // debounce search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const load = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    let q = supabase
      .from("whitelist")
      .select("id, username, full_name, reason, added_at, ig_user_id", { count: "exact" })
      .eq("user_id", user.id)
      .order("added_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (debouncedSearch.trim()) {
      q = q.ilike("username", `%${debouncedSearch.trim().replace(/^@/, "")}%`);
    }

    const { data, error, count } = await q;
    if (error) toast.error("Erro ao carregar whitelist");
    else {
      setEntries((data ?? []) as WhitelistEntry[]);
      setTotalCount(count ?? 0);
    }
    setIsLoading(false);
  }, [user, page, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // ── Add entry ──────────────────────────────────────────────
  const validateUsername = (v: string) => {
    const clean = v.trim().replace(/^@/, "");
    if (!clean) return "Username é obrigatório";
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(clean)) return "Username inválido (só letras, números, . e _)";
    return "";
  };

  const addEntry = async () => {
    const err = validateUsername(newUsername);
    if (err) { setUsernameError(err); return; }
    if (!user) return;

    setIsSaving(true);
    const clean = newUsername.trim().replace(/^@/, "");
    const { error } = await supabase.from("whitelist").insert({
      user_id: user.id,
      username: clean,
      ig_user_id: `manual_${Date.now()}`,
      reason: newReason.trim() || null,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`@${clean} adicionado à whitelist!`);
      setShowAdd(false);
      setNewUsername("");
      setNewReason("");
      setUsernameError("");
      setPage(0);
      load();
    }
    setIsSaving(false);
  };

  // ── Remove entry ───────────────────────────────────────────
  const confirmRemove = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const { error } = await supabase.from("whitelist").delete().eq("id", deleteTarget.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`@${deleteTarget.username} removido`);
      setDeleteTarget(null);
      // if last item on page, go back
      if (entries.length === 1 && page > 0) setPage((p) => p - 1);
      else load();
    }
    setIsDeleting(false);
  };

  return (
    <AppShell>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3 mb-6 animate-fade-in">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Shield className="h-5 w-5 text-primary flex-shrink-0" />
          <h1 className="text-xl font-bold tracking-tight">Whitelist</h1>
          {!isLoading && (
            <Badge variant="secondary" className="text-xs tabular-nums">{totalCount}</Badge>
          )}
        </div>
        <Button
          size="sm"
          className="h-9 gap-1.5 font-semibold"
          style={{ backgroundColor: "hsl(152 72% 48%)", color: "hsl(222 25% 6%)" }}
          onClick={() => { setShowAdd((v) => !v); setUsernameError(""); }}
        >
          <UserPlus className="h-4 w-4" />
          {showAdd ? "Cancelar" : "Adicionar"}
        </Button>
      </div>

      {/* ── Add Form ── */}
      {showAdd && (
        <div className="glass-card rounded-2xl p-5 mb-5 animate-fade-in space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">Adicionar usuário à whitelist</p>
            <button
              onClick={() => { setShowAdd(false); setUsernameError(""); }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Username <span className="text-destructive">*</span>
              </label>
              <Input
                value={newUsername}
                onChange={(e) => { setNewUsername(e.target.value); setUsernameError(""); }}
                placeholder="@username"
                className={`bg-secondary/50 border-border/60 h-9 text-sm ${usernameError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                onKeyDown={(e) => e.key === "Enter" && addEntry()}
                maxLength={32}
                autoFocus
              />
              {usernameError && (
                <p className="text-xs text-destructive">{usernameError}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Motivo</label>
              <Input
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Ex: cliente, parceiro, amigo"
                className="bg-secondary/50 border-border/60 h-9 text-sm"
                maxLength={80}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowAdd(false); setUsernameError(""); }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={addEntry}
              disabled={isSaving}
              style={{ backgroundColor: "hsl(152 72% 48%)", color: "hsl(222 25% 6%)" }}
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Table card ── */}
      <div className="glass-card rounded-2xl overflow-hidden animate-fade-in">
        {/* Search bar */}
        <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por username…"
            className="border-0 bg-transparent h-8 text-sm focus-visible:ring-0 p-0 placeholder:text-muted-foreground/60"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="p-14 text-center">
            <Shield className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {debouncedSearch ? `Nenhum resultado para "${debouncedSearch}"` : "Whitelist vazia"}
            </p>
            {!debouncedSearch && (
              <p className="text-xs text-muted-foreground/60 mt-1">
                Adicione usuários que não devem ser seguidos ou curtidos pelo bot
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  {["Username", "Nome completo", "Motivo", "Adicionado em", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left py-2.5 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-border/10 hover:bg-muted/20 transition-colors group"
                  >
                    <td className="py-2.5 px-4 font-semibold text-primary whitespace-nowrap">
                      @{e.username}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground">
                      {e.full_name ?? <span className="opacity-40">—</span>}
                    </td>
                    <td className="py-2.5 px-4">
                      {e.reason ? (
                        <Badge variant="secondary" className="text-xs font-normal">
                          {e.reason}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                      {e.added_at
                        ? new Date(e.added_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => setDeleteTarget(e)}
                        className="text-muted-foreground/40 hover:text-destructive transition-colors p-1 rounded opacity-0 group-hover:opacity-100"
                        title="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalCount > PAGE_SIZE && (
          <div className="border-t border-border/20 px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} de{" "}
              <span className="font-medium text-foreground">{totalCount}</span>
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={page === 0 || isLoading}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground px-1 tabular-nums">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={page >= totalPages - 1 || isLoading}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Delete confirm dialog ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover da whitelist?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário{" "}
              <span className="font-semibold text-foreground">@{deleteTarget?.username}</span>{" "}
              poderá ser seguido ou curtido pelo bot novamente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
