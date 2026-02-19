import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Settings,
  Save,
  RotateCcw,
  Loader2,
  Heart,
  UserPlus,
  UserMinus,
  Clock,
  Filter,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BotSettings {
  // Limits
  follow_daily_limit: number;
  unfollow_daily_limit: number;
  like_daily_limit: number;
  // Delays
  delay_min: number;
  delay_max: number;
  // Schedule (24 slots, true = active)
  schedule_hours: boolean[];
  // Filters
  dont_unfollow_followers: boolean;
  dont_unfollow_fresh: boolean;
  dont_unfollow_fresh_days: number;
  dont_unfollow_non_organicbot: boolean;
  dont_block_matching_filters: boolean;
  dont_unfollow_matching_filters: boolean;
  follow_already_attempted: boolean;
  randomize_delay: boolean;
  randomize_percent: number;
  // Notifications
  email_notifications: boolean;
}

const DEFAULTS: BotSettings = {
  follow_daily_limit: 150,
  unfollow_daily_limit: 100,
  like_daily_limit: 300,
  delay_min: 25,
  delay_max: 45,
  schedule_hours: Array(24).fill(true),
  dont_unfollow_followers: true,
  dont_unfollow_fresh: true,
  dont_unfollow_fresh_days: 3,
  dont_unfollow_non_organicbot: true,
  dont_block_matching_filters: true,
  dont_unfollow_matching_filters: true,
  follow_already_attempted: false,
  randomize_delay: true,
  randomize_percent: 50,
  email_notifications: true,
};

function parseSettings(raw: Record<string, unknown> | null): BotSettings {
  if (!raw) return { ...DEFAULTS };

  // Parse schedule_hours from raw or build from boolean array
  let schedule_hours: boolean[] = Array(24).fill(true);
  if (Array.isArray(raw.schedule_hours) && raw.schedule_hours.length === 24) {
    schedule_hours = raw.schedule_hours.map(Boolean);
  }

  return {
    follow_daily_limit: Number(raw.follow_daily_limit ?? DEFAULTS.follow_daily_limit),
    unfollow_daily_limit: Number(raw.unfollow_daily_limit ?? DEFAULTS.unfollow_daily_limit),
    like_daily_limit: Number(raw.like_daily_limit ?? DEFAULTS.like_daily_limit),
    delay_min: Number(raw.delay_min ?? DEFAULTS.delay_min),
    delay_max: Number(raw.delay_max ?? DEFAULTS.delay_max),
    schedule_hours,
    dont_unfollow_followers: Boolean(raw.dont_unfollow_followers ?? DEFAULTS.dont_unfollow_followers),
    dont_unfollow_fresh: Boolean(raw.dont_unfollow_fresh ?? DEFAULTS.dont_unfollow_fresh),
    dont_unfollow_fresh_days: Number(raw.dont_unfollow_fresh_days ?? DEFAULTS.dont_unfollow_fresh_days),
    dont_unfollow_non_organicbot: Boolean(raw.dont_unfollow_non_organicbot ?? DEFAULTS.dont_unfollow_non_organicbot),
    dont_block_matching_filters: Boolean(raw.dont_block_matching_filters ?? DEFAULTS.dont_block_matching_filters),
    dont_unfollow_matching_filters: Boolean(raw.dont_unfollow_matching_filters ?? DEFAULTS.dont_unfollow_matching_filters),
    follow_already_attempted: Boolean(raw.follow_already_attempted ?? DEFAULTS.follow_already_attempted),
    randomize_delay: Boolean(raw.randomize_delay ?? DEFAULTS.randomize_delay),
    randomize_percent: Number(raw.randomize_percent ?? DEFAULTS.randomize_percent),
    email_notifications: Boolean(raw.email_notifications ?? DEFAULTS.email_notifications),
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-5 space-y-5 animate-fade-in">
      <div className="flex items-center gap-2 pb-1 border-b border-border/30">
        {icon}
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      {children}
    </div>
  );
}

interface LimitSliderProps {
  label: string;
  icon: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  color: string;
  onChange: (v: number) => void;
}

function LimitSlider({ label, icon, value, min, max, step, color, onChange }: LimitSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm text-muted-foreground flex items-center gap-1.5">
          {icon} {label}
        </Label>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>{value.toLocaleString()}/dia</span>
      </div>
      <Slider
        min={min} max={max} step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
        style={{ "--slider-color": color } as React.CSSProperties}
      />
      <div className="flex justify-between text-xs text-muted-foreground/60">
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}

function ToggleRow({ label, description, checked, onCheckedChange }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="flex-shrink-0 mt-0.5" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BotSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<BotSettings>({ ...DEFAULTS });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const set = useCallback(<K extends keyof BotSettings>(key: K, value: BotSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  // Load
  useEffect(() => {
    if (!user) return;
    (async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from("user_settings")
        .select("settings_json")
        .eq("user_id", user.id)
        .maybeSingle();
      setSettings(parseSettings((data?.settings_json as Record<string, unknown>) ?? null));
      setIsDirty(false);
      setIsLoading(false);
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("user_settings").upsert(
        [{
          user_id: user.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          settings_json: settings as any,
          updated_at: new Date().toISOString(),
        }],
        { onConflict: "user_id" }
      );
      if (error) throw error;
      toast.success("Configurações salvas!");
      setIsDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  };

  const reset = () => {
    setSettings({ ...DEFAULTS });
    setIsDirty(true);
  };

  // ── Delay validation: ensure min < max ──
  const handleDelayMin = (v: number) => {
    set("delay_min", Math.min(v, settings.delay_max - 5));
  };
  const handleDelayMax = (v: number) => {
    set("delay_max", Math.max(v, settings.delay_min + 5));
  };

  // ── Schedule hour toggle ──
  const toggleHour = (h: number) => {
    const next = [...settings.schedule_hours];
    next[h] = !next[h];
    set("schedule_hours", next);
  };

  const activeHours = settings.schedule_hours.filter(Boolean).length;

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6 animate-fade-in">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Settings className="h-5 w-5 flex-shrink-0" style={{ color: "hsl(152 72% 48%)" }} />
          <h1 className="text-xl font-bold tracking-tight">Configurações do Bot</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          className="h-9 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrões
        </Button>
        <Button
          onClick={save}
          disabled={!isDirty || isSaving}
          className="h-9 gap-1.5 font-semibold"
          style={{ backgroundColor: "hsl(152 72% 48%)", color: "hsl(222 25% 6%)" }}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Row 1: Limits + Delays */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* ── Daily Limits ── */}
            <SectionCard
              title="Limites Diários"
              icon={<Zap className="h-4 w-4" style={{ color: "hsl(152 72% 48%)" }} />}
            >
              <LimitSlider
                label="Follow"
                icon={<UserPlus className="h-3.5 w-3.5" style={{ color: "hsl(152 72% 48%)" }} />}
                value={settings.follow_daily_limit}
                min={10} max={400} step={10}
                color="hsl(152 72% 48%)"
                onChange={(v) => set("follow_daily_limit", v)}
              />
              <LimitSlider
                label="Unfollow"
                icon={<UserMinus className="h-3.5 w-3.5" style={{ color: "hsl(0 72% 55%)" }} />}
                value={settings.unfollow_daily_limit}
                min={10} max={400} step={10}
                color="hsl(0 72% 55%)"
                onChange={(v) => set("unfollow_daily_limit", v)}
              />
              <LimitSlider
                label="Like"
                icon={<Heart className="h-3.5 w-3.5" style={{ color: "hsl(320 65% 60%)" }} />}
                value={settings.like_daily_limit}
                min={10} max={500} step={10}
                color="hsl(320 65% 60%)"
                onChange={(v) => set("like_daily_limit", v)}
              />
            </SectionCard>

            {/* ── Delays ── */}
            <SectionCard
              title="Delays entre Ações"
              icon={<Clock className="h-4 w-4" style={{ color: "hsl(42 96% 56%)" }} />}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">Delay mínimo</Label>
                  <span className="text-sm font-bold tabular-nums" style={{ color: "hsl(42 96% 56%)" }}>{settings.delay_min}s</span>
                </div>
                <Slider
                  min={5} max={120} step={5}
                  value={[settings.delay_min]}
                  onValueChange={([v]) => handleDelayMin(v)}
                />
                <div className="flex justify-between text-xs text-muted-foreground/60"><span>5s</span><span>120s</span></div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">Delay máximo</Label>
                  <span className="text-sm font-bold tabular-nums" style={{ color: "hsl(42 96% 56%)" }}>{settings.delay_max}s</span>
                </div>
                <Slider
                  min={10} max={180} step={5}
                  value={[settings.delay_max]}
                  onValueChange={([v]) => handleDelayMax(v)}
                />
                <div className="flex justify-between text-xs text-muted-foreground/60"><span>10s</span><span>180s</span></div>
              </div>

              <div className="pt-1 space-y-3 border-t border-border/30">
                <ToggleRow
                  label="Randomizar delays"
                  description="Adiciona variação aleatória para parecer mais humano"
                  checked={settings.randomize_delay}
                  onCheckedChange={(v) => set("randomize_delay", v)}
                />
                {settings.randomize_delay && (
                  <div className="space-y-2 pl-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Variação</Label>
                      <span className="text-xs font-semibold text-muted-foreground">±{settings.randomize_percent}%</span>
                    </div>
                    <Slider
                      min={10} max={80} step={5}
                      value={[settings.randomize_percent]}
                      onValueChange={([v]) => set("randomize_percent", v)}
                    />
                  </div>
                )}
              </div>
            </SectionCard>
          </div>

          {/* ── Schedule ── */}
          <SectionCard
            title={`Horários de Operação — ${activeHours}h ativas de 24h`}
            icon={<Clock className="h-4 w-4" style={{ color: "hsl(252 62% 60%)" }} />}
          >
            <div className="space-y-3">
              {/* Quick toggles */}
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Dia (6h–18h)", range: [6, 18] },
                  { label: "Noite (18h–6h)", range: [18, 24, 0, 6] },
                  { label: "Todas", range: null },
                  { label: "Nenhuma", range: [] },
                ].map(({ label, range }) => (
                  <button
                    key={label}
                    onClick={() => {
                      const next = Array(24).fill(false);
                      if (range === null) {
                        set("schedule_hours", Array(24).fill(true));
                      } else if ((range as number[]).length === 0) {
                        set("schedule_hours", Array(24).fill(false));
                      } else {
                        const [s1, e1, s2, e2] = range as number[];
                        for (let i = s1; i < e1; i++) next[i] = true;
                        if (s2 !== undefined) for (let i = s2; i < e2; i++) next[i] = true;
                        set("schedule_hours", next);
                      }
                    }}
                    className="px-2.5 py-1 rounded-md text-xs font-medium border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Hour grid */}
              <div className="grid grid-cols-12 gap-1 sm:gap-1.5">
                {Array.from({ length: 24 }, (_, h) => (
                  <button
                    key={h}
                    onClick={() => toggleHour(h)}
                    title={`${String(h).padStart(2, "0")}:00`}
                    className={cn(
                      "rounded-md py-2 sm:py-2.5 text-xs font-medium transition-all",
                      settings.schedule_hours[h]
                        ? "text-background"
                        : "bg-muted/30 text-muted-foreground/50 hover:bg-muted/60"
                    )}
                    style={settings.schedule_hours[h] ? { backgroundColor: "hsl(252 62% 60%)", boxShadow: "0 0 8px hsl(252 62% 60% / 0.3)" } : {}}
                  >
                    {h}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Clique em um horário para ativar/desativar. Horas em roxo = bot ativo.
              </p>
            </div>
          </SectionCard>

          {/* Row 3: Filters + Notifications */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* ── Filters ── */}
            <SectionCard
              title="Filtros & Proteções"
              icon={<Filter className="h-4 w-4" style={{ color: "hsl(152 72% 48%)" }} />}
            >
              <div className="space-y-4">
                <ToggleRow
                  label="Não desfazer seguimento de seguidores"
                  description="Protege quem já te segue de receber unfollow"
                  checked={settings.dont_unfollow_followers}
                  onCheckedChange={(v) => set("dont_unfollow_followers", v)}
                />
                <ToggleRow
                  label="Não desfazer seguimento recente"
                  description={`Aguarda ${settings.dont_unfollow_fresh_days} dias antes de unfollow`}
                  checked={settings.dont_unfollow_fresh}
                  onCheckedChange={(v) => set("dont_unfollow_fresh", v)}
                />
                {settings.dont_unfollow_fresh && (
                  <div className="pl-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Dias de espera</Label>
                      <span className="text-xs font-semibold text-muted-foreground">{settings.dont_unfollow_fresh_days}d</span>
                    </div>
                    <Slider
                      min={1} max={30} step={1}
                      value={[settings.dont_unfollow_fresh_days]}
                      onValueChange={([v]) => set("dont_unfollow_fresh_days", v)}
                    />
                  </div>
                )}
                <ToggleRow
                  label="Não desfazer seguimento de não-organicbot"
                  description="Só desfaz follows realizados por este bot"
                  checked={settings.dont_unfollow_non_organicbot}
                  onCheckedChange={(v) => set("dont_unfollow_non_organicbot", v)}
                />
                <ToggleRow
                  label="Não bloquear contas que passam nos filtros"
                  checked={settings.dont_block_matching_filters}
                  onCheckedChange={(v) => set("dont_block_matching_filters", v)}
                />
                <ToggleRow
                  label="Não desfazer seguimento de contas nos filtros"
                  checked={settings.dont_unfollow_matching_filters}
                  onCheckedChange={(v) => set("dont_unfollow_matching_filters", v)}
                />
                <ToggleRow
                  label="Seguir contas já tentadas anteriormente"
                  description="Reprocessa targets que já foram tentados"
                  checked={settings.follow_already_attempted}
                  onCheckedChange={(v) => set("follow_already_attempted", v)}
                />
              </div>
            </SectionCard>

            {/* ── Notifications ── */}
            <SectionCard
              title="Notificações"
              icon={<Zap className="h-4 w-4" style={{ color: "hsl(42 96% 56%)" }} />}
            >
              <div className="space-y-4">
                <ToggleRow
                  label="Notificações por email"
                  description="Receba alertas de erros e resumos diários por email"
                  checked={settings.email_notifications}
                  onCheckedChange={(v) => set("email_notifications", v)}
                />
              </div>

              {/* Summary card */}
              <div
                className="mt-4 rounded-xl p-4 space-y-2"
                style={{ backgroundColor: "hsl(220 18% 10%)", border: "1px solid hsl(220 18% 18%)" }}
              >
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Resumo da configuração</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {[
                    { label: "Follow/dia", value: settings.follow_daily_limit, color: "hsl(152 72% 48%)" },
                    { label: "Unfollow/dia", value: settings.unfollow_daily_limit, color: "hsl(0 72% 55%)" },
                    { label: "Like/dia", value: settings.like_daily_limit, color: "hsl(320 65% 60%)" },
                    { label: "Delay", value: `${settings.delay_min}–${settings.delay_max}s`, color: "hsl(42 96% 56%)" },
                    { label: "Horas ativas", value: `${activeHours}h`, color: "hsl(252 62% 60%)" },
                    { label: "Proteções", value: [settings.dont_unfollow_followers, settings.dont_unfollow_fresh, settings.dont_unfollow_non_organicbot].filter(Boolean).length + "/3", color: "hsl(215 20% 55%)" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="text-xs font-semibold tabular-nums" style={{ color }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Sticky save bar (shows when dirty) */}
          {isDirty && (
            <div
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl animate-fade-in"
              style={{ backgroundColor: "hsl(222 25% 8%)", border: "1px solid hsl(220 18% 20%)" }}
            >
              <span className="text-sm text-muted-foreground">Você tem alterações não salvas</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                className="h-8 text-xs text-muted-foreground"
              >
                Descartar
              </Button>
              <Button
                size="sm"
                onClick={save}
                disabled={isSaving}
                className="h-8 gap-1.5 font-semibold"
                style={{ backgroundColor: "hsl(152 72% 48%)", color: "hsl(222 25% 6%)" }}
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Salvar
              </Button>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
