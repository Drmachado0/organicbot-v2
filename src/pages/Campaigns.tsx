import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Target,
  Hash,
  Users,
  MapPin,
  Pencil,
  Trash2,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
  Loader2,
  ListOrdered,
  Eraser,
  RefreshCw,
  Zap,
} from "lucide-react";

interface CampaignQueueStats {
  pending: number;
  processing: number;
  done: number;
}

interface Campaign {
  id: string;
  name: string;
  niche: string | null;
  location: string | null;
  hashtags: string[];
  competitors: string[];
  is_active: boolean;
  created_at: string;
  ig_account_id: string | null;
  queue: CampaignQueueStats;
}

interface TagInputProps {
  label: string;
  icon: React.ReactNode;
  tags: string[];
  placeholder: string;
  prefix?: string;
  onChange: (tags: string[]) => void;
}

function TagInput({ label, icon, tags, placeholder, prefix = "", onChange }: TagInputProps) {
  const [inputVal, setInputVal] = useState("");

  const add = () => {
    const raw = inputVal.trim().replace(/^[#@]/, "");
    if (!raw || tags.includes(raw)) { setInputVal(""); return; }
    onChange([...tags, raw]);
    setInputVal("");
  };

  const remove = (t: string) => onChange(tags.filter((x) => x !== t));

  return (
    <div className="space-y-2">
      <Label className="text-sm text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </Label>
      <div className="flex gap-2">
        <Input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder={placeholder}
          className="bg-secondary/50 border-border/60 focus:border-primary h-9 text-sm"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <Button type="button" variant="outline" size="sm" className="h-9 px-3" onClick={add}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tags.map((t) => (
            <Badge
              key={t}
              variant="secondary"
              className="flex items-center gap-1 text-xs pr-1 cursor-default"
              style={{ backgroundColor: "hsl(220 18% 18%)", border: "1px solid hsl(220 18% 28%)" }}
            >
              <span className="text-muted-foreground">{prefix}</span>{t}
              <button
                type="button"
                onClick={() => remove(t)}
                className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

const EMPTY_FORM = {
  name: "",
  niche: "",
  location: "",
  hashtags: [] as string[],
  competitors: [] as string[],
  is_active: false,
};

// ─── Helper: group queue rows by campaign_id ─────────────────────────────────

function buildQueueStatsMap(rows: { campaign_id: string | null; status: string }[]): Record<string, CampaignQueueStats> {
  const map: Record<string, CampaignQueueStats> = {};
  for (const r of rows) {
    const key = r.campaign_id ?? "__none__";
    if (!map[key]) map[key] = { pending: 0, processing: 0, done: 0 };
    if (r.status === "pending" || r.status === "injected") map[key].pending++;
    else if (r.status === "processing") map[key].processing++;
    else if (r.status === "done") map[key].done++;
  }
  return map;
}

// ─── Inject Targets Modal ────────────────────────────────────────────────────

interface InjectModalProps {
  campaign: Campaign;
  igAccountId: string;
  onClose: () => void;
  onInjected: () => void;
}

function InjectModal({ campaign, igAccountId, onClose, onInjected }: InjectModalProps) {
  const [isInjecting, setIsInjecting] = useState(false);

  const totalTargets = campaign.competitors.length;

  const handleInject = async () => {
    if (!igAccountId || campaign.competitors.length === 0) return;
    setIsInjecting(true);
    try {
      const { data, error } = await supabase.rpc("add_targets_batch", {
        p_ig_account_id: igAccountId,
        p_usernames: campaign.competitors,
        p_source: "campaign",
        p_campaign_id: campaign.id,
      } as any);
      if (error) throw error;
      const added = typeof data === "number" ? data : 0;
      const skipped = totalTargets - added;

      await supabase.rpc("send_bot_command", {
        p_ig_account_id: igAccountId,
        p_command: "sync_queue",
        p_params: {},
      });

      if (added === 0) {
        toast.info("Todos os targets já estavam na fila");
      } else if (skipped > 0) {
        toast.success(`${added} targets adicionados (${skipped} já existiam) — Fila sincronizada!`);
      } else {
        toast.success(`${added} targets adicionados — Fila sincronizada com a extensão!`);
      }
      onInjected();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao injetar targets");
    } finally {
      setIsInjecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "hsl(222 25% 4% / 0.8)" }}>
      <div
        className="glass-card rounded-2xl p-6 w-full max-w-md space-y-5 animate-fade-in"
        style={{ border: "1px solid hsl(152 72% 48% / 0.3)" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4" style={{ color: "hsl(152 72% 48%)" }} />
              <h2 className="font-semibold text-base">Injetar Targets</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Adicionar concorrentes da campanha à fila de targets
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className="rounded-xl p-3 space-y-1.5"
          style={{ backgroundColor: "hsl(220 18% 10%)", border: "1px solid hsl(220 18% 18%)" }}
        >
          <p className="text-sm font-medium">{campaign.name}</p>
          <div className="flex flex-wrap gap-1.5">
            {campaign.competitors.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum concorrente configurado nesta campanha</p>
            ) : (
              campaign.competitors.map((c) => (
                <Badge key={c} className="text-xs" style={{ backgroundColor: "hsl(42 96% 56% / 0.12)", color: "hsl(42 96% 56%)", border: "1px solid hsl(42 96% 56% / 0.25)" }}>
                  @{c}
                </Badge>
              ))
            )}
          </div>
          {campaign.competitors.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {campaign.competitors.length} concorrente{campaign.competitors.length !== 1 ? "s" : ""} serão adicionados à fila
            </p>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose} className="flex-1 h-9">Cancelar</Button>
          <Button
            size="sm"
            onClick={handleInject}
            disabled={isInjecting || !igAccountId || campaign.competitors.length === 0}
            className="flex-1 h-9 gap-1.5 font-semibold"
            style={{ backgroundColor: "hsl(152 72% 48%)", color: "hsl(222 25% 6%)" }}
          >
            {isInjecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            {isInjecting ? "Injetando…" : "Injetar Targets"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Global Queue Panel ─────────────────────────────────────────────────────

function GlobalQueuePanel({ igAccountId, refreshKey }: { igAccountId: string; refreshKey: number }) {
  const [stats, setStats] = useState<{ pending: number; processing: number; done: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);

  const loadStats = useCallback(async () => {
    if (!igAccountId) return;
    setLoading(true);
    const [pendingRes, processingRes, doneRes] = await Promise.all([
      supabase.from("target_queue").select("id", { count: "exact", head: true }).eq("ig_account_id", igAccountId).in("status", ["pending", "injected"]),
      supabase.from("target_queue").select("id", { count: "exact", head: true }).eq("ig_account_id", igAccountId).eq("status", "processing"),
      supabase.from("target_queue").select("id", { count: "exact", head: true }).eq("ig_account_id", igAccountId).eq("status", "done"),
    ]);
    setStats({ pending: pendingRes.count ?? 0, processing: processingRes.count ?? 0, done: doneRes.count ?? 0 });
    setLoading(false);
  }, [igAccountId]);

  useEffect(() => { loadStats(); }, [loadStats, refreshKey]);

  useEffect(() => {
    if (!igAccountId) return;
    const channel = supabase
      .channel(`global-queue-${igAccountId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "target_queue", filter: `ig_account_id=eq.${igAccountId}` }, () => loadStats())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [igAccountId, loadStats]);

  const handleClear = async () => {
    if (!igAccountId) return;
    setClearing(true);
    try {
      const { data, error } = await supabase.rpc("clear_target_queue", { p_ig_account_id: igAccountId, p_status: "all" });
      if (error) throw error;
      toast.success(`${data} targets removidos da fila`);
      loadStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao limpar fila");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4 animate-fade-in" style={{ border: "1px solid hsl(252 62% 60% / 0.2)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListOrdered className="h-4 w-4" style={{ color: "hsl(252 62% 60%)" }} />
          <p className="text-sm font-semibold">Fila Global de Targets</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => loadStats()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {loading || !stats ? (
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Pendentes", value: stats.pending, color: "hsl(42 96% 56%)" },
            { label: "Processando", value: stats.processing, color: "hsl(252 62% 60%)" },
            { label: "Concluídos", value: stats.done, color: "hsl(152 72% 48%)" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl p-3 text-center" style={{ backgroundColor: "hsl(220 18% 10%)", border: `1px solid ${color}20` }}>
              <p className="text-xl font-bold tabular-nums" style={{ color }}>{value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-border/20">
        <p className="text-xs text-muted-foreground">
          {stats ? `Total: ${(stats.pending + stats.processing + stats.done).toLocaleString()} targets` : ""}
        </p>
        <Button
          variant="ghost" size="sm"
          className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleClear}
          disabled={clearing || !stats || stats.pending + stats.processing === 0}
        >
          {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eraser className="h-3.5 w-3.5" />}
          Limpar toda a fila
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function Campaigns() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<{ id: string; ig_username: string }[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [injectCampaign, setInjectCampaign] = useState<Campaign | null>(null);
  const [queueRefreshKey, setQueueRefreshKey] = useState(0);

  // Load accounts
  useEffect(() => {
    if (!user) return;
    supabase
      .from("ig_accounts")
      .select("id, ig_username")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at")
      .then(({ data }) => {
        const accs = (data ?? []) as { id: string; ig_username: string }[];
        setAccounts(accs);
        if (accs.length > 0) setSelectedAccountId(accs[0].id);
      });
  }, [user]);

  // Load campaigns + queue stats grouped by campaign_id
  const load = useCallback(async () => {
    if (!user || !selectedAccountId) return;
    setIsLoading(true);

    const [campRes, queueRes] = await Promise.all([
      supabase
        .from("targeting_campaigns")
        .select("*")
        .eq("user_id", user.id)
        .eq("ig_account_id", selectedAccountId)
        .order("created_at", { ascending: false }),
      supabase
        .from("target_queue")
        .select("campaign_id, status")
        .eq("ig_account_id", selectedAccountId),
    ]);

    if (campRes.error) {
      toast.error("Erro ao carregar campanhas");
      setIsLoading(false);
      return;
    }

    const statsMap = buildQueueStatsMap((queueRes.data ?? []) as { campaign_id: string | null; status: string }[]);

    setCampaigns(
      (campRes.data ?? []).map((c) => ({
        ...c,
        hashtags: Array.isArray(c.hashtags) ? (c.hashtags as string[]) : [],
        competitors: Array.isArray(c.competitors) ? (c.competitors as string[]) : [],
        niche: c.niche ?? null,
        location: c.location ?? null,
        ig_account_id: c.ig_account_id ?? null,
        queue: statsMap[c.id] ?? { pending: 0, processing: 0, done: 0 },
      }))
    );
    setIsLoading(false);
  }, [user, selectedAccountId]);

  useEffect(() => { load(); }, [load]);

  // Realtime: targeting_campaigns + target_queue changes → reload
  useEffect(() => {
    if (!selectedAccountId || !user) return;
    const channel = supabase
      .channel(`campaigns-rt-${selectedAccountId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "targeting_campaigns", filter: `ig_account_id=eq.${selectedAccountId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "target_queue", filter: `ig_account_id=eq.${selectedAccountId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedAccountId, user, load]);

  const openNew = () => { setEditId(null); setForm({ ...EMPTY_FORM }); setShowForm(true); };

  const openEdit = (c: Campaign) => {
    setEditId(c.id);
    setForm({ name: c.name, niche: c.niche ?? "", location: c.location ?? "", hashtags: [...c.hashtags], competitors: [...c.competitors], is_active: c.is_active });
    setShowForm(true);
    setExpandedId(null);
  };

  const cancel = () => { setShowForm(false); setEditId(null); setForm({ ...EMPTY_FORM }); };

  const save = async () => {
    if (!user || !selectedAccountId) return;
    if (!form.name.trim()) { toast.error("Nome da campanha é obrigatório"); return; }
    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        niche: form.niche.trim() || null,
        location: form.location.trim() || null,
        hashtags: form.hashtags,
        competitors: form.competitors,
        is_active: form.is_active,
        user_id: user.id,
        ig_account_id: selectedAccountId,
      };
      if (editId) {
        const { error } = await supabase.from("targeting_campaigns").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editId);
        if (error) throw error;
        toast.success("Campanha atualizada!");
      } else {
        const { error } = await supabase.from("targeting_campaigns").insert(payload);
        if (error) throw error;
        toast.success("Campanha criada!");
      }
      cancel();
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (c: Campaign) => {
    const { error } = await supabase.from("targeting_campaigns").update({ is_active: !c.is_active, updated_at: new Date().toISOString() }).eq("id", c.id);
    if (error) { toast.error("Erro ao atualizar status"); return; }
    setCampaigns((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_active: !x.is_active } : x)));
    toast.success(!c.is_active ? "Campanha ativada" : "Campanha desativada");
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta campanha?")) return;
    const { error } = await supabase.from("targeting_campaigns").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    toast.success("Campanha excluída");
  };

  const clearCampaignQueue = async (campaignId: string) => {
    if (!selectedAccountId) return;
    const { error, count } = await supabase
      .from("target_queue")
      .delete({ count: "exact" })
      .eq("campaign_id", campaignId)
      .eq("ig_account_id", selectedAccountId);
    if (error) { toast.error("Erro ao limpar fila da campanha"); return; }
    toast.success(`${count ?? 0} targets removidos da fila desta campanha`);
    setQueueRefreshKey((k) => k + 1);
    load();
  };

  const activeCampaigns = campaigns.filter((c) => c.is_active);
  const inactiveCampaigns = campaigns.filter((c) => !c.is_active);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5" style={{ color: "hsl(152 72% 48%)" }} />
            <h1 className="text-xl font-bold tracking-tight">Campanhas de Targeting</h1>
          </div>
          <div className="flex items-center gap-3">
            {accounts.length > 1 && (
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="h-9 text-xs w-40 glass-card border-border/60">
                  <SelectValue placeholder="Conta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>@{a.ig_username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {accounts.length === 1 && (
              <span className="text-xs text-muted-foreground">@{accounts[0]?.ig_username}</span>
            )}
            {!showForm && (
              <Button onClick={openNew} className="gap-1.5 h-9 font-semibold" style={{ backgroundColor: "hsl(152 72% 48%)", color: "hsl(222 25% 6%)" }} disabled={!selectedAccountId}>
                <Plus className="h-4 w-4" /> Nova Campanha
              </Button>
            )}
          </div>
        </div>

        {/* No account */}
        {!selectedAccountId && !isLoading && accounts.length === 0 && (
          <div className="glass-card rounded-2xl p-12 text-center animate-fade-in space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "hsl(42 96% 56% / 0.1)" }}>
              <Users className="h-7 w-7" style={{ color: "hsl(42 96% 56%)" }} />
            </div>
            <div>
              <p className="font-semibold">Nenhuma conta Instagram vinculada</p>
              <p className="text-sm text-muted-foreground mt-1">Vincule uma conta Instagram para criar campanhas de targeting.</p>
            </div>
          </div>
        )}

        {/* Form */}
        {showForm && selectedAccountId && (
          <div className="glass-card rounded-2xl p-6 mb-6 animate-fade-in space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base">{editId ? "Editar Campanha" : "Nova Campanha"}</h2>
              <button onClick={cancel} className="text-muted-foreground hover:text-foreground transition-colors"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Nome da Campanha <span className="text-destructive">*</span></Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Nicho Fitness Brasil" className="bg-secondary/50 border-border/60 focus:border-primary h-9 text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Nicho</Label>
                <Input value={form.niche} onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))} placeholder="Ex: fitness, nutrição, lifestyle" className="bg-secondary/50 border-border/60 focus:border-primary h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Localização</Label>
              <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Ex: São Paulo, Brasil" className="bg-secondary/50 border-border/60 focus:border-primary h-9 text-sm max-w-sm" />
            </div>
            <TagInput label="Hashtags" icon={<Hash className="h-3.5 w-3.5" />} tags={form.hashtags} placeholder="#fitness #saude" prefix="#" onChange={(tags) => setForm((f) => ({ ...f, hashtags: tags }))} />
            <TagInput label="Concorrentes / Perfis-alvo" icon={<Users className="h-3.5 w-3.5" />} tags={form.competitors} placeholder="@concorrente" prefix="@" onChange={(tags) => setForm((f) => ({ ...f, competitors: tags }))} />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40">
              <button type="button" onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                {form.is_active ? <ToggleRight className="h-5 w-5" style={{ color: "hsl(152 72% 48%)" }} /> : <ToggleLeft className="h-5 w-5" />}
                <span>{form.is_active ? "Campanha ativa" : "Campanha inativa"}</span>
              </button>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={cancel} className="h-8 text-sm">Cancelar</Button>
                <Button size="sm" onClick={save} disabled={isSaving} className="h-8 gap-1.5 font-semibold" style={{ backgroundColor: "hsl(152 72% 48%)", color: "hsl(222 25% 6%)" }}>
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  {editId ? "Salvar alterações" : "Criar campanha"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && selectedAccountId && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        )}

        {/* Empty */}
        {!isLoading && campaigns.length === 0 && !showForm && selectedAccountId && (
          <div className="glass-card rounded-2xl p-12 text-center animate-fade-in space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "hsl(152 72% 48% / 0.1)" }}>
              <Target className="h-7 w-7" style={{ color: "hsl(152 72% 48%)" }} />
            </div>
            <div>
              <p className="font-semibold">Nenhuma campanha criada</p>
              <p className="text-sm text-muted-foreground mt-1">Crie campanhas com hashtags, concorrentes e localização para segmentar seus targets.</p>
            </div>
            <Button onClick={openNew} className="gap-1.5 font-semibold" style={{ backgroundColor: "hsl(152 72% 48%)", color: "hsl(222 25% 6%)" }}>
              <Plus className="h-4 w-4" /> Criar primeira campanha
            </Button>
          </div>
        )}

        {/* Campaign list */}
        {!isLoading && campaigns.length > 0 && (
          <div className="space-y-6">
            {activeCampaigns.length > 0 && (
              <section className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium px-1">Ativas ({activeCampaigns.length})</p>
                <div className="space-y-2">
                  {activeCampaigns.map((c) => (
                    <CampaignRow key={c.id} campaign={c} isExpanded={expandedId === c.id} onToggleExpand={() => setExpandedId(expandedId === c.id ? null : c.id)} onEdit={() => openEdit(c)} onDelete={() => deleteCampaign(c.id)} onToggleActive={() => toggleActive(c)} onInject={() => setInjectCampaign(c)} onClearQueue={() => clearCampaignQueue(c.id)} />
                  ))}
                </div>
              </section>
            )}
            {inactiveCampaigns.length > 0 && (
              <section className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium px-1">Inativas ({inactiveCampaigns.length})</p>
                <div className="space-y-2">
                  {inactiveCampaigns.map((c) => (
                    <CampaignRow key={c.id} campaign={c} isExpanded={expandedId === c.id} onToggleExpand={() => setExpandedId(expandedId === c.id ? null : c.id)} onEdit={() => openEdit(c)} onDelete={() => deleteCampaign(c.id)} onToggleActive={() => toggleActive(c)} onInject={() => setInjectCampaign(c)} onClearQueue={() => clearCampaignQueue(c.id)} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Global Queue Panel */}
        {selectedAccountId && <GlobalQueuePanel igAccountId={selectedAccountId} refreshKey={queueRefreshKey} />}
      </div>

      {/* Inject Modal */}
      {injectCampaign && selectedAccountId && (
        <InjectModal
          campaign={injectCampaign}
          igAccountId={selectedAccountId}
          onClose={() => setInjectCampaign(null)}
          onInjected={() => { setQueueRefreshKey((k) => k + 1); load(); }}
        />
      )}
    </AppShell>
  );
}

// ── Campaign Row Component ──────────────────────────────────────────────────

interface CampaignRowProps {
  campaign: Campaign;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onInject: () => void;
  onClearQueue: () => void;
}

function CampaignRow({ campaign: c, isExpanded, onToggleExpand, onEdit, onDelete, onToggleActive, onInject, onClearQueue }: CampaignRowProps) {
  const totalSignals = c.hashtags.length + c.competitors.length;
  const queueTotal = c.queue.pending + c.queue.processing + c.queue.done;
  const queuePct = queueTotal > 0 ? Math.round((c.queue.done / queueTotal) * 100) : 0;

  return (
    <div className="glass-card rounded-xl overflow-hidden animate-fade-in transition-all" style={c.is_active ? { borderColor: "hsl(152 72% 48% / 0.3)" } : {}}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.is_active ? "animate-pulse" : ""}`} style={{ backgroundColor: c.is_active ? "hsl(152 72% 48%)" : "hsl(220 18% 30%)" }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm">{c.name}</p>
            {c.niche && <Badge variant="secondary" className="text-xs px-1.5" style={{ backgroundColor: "hsl(220 18% 18%)" }}>{c.niche}</Badge>}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {c.location && (
              <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{c.location}</span>
            )}
            <span className="text-xs text-muted-foreground">
              {c.hashtags.length} hashtag{c.hashtags.length !== 1 ? "s" : ""} · {c.competitors.length} concorrente{c.competitors.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Queue progress bar */}
          {queueTotal > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium" style={{ color: "hsl(42 96% 56%)" }}>{c.queue.pending} pendentes</span>
                  {c.queue.processing > 0 && <span className="text-[10px] font-medium" style={{ color: "hsl(252 62% 60%)" }}>{c.queue.processing} processando</span>}
                  <span className="text-[10px] font-medium" style={{ color: "hsl(152 72% 48%)" }}>{c.queue.done} concluídos</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{queuePct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${queuePct}%`,
                    background: queuePct === 100 ? "hsl(152 72% 48%)" : "linear-gradient(90deg, hsl(252 62% 60% / 0.7), hsl(252 62% 60%))",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {c.competitors.length > 0 && (
            <button onClick={onInject} title="Injetar targets na fila" className="p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors">
              <Zap className="h-3.5 w-3.5" style={{ color: "hsl(152 72% 48%)" }} />
            </button>
          )}
          <button onClick={onToggleActive} title={c.is_active ? "Desativar" : "Ativar"} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors">
            {c.is_active ? <ToggleRight className="h-4 w-4" style={{ color: "hsl(152 72% 48%)" }} /> : <ToggleLeft className="h-4 w-4" />}
          </button>
          <button onClick={onEdit} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={onDelete} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive transition-colors" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
          {totalSignals > 0 && (
            <button onClick={onToggleExpand} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 space-y-3 border-t" style={{ borderColor: "hsl(220 18% 18%)" }}>
          {c.hashtags.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Hash className="h-3 w-3" /> Hashtags</p>
              <div className="flex flex-wrap gap-1.5">
                {c.hashtags.map((h) => (
                  <Badge key={h} className="text-xs" style={{ backgroundColor: "hsl(252 62% 60% / 0.12)", color: "hsl(252 62% 75%)", border: "1px solid hsl(252 62% 60% / 0.25)" }}>#{h}</Badge>
                ))}
              </div>
            </div>
          )}
          {c.competitors.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Concorrentes</p>
              <div className="flex flex-wrap gap-1.5">
                {c.competitors.map((comp) => (
                  <Badge key={comp} className="text-xs" style={{ backgroundColor: "hsl(42 96% 56% / 0.12)", color: "hsl(42 96% 56%)", border: "1px solid hsl(42 96% 56% / 0.25)" }}>@{comp}</Badge>
                ))}
              </div>
              <button onClick={onInject} className="mt-1 flex items-center gap-1.5 text-xs font-medium transition-colors" style={{ color: "hsl(152 72% 48%)" }}>
                <Zap className="h-3 w-3" /> Injetar {c.competitors.length} targets na fila
              </button>
            </div>
          )}

          {/* Per-campaign queue clear */}
          {queueTotal > 0 && (
            <div className="flex items-center justify-end pt-2 border-t border-border/20">
              <Button
                variant="ghost" size="sm"
                className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onClearQueue}
              >
                <Eraser className="h-3 w-3" /> Limpar fila desta campanha ({queueTotal})
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
