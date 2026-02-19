import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  BarChart2,
  Download,
  RefreshCw,
  TrendingUp,
  Users,
  Activity,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface IgAccount {
  id: string;
  ig_username: string;
}

interface DailyActionPoint {
  day: string;
  follow: number;
  unfollow: number;
  like: number;
  total: number;
}

interface GrowthPoint {
  day: string;
  followers_count: number;
  following_count: number;
}

interface SessionRow {
  id: string;
  session_start: string | null;
  session_end: string | null;
  follows_count: number | null;
  unfollows_count: number | null;
  likes_count: number | null;
  errors_count: number | null;
  duration_min?: number;
  success_rate?: number;
}

// ─── CSV Helpers ──────────────────────────────────────────────────────────────

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => {
        const val = r[h] ?? "";
        const str = String(val);
        return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(",")
    ),
  ];
  return lines.join("\n");
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function DarkTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs space-y-1 shadow-xl"
      style={{ backgroundColor: "hsl(222 25% 10%)", border: "1px solid hsl(220 18% 20%)" }}
    >
      <p className="text-muted-foreground font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-semibold" style={{ color: p.color }}>{p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Period options ───────────────────────────────────────────────────────────

const PERIODS = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Reports() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<IgAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [period, setPeriod] = useState(30);
  const [isLoading, setIsLoading] = useState(true);

  const [dailyActions, setDailyActions] = useState<DailyActionPoint[]>([]);
  const [growthHistory, setGrowthHistory] = useState<GrowthPoint[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  // Summary KPIs
  const totalFollows = dailyActions.reduce((s, d) => s + d.follow, 0);
  const totalUnfollows = dailyActions.reduce((s, d) => s + d.unfollow, 0);
  const totalLikes = dailyActions.reduce((s, d) => s + d.like, 0);
  const totalActions = totalFollows + totalUnfollows + totalLikes;

  const followersDelta = (() => {
    if (growthHistory.length < 2) return 0;
    return (growthHistory.at(-1)?.followers_count ?? 0) - (growthHistory[0]?.followers_count ?? 0);
  })();

  const avgSuccessRate = (() => {
    const valid = sessions.filter((s) => s.success_rate !== undefined);
    if (!valid.length) return 0;
    return Math.round(valid.reduce((s, r) => s + (r.success_rate ?? 0), 0) / valid.length);
  })();

  const fetchData = useCallback(async (accountId: string | null, days: number) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const since = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
      const sinceTs = new Date(Date.now() - days * 86400000).toISOString();

      const [actionsRes, growthRes, sessionsRes, accountsRes] = await Promise.all([
        accountId
          ? supabase
              .from("daily_action_cache")
              .select("day, action_type, success_count")
              .eq("ig_account_id", accountId)
              .gte("day", since)
              .order("day", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        accountId
          ? supabase
              .from("growth_stats")
              .select("recorded_at, followers_count, following_count")
              .eq("ig_account_id", accountId)
              .gte("recorded_at", sinceTs)
              .order("recorded_at", { ascending: true })
              .limit(500)
          : Promise.resolve({ data: [], error: null }),
        accountId
          ? supabase
              .from("session_stats")
              .select("id, session_start, session_end, follows_count, unfollows_count, likes_count, errors_count")
              .eq("ig_account_id", accountId)
              .gte("session_end", sinceTs)
              .order("session_end", { ascending: false })
              .limit(100)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("ig_accounts")
          .select("id, ig_username")
          .order("created_at", { ascending: true }),
      ]);

      if (accountsRes.data) {
        const accs = accountsRes.data as IgAccount[];
        setAccounts(accs);
        if (!accountId && accs.length > 0) setActiveAccountId(accs[0].id);
      }

      // Pivot daily actions
      const map: Record<string, DailyActionPoint> = {};
      for (const row of (actionsRes.data ?? []) as { day: string; action_type: string; success_count: number | null }[]) {
        if (!map[row.day]) map[row.day] = { day: row.day, follow: 0, unfollow: 0, like: 0, total: 0 };
        const t = row.action_type.toLowerCase();
        const v = row.success_count ?? 0;
        if (t === "follow") map[row.day].follow += v;
        else if (t === "unfollow") map[row.day].unfollow += v;
        else if (t === "like") map[row.day].like += v;
        map[row.day].total = map[row.day].follow + map[row.day].unfollow + map[row.day].like;
      }
      setDailyActions(Object.values(map).sort((a, b) => a.day.localeCompare(b.day)));

      // Pivot growth (one value per day, latest)
      const gMap: Record<string, { followers_count: number; following_count: number }> = {};
      for (const row of (growthRes.data ?? []) as { recorded_at: string; followers_count: number | null; following_count: number | null }[]) {
        const d = row.recorded_at.split("T")[0];
        gMap[d] = { followers_count: row.followers_count ?? 0, following_count: row.following_count ?? 0 };
      }
      setGrowthHistory(Object.entries(gMap).sort((a, b) => a[0].localeCompare(b[0])).map(([day, v]) => ({ day, ...v })));

      // Sessions with derived metrics
      const sess = ((sessionsRes.data ?? []) as SessionRow[]).map((s) => {
        const start = s.session_start ? new Date(s.session_start).getTime() : null;
        const end = s.session_end ? new Date(s.session_end).getTime() : null;
        const dur = start && end ? Math.round((end - start) / 60000) : null;
        const total = (s.follows_count ?? 0) + (s.unfollows_count ?? 0) + (s.likes_count ?? 0);
        const success = total;
        const errors = s.errors_count ?? 0;
        const rate = total + errors > 0 ? Math.round((success / (success + errors)) * 100) : 100;
        return { ...s, duration_min: dur ?? 0, success_rate: rate };
      });
      setSessions(sess);
    } catch {
      toast.error("Erro ao carregar relatórios");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData(activeAccountId, period);
  }, [activeAccountId, period, fetchData]);

  // ─── Export handlers ────────────────────────────────────────────────────────

  const exportActions = () => {
    const csv = toCSV(dailyActions.map((d) => ({ data: d.day, follows: d.follow, unfollows: d.unfollow, curtidas: d.like, total: d.total })));
    downloadCSV(csv, `acoes_diarias_${period}d.csv`);
    toast.success("CSV exportado!");
  };

  const exportGrowth = () => {
    const csv = toCSV(growthHistory.map((g) => ({ data: g.day, seguidores: g.followers_count, seguindo: g.following_count })));
    downloadCSV(csv, `crescimento_${period}d.csv`);
    toast.success("CSV exportado!");
  };

  const exportSessions = () => {
    const csv = toCSV(
      sessions.map((s) => ({
        inicio: s.session_start ?? "",
        fim: s.session_end ?? "",
        duracao_min: s.duration_min,
        follows: s.follows_count ?? 0,
        unfollows: s.unfollows_count ?? 0,
        likes: s.likes_count ?? 0,
        erros: s.errors_count ?? 0,
        taxa_sucesso: `${s.success_rate}%`,
      }))
    );
    downloadCSV(csv, `sessoes_${period}d.csv`);
    toast.success("CSV exportado!");
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  const fmtDay = (day: string) => {
    const [, m, d] = day.split("-");
    return `${d}/${m}`;
  };

  return (
    <AppShell>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3 mb-6 animate-fade-in">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <BarChart2 className="h-5 w-5 flex-shrink-0" style={{ color: "hsl(152 72% 48%)" }} />
          <h1 className="text-xl font-bold tracking-tight">Relatórios</h1>
        </div>

        {/* Account selector */}
        {accounts.length > 1 && (
          <Select value={activeAccountId ?? ""} onValueChange={setActiveAccountId}>
            <SelectTrigger className="w-40 h-9 text-sm glass-card border-border/60">
              <SelectValue placeholder="Conta" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>@{a.ig_username}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Period selector */}
        <div className="flex rounded-lg overflow-hidden border border-border/40" style={{ backgroundColor: "hsl(220 18% 12%)" }}>
          {PERIODS.map(({ label, days }) => (
            <button
              key={days}
              onClick={() => setPeriod(days)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={
                period === days
                  ? { backgroundColor: "hsl(152 72% 48% / 0.15)", color: "hsl(152 72% 48%)" }
                  : { color: "hsl(215 20% 55%)" }
              }
            >
              {label}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          onClick={() => fetchData(activeAccountId, period)}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* ── Summary KPI strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Follows", value: totalFollows, color: "hsl(152 72% 48%)", icon: <Users className="h-4 w-4" /> },
          { label: "Unfollows", value: totalUnfollows, color: "hsl(0 72% 55%)", icon: <Activity className="h-4 w-4" /> },
          { label: "Likes", value: totalLikes, color: "hsl(320 65% 60%)", icon: <TrendingUp className="h-4 w-4" /> },
          { label: "Crescimento", value: followersDelta >= 0 ? `+${followersDelta}` : followersDelta, color: "hsl(42 96% 56%)", icon: <TrendingUp className="h-4 w-4" /> },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="glass-card rounded-xl p-4 animate-fade-in">
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">{label}</p>
                  <span style={{ color }}>{icon}</span>
                </div>
                <p className="text-2xl font-bold" style={{ color }}>{typeof value === "number" ? value.toLocaleString() : value}</p>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-6">
        {/* ── Actions Area Chart ── */}
        <ChartCard
          title="Ações Diárias"
          subtitle={`Follow · Unfollow · Like — últimos ${period} dias`}
          icon={<Activity className="h-4 w-4" style={{ color: "hsl(152 72% 48%)" }} />}
          onExport={exportActions}
          isLoading={isLoading}
          isEmpty={dailyActions.length === 0}
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={dailyActions} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gFollow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(152 72% 48%)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(152 72% 48%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gUnfollow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0 72% 55%)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(0 72% 55%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gLike" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(320 65% 60%)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(320 65% 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 18% 14%)" />
              <XAxis dataKey="day" tickFormatter={fmtDay} tick={{ fill: "hsl(215 20% 45%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215 20% 45%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<DarkTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: "hsl(215 20% 55%)" }} />
              <Area type="monotone" dataKey="follow" name="Follow" stroke="hsl(152 72% 48%)" fill="url(#gFollow)" strokeWidth={1.5} dot={false} />
              <Area type="monotone" dataKey="unfollow" name="Unfollow" stroke="hsl(0 72% 55%)" fill="url(#gUnfollow)" strokeWidth={1.5} dot={false} />
              <Area type="monotone" dataKey="like" name="Like" stroke="hsl(320 65% 60%)" fill="url(#gLike)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* ── Followers Growth LineChart ── */}
        <ChartCard
          title="Crescimento de Seguidores"
          subtitle={`Evolução diária — últimos ${period} dias`}
          icon={<Users className="h-4 w-4" style={{ color: "hsl(42 96% 56%)" }} />}
          onExport={exportGrowth}
          isLoading={isLoading}
          isEmpty={growthHistory.length === 0}
        >
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={growthHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 18% 14%)" />
              <XAxis dataKey="day" tickFormatter={fmtDay} tick={{ fill: "hsl(215 20% 45%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215 20% 45%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<DarkTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: "hsl(215 20% 55%)" }} />
              <Line type="monotone" dataKey="followers_count" name="Seguidores" stroke="hsl(42 96% 56%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="following_count" name="Seguindo" stroke="hsl(220 18% 45%)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* ── Sessions Bar Chart ── */}
        <ChartCard
          title="Total de Ações por Sessão"
          subtitle={`Últimas ${sessions.length} sessões`}
          icon={<Calendar className="h-4 w-4" style={{ color: "hsl(252 62% 60%)" }} />}
          onExport={exportSessions}
          isLoading={isLoading}
          isEmpty={sessions.length === 0}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={[...sessions].reverse().slice(0, 20).map((s) => ({
                data: s.session_end ? new Date(s.session_end).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "?",
                follows: s.follows_count ?? 0,
                unfollows: s.unfollows_count ?? 0,
                likes: s.likes_count ?? 0,
              }))}
              margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 18% 14%)" />
              <XAxis dataKey="data" tick={{ fill: "hsl(215 20% 45%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215 20% 45%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<DarkTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: "hsl(215 20% 55%)" }} />
              <Bar dataKey="follows" name="Follows" fill="hsl(152 72% 48% / 0.8)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="unfollows" name="Unfollows" fill="hsl(0 72% 55% / 0.8)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="likes" name="Likes" fill="hsl(320 65% 60% / 0.8)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* ── Sessions Table ── */}
        <ChartCard
          title="Histórico de Sessões"
          subtitle={`${sessions.length} sessões no período`}
          icon={<Clock className="h-4 w-4" style={{ color: "hsl(215 20% 55%)" }} />}
          onExport={exportSessions}
          isLoading={isLoading}
          isEmpty={sessions.length === 0}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  {["Data", "Duração", "Follows", "Unfollows", "Likes", "Erros", "Taxa"].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-xs text-muted-foreground font-medium uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 20).map((s) => {
                  const rate = s.success_rate ?? 100;
                  return (
                    <tr key={s.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                      <td className="py-2 px-3 text-xs text-muted-foreground">
                        {s.session_end ? new Date(s.session_end).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="py-2 px-3 text-xs">{s.duration_min ? `${s.duration_min}m` : "—"}</td>
                      <td className="py-2 px-3 text-xs font-medium" style={{ color: "hsl(152 72% 48%)" }}>{s.follows_count ?? 0}</td>
                      <td className="py-2 px-3 text-xs font-medium" style={{ color: "hsl(0 72% 55%)" }}>{s.unfollows_count ?? 0}</td>
                      <td className="py-2 px-3 text-xs font-medium" style={{ color: "hsl(320 65% 60%)" }}>{s.likes_count ?? 0}</td>
                      <td className="py-2 px-3 text-xs">{s.errors_count ?? 0}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5">
                          {rate >= 80
                            ? <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "hsl(152 72% 48%)" }} />
                            : <XCircle className="h-3.5 w-3.5" style={{ color: "hsl(0 72% 55%)" }} />}
                          <span
                            className="text-xs font-semibold"
                            style={{ color: rate >= 80 ? "hsl(152 72% 48%)" : rate >= 60 ? "hsl(42 96% 56%)" : "hsl(0 72% 55%)" }}
                          >
                            {rate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </AppShell>
  );
}

// ─── ChartCard wrapper ────────────────────────────────────────────────────────

interface ChartCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onExport: () => void;
  isLoading: boolean;
  isEmpty: boolean;
  children: React.ReactNode;
}

function ChartCard({ title, subtitle, icon, onExport, isLoading, isEmpty, children }: ChartCardProps) {
  return (
    <div className="glass-card rounded-2xl p-5 animate-fade-in">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <p className="font-semibold text-sm">{title}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onExport}
          disabled={isLoading || isEmpty}
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" />
          CSV
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-52 w-full rounded-lg" />
      ) : isEmpty ? (
        <div className="h-52 flex flex-col items-center justify-center gap-2">
          <BarChart2 className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Sem dados para o período selecionado</p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
