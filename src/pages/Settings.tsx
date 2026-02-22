import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
  Instagram,
  Wifi,
  WifiOff,
  Trash2,
  Plus,
  CircuitBoard,
  User,
  KeyRound,
  CheckCircle2,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

const WEEK_DAYS = [
  { key: "mon", label: "Segunda" },
  { key: "tue", label: "Terça" },
  { key: "wed", label: "Quarta" },
  { key: "thu", label: "Quinta" },
  { key: "fri", label: "Sexta" },
  { key: "sat", label: "Sábado" },
  { key: "sun", label: "Domingo" },
] as const;

type DayKey = (typeof WEEK_DAYS)[number]["key"];

interface DaySchedule {
  active: boolean;
  start: string;   // "HH:MM"
  stop: string;    // "HH:MM"
  follows: number;
  likes: number;
  mode?: string;
}

type WeekSchedule = Record<DayKey, DaySchedule>;

const DEFAULT_DAY: DaySchedule = { active: true, start: "09:00", stop: "22:00", follows: 60, likes: 120 };

const DEFAULT_WEEK_SCHEDULE: WeekSchedule = {
  mon: { ...DEFAULT_DAY },
  tue: { ...DEFAULT_DAY },
  wed: { ...DEFAULT_DAY },
  thu: { ...DEFAULT_DAY },
  fri: { ...DEFAULT_DAY },
  sat: { ...DEFAULT_DAY, follows: 40, likes: 80 },
  sun: { ...DEFAULT_DAY, follows: 40, likes: 80 },
};

interface BotSettings {
  // Limits
  follow_daily_limit: number;
  unfollow_daily_limit: number;
  like_daily_limit: number;
  // Delays
  delay_min: number;
  delay_max: number;
  // Extension-specific (written directly to ig_accounts)
  bot_mode: string;
  likes_per_follow: number;
  max_actions_per_session: number;
  // Schedule per weekday
  week_schedule: WeekSchedule;
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
  bot_mode: "seguir_curtir",
  likes_per_follow: 2,
  max_actions_per_session: 50,
  week_schedule: DEFAULT_WEEK_SCHEDULE,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert WeekSchedule → bot_schedule object that the extension reads */
function weekScheduleToBotSchedule(week: WeekSchedule): object {
  const activeDays = WEEK_DAYS.filter((d) => week[d.key].active);
  return {
    enabled: activeDays.length > 0,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    days: WEEK_DAYS.reduce((acc, { key }) => {
      acc[key] = {
        active: week[key].active,
        start: week[key].start,
        stop: week[key].stop,
        follows: week[key].follows,
        likes: week[key].likes,
        mode: week[key].mode ?? "seguir_curtir",
      };
      return acc;
    }, {} as Record<string, unknown>),
  };
}

/** Try to parse a bot_schedule.days object back into WeekSchedule */
function parseBotScheduleDays(days: unknown): WeekSchedule | null {
  if (!days || typeof days !== "object") return null;
  const d = days as Record<string, unknown>;
  const result: Partial<WeekSchedule> = {};
  for (const { key } of WEEK_DAYS) {
    const entry = d[key] as Record<string, unknown> | undefined;
    if (!entry) return null;
    result[key] = {
      active: Boolean(entry.active ?? true),
      start: typeof entry.start === "string" ? entry.start : "09:00",
      stop: typeof entry.stop === "string" ? entry.stop : "22:00",
      follows: Number(entry.follows ?? 60),
      likes: Number(entry.likes ?? 120),
    };
  }
  return result as WeekSchedule;
}

const BOT_MODES = [
  { value: "seguir_curtir", label: "Follow + Like", desc: "Segue e curte publicações do alvo" },
  { value: "seguir", label: "Apenas Follow", desc: "Somente segue, sem curtir" },
  { value: "curtir", label: "Apenas Like", desc: "Somente curte publicações" },
  { value: "deixar_seguir", label: "Unfollow", desc: "Desfaz seguimentos antigos" },
  { value: "ver_story", label: "Ver Stories", desc: "Visualiza stories dos alvos" },
];

const DEFAULT_SAFETY_PRESETS = [
  { id: "nova", label: "🟢 Conta Nova", delayMin: 45, delayMax: 90, follows: 40, unfollows: 30, likes: 80, session: 20, desc: "< 3 meses · risco mínimo" },
  { id: "media", label: "🟡 Conta Média", delayMin: 25, delayMax: 45, follows: 100, unfollows: 80, likes: 200, session: 50, desc: "3–12 meses · crescimento estável" },
  { id: "madura", label: "🔴 Conta Madura", delayMin: 15, delayMax: 25, follows: 200, unfollows: 150, likes: 400, session: 100, desc: "> 12 meses · máximo crescimento" },
];

type SafetyPreset = typeof DEFAULT_SAFETY_PRESETS[number];

function parseSettings(raw: Record<string, unknown> | null): BotSettings {
  if (!raw) return { ...DEFAULTS };

  // Try to parse week_schedule from saved settings or from bot_schedule.days
  let week_schedule: WeekSchedule = DEFAULT_WEEK_SCHEDULE;
  if (raw.week_schedule && typeof raw.week_schedule === "object") {
    const parsed = parseBotScheduleDays((raw.week_schedule as Record<string, unknown>));
    if (parsed) week_schedule = parsed;
  } else if (raw.bot_schedule && typeof raw.bot_schedule === "object") {
    const sched = raw.bot_schedule as Record<string, unknown>;
    const parsed = parseBotScheduleDays(sched.days);
    if (parsed) week_schedule = parsed;
  }

  return {
    follow_daily_limit: Number(raw.follow_daily_limit ?? DEFAULTS.follow_daily_limit),
    unfollow_daily_limit: Number(raw.unfollow_daily_limit ?? DEFAULTS.unfollow_daily_limit),
    like_daily_limit: Number(raw.like_daily_limit ?? DEFAULTS.like_daily_limit),
    delay_min: Number(raw.delay_min ?? DEFAULTS.delay_min),
    delay_max: Number(raw.delay_max ?? DEFAULTS.delay_max),
    bot_mode: String(raw.bot_mode ?? DEFAULTS.bot_mode),
    likes_per_follow: Number(raw.likes_per_follow ?? DEFAULTS.likes_per_follow),
    max_actions_per_session: Number(raw.max_actions_per_session ?? DEFAULTS.max_actions_per_session),
    week_schedule,
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

// ─── Instagram Accounts Section ───────────────────────────────────────────────

interface IgAccount {
  id: string;
  ig_username: string;
  bot_online: boolean | null;
  bot_status: string | null;
  bridge_version: string | null;
  followers_count: number | null;
  last_heartbeat: string | null;
  device_id: string | null;
}

// ─── My Account Section ───────────────────────────────────────────────────────

function MyAccountSection({ user }: { user: { id: string; email?: string } }) {
  const [fullName, setFullName] = useState("");
  const [loadingName, setLoadingName] = useState(true);
  const [savingName, setSavingName] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setFullName(data?.full_name ?? "");
        setLoadingName(false);
      });
  }, [user.id]);

  const handleSaveName = async () => {
    const trimmed = fullName.trim();
    if (trimmed.length > 100) { toast.error("Nome muito longo (máx. 100 caracteres)"); return; }
    setSavingName(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ data: { full_name: trimmed } });
      if (authError) throw authError;
      const { error: dbError } = await supabase.from("profiles").update({ full_name: trimmed }).eq("id", user.id);
      if (dbError) throw dbError;
      toast.success("Nome atualizado com sucesso!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar nome");
    } finally {
      setSavingName(false);
    }
  };

  const handleSavePassword = async () => {
    if (newPassword.length < 6) { toast.error("A nova senha deve ter ao menos 6 caracteres"); return; }
    if (newPassword !== confirmPassword) { toast.error("As senhas não coincidem"); return; }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha atualizada com sucesso!");
      setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar senha");
    } finally {
      setSavingPassword(false);
    }
  };

  const initials = fullName.trim()
    ? fullName.trim().split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : (user.email?.[0] ?? "U").toUpperCase();

  return (
    <SectionCard
      title="Minha Conta"
      icon={<User className="h-4 w-4" style={{ color: "hsl(215 72% 60%)" }} />}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Name form ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: "hsl(215 72% 60% / 0.15)", color: "hsl(215 72% 60%)", border: "1px solid hsl(215 72% 60% / 0.3)" }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{fullName || "Sem nome"}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome completo</Label>
            {loadingName ? (
              <div className="h-10 rounded-md bg-muted/30 animate-pulse" />
            ) : (
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome"
                maxLength={100}
                onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
              />
            )}
          </div>

          <Button
            size="sm"
            onClick={handleSaveName}
            disabled={savingName || loadingName}
            className="gap-1.5 w-full"
            style={{ backgroundColor: "hsl(215 72% 60%)", color: "white" }}
          >
            {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Salvar nome
          </Button>
        </div>

        {/* ── Password form ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-border/20">
            <KeyRound className="h-4 w-4" style={{ color: "hsl(42 96% 56%)" }} />
            <p className="text-sm font-medium">Alterar senha</p>
          </div>

          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nova senha</Label>
              <Input
                type={showPasswords ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                maxLength={128}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Confirmar nova senha</Label>
              <Input
                type={showPasswords ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                maxLength={128}
                onKeyDown={(e) => e.key === "Enter" && handleSavePassword()}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowPasswords((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPasswords ? "Ocultar senhas" : "Mostrar senhas"}
            </button>
          </div>

          {newPassword && confirmPassword && (
            <p className={`text-xs flex items-center gap-1 ${newPassword === confirmPassword ? "text-green-500" : "text-destructive"}`}>
              <CheckCircle2 className="h-3 w-3" />
              {newPassword === confirmPassword ? "Senhas coincidem" : "As senhas não coincidem"}
            </p>
          )}

          <Button
            size="sm"
            onClick={handleSavePassword}
            disabled={savingPassword || !newPassword || !confirmPassword}
            className="gap-1.5 w-full"
            style={{ backgroundColor: "hsl(42 96% 56%)", color: "hsl(222 25% 6%)" }}
          >
            {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Atualizar senha
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

function BridgeTokenSection({ accounts }: { accounts: { id: string; ig_username: string }[] }) {
  const [selectedId, setSelectedId] = useState<string>(accounts[0]?.id ?? "");
  const [token, setToken] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!selectedId) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc("generate_bridge_token", { p_ig_account_id: selectedId });
      if (error) throw error;
      setToken(data as string);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar token");
    } finally {
      setGenerating(false);
    }
  };

  const copy = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    toast.success("Token copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="mt-4 rounded-xl p-4 space-y-3"
      style={{ backgroundColor: "hsl(220 18% 10%)", border: "1px solid hsl(252 62% 60% / 0.2)" }}
    >
      <div className="flex items-center gap-2">
        <CircuitBoard className="h-4 w-4" style={{ color: "hsl(252 62% 60%)" }} />
        <p className="text-sm font-medium">Bridge Token</p>
      </div>

      {accounts.length > 1 && (
        <select
          value={selectedId}
          onChange={(e) => { setSelectedId(e.target.value); setToken(null); }}
          className="w-full h-9 rounded-md border border-border/60 bg-background px-3 text-sm"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>@{a.ig_username}</option>
          ))}
        </select>
      )}

      {token && (
        <div
          className="flex items-center gap-2 p-2 rounded-lg cursor-pointer"
          style={{ backgroundColor: "hsl(220 18% 14%)", border: "1px solid hsl(220 18% 22%)" }}
          onClick={copy}
          title="Clique para copiar"
        >
          <code className="text-xs text-muted-foreground flex-1 truncate font-mono">{token}</code>
          <div
            className="flex-shrink-0 p-1 rounded"
            style={{ color: copied ? "hsl(152 72% 48%)" : "hsl(215 20% 55%)" }}
          >
            {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </div>
        </div>
      )}

      <Button
        size="sm"
        onClick={generate}
        disabled={generating || !selectedId}
        className="gap-1.5 w-full"
        style={{ backgroundColor: "hsl(252 62% 60%)", color: "white" }}
      >
        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircuitBoard className="h-4 w-4" />}
        {token ? "Gerar novo token" : "Gerar bridge token"}
      </Button>
      <p className="text-xs text-muted-foreground">Cole este token no bridge Android para autenticar a conexão.</p>
    </div>
  );
}

function InstagramAccountsSection({ userId }: { userId: string }) {
  const [accounts, setAccounts] = useState<IgAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUsername, setNewUsername] = useState("");
  const [adding, setAdding] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    const { data } = await supabase
      .from("ig_accounts")
      .select("id, ig_username, bot_online, bot_status, bridge_version, followers_count, last_heartbeat, device_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    setAccounts((data as IgAccount[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const handleAdd = async () => {
    const trimmed = newUsername.trim().replace(/^@/, "");
    if (!trimmed) return;
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(trimmed)) {
      toast.error("Username inválido");
      return;
    }
    setAdding(true);
    try {
      const { error } = await supabase.from("ig_accounts").insert({
        ig_username: trimmed,
        user_id: userId,
        is_active: true,
        bot_online: false,
        bot_status: "offline",
      });
      if (error) throw error;
      toast.success(`@${trimmed} adicionada!`);
      setNewUsername("");
      fetchAccounts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao adicionar");
    } finally {
      setAdding(false);
    }
  };

  const handleDisconnect = async (id: string, username: string) => {
    setDisconnecting(id);
    try {
      const { error } = await supabase
        .from("ig_accounts")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
      toast.success(`@${username} desconectada`);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao desconectar");
    } finally {
      setDisconnecting(null);
    }
  };

  const isOnline = (account: IgAccount) => {
    if (!account.bot_online || !account.last_heartbeat) return false;
    const diff = Date.now() - new Date(account.last_heartbeat).getTime();
    return diff < 6 * 60 * 1000; // 6 min threshold
  };

  return (
    <>
    <SectionCard
      title="Contas Instagram Conectadas"
      icon={<Instagram className="h-4 w-4" style={{ color: "hsl(320 65% 60%)" }} />}
    >
      {/* Add new account */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
          <Input
            className="pl-7"
            placeholder="instagram_username"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            disabled={adding}
          />
        </div>
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={adding || !newUsername.trim()}
          className="gap-1.5 shrink-0"
          style={{ backgroundColor: "hsl(320 65% 60%)", color: "white" }}
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Adicionar
        </Button>
      </div>

      {/* Accounts list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          <Instagram className="h-8 w-8 mx-auto mb-2 opacity-30" />
          Nenhuma conta conectada ainda
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => {
            const online = isOnline(account);
            return (
              <div
                key={account.id}
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{ backgroundColor: "hsl(220 18% 10%)", border: "1px solid hsl(220 18% 18%)" }}
              >
                {/* Status indicator */}
                <div className="relative flex-shrink-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "hsl(220 18% 15%)" }}
                  >
                    <Instagram className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
                      online ? "bg-green-500" : "bg-muted-foreground/40"
                    }`}
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">@{account.ig_username}</span>
                    <Badge
                      variant="outline"
                      className={`text-xs px-1.5 py-0 gap-1 ${
                        online
                          ? "border-green-500/40 text-green-400"
                          : "border-muted-foreground/30 text-muted-foreground"
                      }`}
                    >
                      {online ? <Wifi className="h-2.5 w-2.5" /> : <WifiOff className="h-2.5 w-2.5" />}
                      {online ? "Online" : account.bot_status ?? "Offline"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    {account.bridge_version && (
                      <span className="flex items-center gap-1">
                        <CircuitBoard className="h-3 w-3" />
                        v{account.bridge_version}
                      </span>
                    )}
                    {account.followers_count != null && (
                      <span>{account.followers_count.toLocaleString()} seguidores</span>
                    )}
                    {account.device_id && (
                      <span className="truncate max-w-[120px]" title={account.device_id}>
                        ID: {account.device_id.slice(0, 8)}…
                      </span>
                    )}
                  </div>
                </div>

                {/* Disconnect button */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                      disabled={disconnecting === account.id}
                    >
                      {disconnecting === account.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Desconectar conta?</AlertDialogTitle>
                      <AlertDialogDescription>
                        A conta <strong>@{account.ig_username}</strong> será desconectada do bot. O histórico de ações será mantido.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDisconnect(account.id, account.ig_username)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Desconectar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>

    {accounts.length > 0 && <BridgeTokenSection accounts={accounts} />}
  </>
  );
}

// ─── Extension Sync Section ───────────────────────────────────────────────────

function ExtensionSyncSection({ userId }: { userId: string }) {
  const [syncing, setSyncing] = useState(false);
  const [accounts, setAccounts] = useState<{ id: string; ig_username: string; last_heartbeat: string | null }[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("ig_accounts")
      .select("id, ig_username, last_heartbeat")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at")
      .then(({ data }) => {
        const accs = (data ?? []) as { id: string; ig_username: string; last_heartbeat: string | null }[];
        setAccounts(accs);
        if (accs.length > 0) setSelectedId(accs[0].id);
      });
  }, [userId]);

  const forceSync = async () => {
    if (!selectedId) { toast.error("Nenhuma conta disponível"); return; }
    setSyncing(true);
    try {
      const { error } = await supabase.rpc("send_bot_command", {
        p_ig_account_id: selectedId,
        p_command: "sync_settings",
        p_params: {},
      });
      if (error) throw error;
      toast.success("Comando sync_settings enviado! A extensão lerá em até 45s.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar comando");
    } finally {
      setSyncing(false);
    }
  };

  const selectedAccount = accounts.find((a) => a.id === selectedId);
  const getExtStatus = (hb: string | null) => {
    if (!hb) return { label: "Offline", color: "hsl(215 20% 45%)" };
    const diff = Date.now() - new Date(hb).getTime();
    if (diff < 6 * 60 * 1000) return { label: "Ativa", color: "hsl(152 72% 48%)" };
    if (diff < 30 * 60 * 1000) return { label: "Ausente", color: "hsl(42 96% 56%)" };
    return { label: "Offline", color: "hsl(215 20% 45%)" };
  };

  const syncedFields = [
    { label: "delay_min / delay_max", table: "ig_accounts" },
    { label: "bot_mode (modo de automação)", table: "ig_accounts" },
    { label: "likes_per_follow", table: "ig_accounts" },
    { label: "max_actions_per_session", table: "ig_accounts" },
    { label: "bot_schedule (horários)", table: "ig_accounts" },
    { label: "Filtros de unfollow", table: "user_settings" },
    { label: "Randomização de delays", table: "user_settings" },
    { label: "Limites diários follow/unfollow/like", table: "user_settings" },
  ];

  return (
    <SectionCard
      title="Sincronização com Extensão Chrome"
      icon={<Zap className="h-4 w-4" style={{ color: "hsl(42 96% 56%)" }} />}
    >
      {/* Account selector + status */}
      {accounts.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          {accounts.length > 1 ? (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="h-9 rounded-md border border-border/60 bg-background px-3 text-sm flex-1"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>@{a.ig_username}</option>
              ))}
            </select>
          ) : (
            <span className="text-sm font-semibold flex-1">@{selectedAccount?.ig_username}</span>
          )}
          {selectedAccount && (() => {
            const s = getExtStatus(selectedAccount.last_heartbeat);
            return (
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                style={{ color: s.color, backgroundColor: `${s.color.replace(")", " / 0.12)")}` }}
              >
                Extensão {s.label}
              </span>
            );
          })()}
        </div>
      )}

      <div
        className="rounded-xl p-4 space-y-3"
        style={{ backgroundColor: "hsl(220 18% 10%)", border: "1px solid hsl(42 96% 56% / 0.2)" }}
      >
        <p className="text-xs text-muted-foreground">
          Ao salvar, as configurações são escritas <strong className="text-foreground">diretamente em ig_accounts</strong> (fonte de verdade da extensão) e em user_settings. O botão abaixo força a extensão a reler imediatamente via comando <code className="text-xs bg-muted/40 px-1 rounded">sync_settings</code>.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {syncedFields.map((f) => (
            <div key={f.label} className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 flex-shrink-0" style={{ color: "hsl(152 72% 48%)" }} />
              <span className="flex-1">{f.label}</span>
              <span
                className="text-xs px-1.5 py-0.5 rounded font-mono"
                style={{ backgroundColor: f.table === "ig_accounts" ? "hsl(152 72% 48% / 0.12)" : "hsl(215 72% 60% / 0.12)", color: f.table === "ig_accounts" ? "hsl(152 72% 48%)" : "hsl(215 72% 60%)" }}
              >
                {f.table}
              </span>
            </div>
          ))}
        </div>
        <Button
          size="sm"
          onClick={forceSync}
          disabled={syncing || !selectedId}
          className="gap-1.5 w-full mt-1"
          style={{ backgroundColor: "hsl(42 96% 56%)", color: "hsl(222 25% 6%)" }}
        >
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Forçar sync agora (sync_settings)
        </Button>
        {accounts.length === 0 && (
          <p className="text-xs text-muted-foreground/60 text-center">
            Nenhuma conta conectada. Adicione uma conta acima para ativar o sync.
          </p>
        )}
      </div>
    </SectionCard>
  );
}
// ─── Main Component ───────────────────────────────────────────────────────────

export default function BotSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<BotSettings>({ ...DEFAULTS });
  const [safetyPresets, setSafetyPresets] = useState<SafetyPreset[]>(DEFAULT_SAFETY_PRESETS.map(p => ({ ...p })));
  const [editingPreset, setEditingPreset] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [accountsList, setAccountsList] = useState<{ id: string; ig_username: string }[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  const set = useCallback(<K extends keyof BotSettings>(key: K, value: BotSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  // Load settings — also fetch ig_accounts fields (delay_min/max, bot_mode, etc.)
  useEffect(() => {
    if (!user) return;
    (async () => {
      setIsLoading(true);
      const [settingsRes, accountRes, accountsListRes] = await Promise.all([
        supabase.from("user_settings").select("settings_json").eq("user_id", user.id).maybeSingle(),
        supabase.from("ig_accounts").select("delay_min, delay_max, bot_mode, likes_per_follow, max_actions_per_session").eq("user_id", user.id).eq("is_active", true).order("created_at").limit(1).maybeSingle(),
        supabase.from("ig_accounts").select("id, ig_username").eq("user_id", user.id).eq("is_active", true).order("created_at"),
      ]);
      const accs = (accountsListRes.data ?? []) as { id: string; ig_username: string }[];
      setAccountsList(accs);
      if (accs.length > 0 && !selectedAccountId) setSelectedAccountId(accs[0].id);
      const base = parseSettings((settingsRes.data?.settings_json as Record<string, unknown>) ?? null);
      // Merge ig_accounts fields that override user_settings (source of truth for extension)
      if (accountRes.data) {
        const acc = accountRes.data;
        if (acc.delay_min != null) base.delay_min = acc.delay_min;
        if (acc.delay_max != null) base.delay_max = acc.delay_max;
        if (acc.bot_mode) base.bot_mode = acc.bot_mode;
        if (acc.likes_per_follow != null) base.likes_per_follow = acc.likes_per_follow;
        if (acc.max_actions_per_session != null) base.max_actions_per_session = acc.max_actions_per_session;
      }
      setSettings(base);
      setIsDirty(false);
      setIsLoading(false);
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const botSchedule = weekScheduleToBotSchedule(settings.week_schedule);

      // 1. Save to user_settings (all settings + dashboard_url)
      const settingsWithUrl = { ...settings, dashboard_url: "https://organicbot.lovable.app" };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: settingsError } = await supabase.from("user_settings").upsert(
        [{ user_id: user.id, settings_json: settingsWithUrl as unknown as import("@/integrations/supabase/types").Json, updated_at: new Date().toISOString() }],
        { onConflict: "user_id" }
      );
      if (settingsError) throw settingsError;

      // 2. Sync critical fields to ig_accounts (what the extension actually reads)
      const { error: accountError } = await supabase.from("ig_accounts").update({
        delay_min: settings.delay_min,
        delay_max: settings.delay_max,
        bot_mode: settings.bot_mode,
        likes_per_follow: settings.likes_per_follow,
        max_actions_per_session: settings.max_actions_per_session,
        bot_schedule: botSchedule as unknown as import("@/integrations/supabase/types").Json,
        updated_at: new Date().toISOString(),
      }).eq("id", selectedAccountId ?? "");
      if (accountError) throw accountError;

      // 3. Auto-sync: send sync_settings command to all active accounts
      const { data: activeAccounts } = await supabase
        .from("ig_accounts")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (activeAccounts && activeAccounts.length > 0) {
        await Promise.allSettled(
          activeAccounts.map((acc) =>
            supabase.rpc("send_bot_command", {
              p_ig_account_id: acc.id,
              p_command: "sync_settings",
              p_params: {} as unknown as import("@/integrations/supabase/types").Json,
            })
          )
        );
      }

      toast.success("Configurações salvas e sincronizadas com a extensão!");
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

  // ── Week schedule helpers ──
  const setDaySchedule = useCallback((day: DayKey, patch: Partial<DaySchedule>) => {
    setSettings((prev) => ({
      ...prev,
      week_schedule: { ...prev.week_schedule, [day]: { ...prev.week_schedule[day], ...patch } },
    }));
    setIsDirty(true);
  }, []);

  const activeDays = WEEK_DAYS.filter((d) => settings.week_schedule[d.key].active).length;

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

      {accountsList.length > 1 && (
        <div className="flex items-center gap-3 mb-4 animate-fade-in">
          <Instagram className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Configurando conta:</p>
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm"
          >
            {accountsList.map((a) => (
              <option key={a.id} value={a.id}>
                @{a.ig_username}
              </option>
            ))}
          </select>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
        </div>
      ) : (
        <div className="space-y-5">
          {/* ── Safety Presets ── */}
          <SectionCard
            title="Presets de Segurança"
            icon={<Zap className="h-4 w-4" style={{ color: "hsl(152 72% 48%)" }} />}
          >
            <p className="text-xs text-muted-foreground -mt-1">Aplica automaticamente delays e limites recomendados. Envia comando imediato à extensão.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {safetyPresets.map((p, idx) => {
                const isEditing = editingPreset === p.id;
                return (
                  <div
                    key={p.id}
                    className="rounded-xl px-4 py-4 text-left space-y-2 transition-all"
                    style={{ backgroundColor: "hsl(220 18% 10%)", border: "1px solid hsl(220 18% 22%)" }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold">{p.label}</p>
                      <button
                        type="button"
                        onClick={() => setEditingPreset(isEditing ? null : p.id)}
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded border border-border/50 hover:border-border"
                      >
                        {isEditing ? "OK" : "Editar"}
                      </button>
                    </div>

                    {isEditing ? (
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="text-[10px] text-muted-foreground">Follow/dia</label>
                            <Input
                              type="number" min={1} max={500}
                              value={p.follows}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setSafetyPresets(prev => prev.map((pr, i) => i === idx ? { ...pr, follows: val } : pr));
                              }}
                              className="h-7 text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Sessão</label>
                            <Input
                              type="number" min={1} max={500}
                              value={p.session}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setSafetyPresets(prev => prev.map((pr, i) => i === idx ? { ...pr, session: val } : pr));
                              }}
                              className="h-7 text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Delay mín (s)</label>
                            <Input
                              type="number" min={1} max={300}
                              value={p.delayMin}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setSafetyPresets(prev => prev.map((pr, i) => i === idx ? { ...pr, delayMin: val } : pr));
                              }}
                              className="h-7 text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Delay máx (s)</label>
                            <Input
                              type="number" min={1} max={300}
                              value={p.delayMax}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setSafetyPresets(prev => prev.map((pr, i) => i === idx ? { ...pr, delayMax: val } : pr));
                              }}
                              className="h-7 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>Follow: <span className="text-foreground font-medium">{p.follows}/dia</span></p>
                        <p>Delay: <span className="text-foreground font-medium">{p.delayMin}–{p.delayMax}s</span></p>
                        <p>Sessão: <span className="text-foreground font-medium">{p.session} ações</span></p>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground/60">{p.desc}</p>

                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs h-7 mt-1"
                      onClick={async () => {
                        const presetValues = {
                          delay_min: p.delayMin,
                          delay_max: p.delayMax,
                          follow_daily_limit: p.follows,
                          unfollow_daily_limit: p.unfollows,
                          like_daily_limit: p.likes,
                          max_actions_per_session: p.session,
                        };
                        setSettings((prev) => ({ ...prev, ...presetValues }));
                        setIsDirty(false);

                        try {
                          const { data: currentSettings } = await supabase
                            .from("user_settings")
                            .select("settings_json")
                            .eq("user_id", user?.id ?? "")
                            .limit(1)
                            .maybeSingle();
                          const currentJson = (currentSettings?.settings_json as Record<string, unknown>) || {};
                          const mergedJson = { ...currentJson, ...presetValues, dashboard_url: "https://organicbot.lovable.app" };

                          await supabase.from("user_settings").upsert(
                            { user_id: user?.id ?? "", settings_json: mergedJson, updated_at: new Date().toISOString() },
                            { onConflict: "user_id" }
                          );

                          const { data: accs } = await supabase
                            .from("ig_accounts")
                            .select("id")
                            .eq("user_id", user?.id ?? "")
                            .eq("is_active", true);

                          if (accs && accs.length > 0) {
                            await Promise.all(
                              accs.map((acc) =>
                                supabase.from("ig_accounts").update({
                                  delay_min: p.delayMin,
                                  delay_max: p.delayMax,
                                  max_actions_per_session: p.session,
                                  likes_per_follow: settings.likes_per_follow ?? 2,
                                }).eq("id", acc.id)
                              )
                            );

                            await Promise.allSettled(
                              accs.map((acc) =>
                                supabase.rpc("send_bot_command", {
                                  p_ig_account_id: acc.id,
                                  p_command: "sync_settings",
                                  p_params: {},
                                })
                              )
                            );
                            toast.success(`Preset "${p.label}" aplicado e sincronizado!`);
                          } else {
                            toast.success(`Preset "${p.label}" aplicado!`);
                          }
                        } catch {
                          toast.error("Erro ao aplicar preset.");
                        }
                      }}
                    >
                      <Zap className="w-3 h-3" /> Aplicar
                    </Button>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* ── Bot Mode ── */}
          <SectionCard
            title="Modo de Automação"
            icon={<Zap className="h-4 w-4" style={{ color: "hsl(252 62% 60%)" }} />}
          >
            <p className="text-xs text-muted-foreground -mt-1">Define o que a extensão faz ao processar cada alvo. Escrito em <code className="bg-muted/40 px-1 rounded">ig_accounts.bot_mode</code>.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {BOT_MODES.map((m) => {
                const active = settings.bot_mode === m.value;
                return (
                  <button
                    key={m.value}
                    onClick={() => { set("bot_mode", m.value); }}
                    className="rounded-xl px-4 py-3 text-left transition-all"
                    style={{
                      backgroundColor: active ? "hsl(252 62% 60% / 0.15)" : "hsl(220 18% 10%)",
                      border: `1px solid ${active ? "hsl(252 62% 60% / 0.5)" : "hsl(220 18% 22%)"}`,
                    }}
                  >
                    <p className="text-sm font-semibold" style={{ color: active ? "hsl(252 62% 60%)" : undefined }}>{m.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                    <p className="text-xs font-mono text-muted-foreground/50 mt-1">{m.value}</p>
                  </button>
                );
              })}
            </div>
          </SectionCard>

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
              <div className="pt-1 border-t border-border/30 space-y-4">
                <p className="text-xs text-muted-foreground font-medium">Configurações da extensão (ig_accounts)</p>
                <LimitSlider
                  label="Likes por Follow"
                  icon={<Heart className="h-3.5 w-3.5" style={{ color: "hsl(320 65% 60%)" }} />}
                  value={settings.likes_per_follow}
                  min={0} max={5} step={1}
                  color="hsl(320 65% 60%)"
                  onChange={(v) => set("likes_per_follow", v)}
                />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-muted-foreground" /> Máx. ações/sessão
                    </Label>
                    <span className="text-sm font-bold tabular-nums" style={{ color: "hsl(215 72% 60%)" }}>{settings.max_actions_per_session}</span>
                  </div>
                  <Slider
                    min={10} max={200} step={10}
                    value={[settings.max_actions_per_session]}
                    onValueChange={([v]) => set("max_actions_per_session", v)}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground/60"><span>10</span><span>200</span></div>
                </div>
              </div>
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
            title={`Horários de Operação — ${activeDays} dia${activeDays !== 1 ? "s" : ""} ativos`}
            icon={<Clock className="h-4 w-4" style={{ color: "hsl(252 62% 60%)" }} />}
          >
            {/* Quick presets */}
            <div className="flex flex-wrap gap-2 -mt-1">
              {[
                { label: "Dias úteis", days: ["mon", "tue", "wed", "thu", "fri"] as DayKey[], weekend: false },
                { label: "Todos os dias", days: WEEK_DAYS.map((d) => d.key) as DayKey[], weekend: true },
                { label: "Fim de semana", days: ["sat", "sun"] as DayKey[], weekend: true },
              ].map(({ label, days }) => (
                <button
                  key={label}
                  onClick={() => {
                    const allKeys = WEEK_DAYS.map((d) => d.key) as DayKey[];
                    setSettings((prev) => ({
                      ...prev,
                      week_schedule: allKeys.reduce((acc, k) => {
                        acc[k] = { ...prev.week_schedule[k], active: days.includes(k) };
                        return acc;
                      }, {} as WeekSchedule),
                    }));
                    setIsDirty(true);
                  }}
                  className="px-2.5 py-1 rounded-md text-xs font-medium border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-[6rem_2.5rem_5.5rem_5.5rem_4.5rem_4.5rem] gap-x-3 items-center px-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Dia</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide text-center">On</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Início</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Fim</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide text-right">Follows</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide text-right">Likes</span>
              </div>

              {WEEK_DAYS.map(({ key, label }) => {
                const day = settings.week_schedule[key];
                return (
                  <div
                    key={key}
                    className={cn(
                      "grid grid-cols-[6rem_2.5rem_5.5rem_5.5rem_4.5rem_4.5rem] gap-x-3 items-center px-3 py-2 rounded-xl transition-colors",
                      day.active
                        ? "border border-primary/20"
                        : "opacity-50"
                    )}
                    style={day.active ? { backgroundColor: "hsl(252 62% 60% / 0.06)" } : { backgroundColor: "hsl(220 18% 10%)" }}
                  >
                    {/* Day name */}
                    <span className="text-xs font-medium">{label}</span>

                    {/* Active toggle */}
                    <div className="flex justify-center">
                      <Switch
                        checked={day.active}
                        onCheckedChange={(v) => setDaySchedule(key, { active: v })}
                        className="scale-75 origin-left"
                      />
                    </div>

                    {/* Start time */}
                    <input
                      type="time"
                      value={day.start}
                      disabled={!day.active}
                      onChange={(e) => setDaySchedule(key, { start: e.target.value })}
                      className="w-full h-7 rounded-md border border-border/40 bg-background px-2 text-xs tabular-nums disabled:opacity-40 focus:border-primary/60 focus:outline-none"
                    />

                    {/* Stop time */}
                    <input
                      type="time"
                      value={day.stop}
                      disabled={!day.active}
                      onChange={(e) => setDaySchedule(key, { stop: e.target.value })}
                      className="w-full h-7 rounded-md border border-border/40 bg-background px-2 text-xs tabular-nums disabled:opacity-40 focus:border-primary/60 focus:outline-none"
                    />

                    {/* Follows/day */}
                    <input
                      type="number"
                      min={0}
                      max={500}
                      step={10}
                      value={day.follows}
                      disabled={!day.active}
                      onChange={(e) => setDaySchedule(key, { follows: Math.max(0, Math.min(500, Number(e.target.value))) })}
                      className="w-full h-7 rounded-md border border-border/40 bg-background px-2 text-xs text-right tabular-nums disabled:opacity-40 focus:border-primary/60 focus:outline-none"
                    />

                    {/* Likes/day */}
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      step={10}
                      value={day.likes}
                      disabled={!day.active}
                      onChange={(e) => setDaySchedule(key, { likes: Math.max(0, Math.min(1000, Number(e.target.value))) })}
                      className="w-full h-7 rounded-md border border-border/40 bg-background px-2 text-xs text-right tabular-nums disabled:opacity-40 focus:border-primary/60 focus:outline-none"
                    />
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              O agendamento é convertido para <code className="text-[10px] bg-muted/40 px-1 rounded">bot_schedule.days</code> e sincronizado com a extensão no save.
            </p>
          </SectionCard>


          {/* ── My Account ── */}
          {user && <MyAccountSection user={{ id: user.id, email: user.email ?? "" }} />}

          {/* ── Instagram Accounts ── */}
          {user && <InstagramAccountsSection userId={user.id} />}

          {/* ── Extension Sync ── */}
          <ExtensionSyncSection userId={user?.id ?? ""} />

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
                    { label: "Dias ativos", value: `${activeDays}/7`, color: "hsl(252 62% 60%)" },
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
