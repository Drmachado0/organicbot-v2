import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Shield, Search, Trash2, UserPlus, X } from "lucide-react";

interface WhitelistEntry {
  id: string;
  username: string;
  full_name: string | null;
  reason: string | null;
  added_at: string | null;
  ig_user_id: string;
}

export default function Whitelist() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newReason, setNewReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("whitelist")
      .select("id, username, full_name, reason, added_at, ig_user_id")
      .eq("user_id", user.id)
      .order("added_at", { ascending: false });
    if (error) toast.error("Erro ao carregar whitelist");
    else setEntries((data ?? []) as WhitelistEntry[]);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const filtered = entries.filter((e) =>
    e.username.toLowerCase().includes(search.toLowerCase()) ||
    (e.full_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const addEntry = async () => {
    if (!user || !newUsername.trim()) { toast.error("Username é obrigatório"); return; }
    setIsSaving(true);
    const { error } = await supabase.from("whitelist").insert({
      user_id: user.id,
      username: newUsername.trim().replace(/^@/, ""),
      ig_user_id: `manual_${Date.now()}`,
      reason: newReason.trim() || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Adicionado à whitelist!"); setShowAdd(false); setNewUsername(""); setNewReason(""); load(); }
    setIsSaving(false);
  };

  const remove = async (id: string) => {
    if (!confirm("Remover da whitelist?")) return;
    const { error } = await supabase.from("whitelist").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); setEntries((p) => p.filter((e) => e.id !== id)); }
  };

  return (
    <AppShell>
      <div className="flex flex-wrap items-center gap-3 mb-6 animate-fade-in">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Shield className="h-5 w-5 text-primary flex-shrink-0" />
          <h1 className="text-xl font-bold tracking-tight">Whitelist</h1>
          <Badge variant="secondary" className="text-xs">{entries.length}</Badge>
        </div>
        <Button
          size="sm"
          className="h-9 gap-1.5 font-semibold"
          style={{ backgroundColor: "hsl(152 72% 48%)", color: "hsl(222 25% 6%)" }}
          onClick={() => setShowAdd((v) => !v)}
        >
          <UserPlus className="h-4 w-4" /> Adicionar
        </Button>
      </div>

      {showAdd && (
        <div className="glass-card rounded-2xl p-5 mb-5 animate-fade-in space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">Adicionar usuário</p>
            <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Username *</label>
              <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="@username" className="bg-secondary/50 border-border/60 h-9 text-sm" onKeyDown={(e) => e.key === "Enter" && addEntry()} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Motivo</label>
              <Input value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="Ex: cliente, parceiro" className="bg-secondary/50 border-border/60 h-9 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button size="sm" onClick={addEntry} disabled={isSaving} style={{ backgroundColor: "hsl(152 72% 48%)", color: "hsl(222 25% 6%)" }}>Salvar</Button>
          </div>
        </div>
      )}

      <div className="glass-card rounded-2xl overflow-hidden animate-fade-in">
        <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por username…" className="border-0 bg-transparent h-8 text-sm focus-visible:ring-0 p-0" />
        </div>
        {isLoading ? (
          <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{search ? "Nenhum resultado encontrado" : "Whitelist vazia"}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/20">
                {["Username", "Nome", "Motivo", "Adicionado em", ""].map((h) => (
                  <th key={h} className="text-left py-2.5 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-border/10 hover:bg-muted/20 transition-colors">
                  <td className="py-2.5 px-4 font-medium text-primary">@{e.username}</td>
                  <td className="py-2.5 px-4 text-muted-foreground">{e.full_name ?? "—"}</td>
                  <td className="py-2.5 px-4"><Badge variant="secondary" className="text-xs">{e.reason ?? "—"}</Badge></td>
                  <td className="py-2.5 px-4 text-xs text-muted-foreground">{e.added_at ? new Date(e.added_at).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="py-2.5 px-4">
                    <button onClick={() => remove(e.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
