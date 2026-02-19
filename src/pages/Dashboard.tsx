import { useDashboardV2 } from "@/hooks/useDashboardV2";
import { LiveStatusBar } from "@/components/dashboard/LiveStatusBar";
import { ActionProgressCard } from "@/components/dashboard/ActionProgressCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ActionsAreaChart } from "@/components/dashboard/ActionsAreaChart";
import { FollowersGrowthChart } from "@/components/dashboard/FollowersGrowthChart";
import { SessionsTable } from "@/components/dashboard/SessionsTable";
import { RecentActionsTable } from "@/components/dashboard/RecentActionsTable";
import { CampaignsCard } from "@/components/dashboard/CampaignsCard";
import { HealthAlertsCard } from "@/components/dashboard/HealthAlertsCard";
import { WhitelistCard } from "@/components/dashboard/WhitelistCard";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useEffect } from "react";
import {
  Play,
  Pause,
  RefreshCw,
  Users,
  List,
  CheckCircle,
  AlertCircle,
  Terminal,
} from "lucide-react";

export default function Dashboard() {
  const {
    accounts,
    activeAccountId,
    setActiveAccountId,
    account,
    todayActions,
    dailyHistory,
    growthHistory,
    pendingQueueCount,
    sessions,
    recentActions,
    campaigns,
    whitelistCount,
    whitelistPreview,
    automationPaused,
    recentCommands,
    isLoading,
    error,
    toggleBot,
    refresh,
  } = useDashboardV2();

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const botActive = account?.bot_online && !automationPaused;

  // KPI helpers
  const followCount = todayActions.find((a) => a.action_type.toLowerCase() === "follow")?.count ?? 0;
  const unfollowCount = todayActions.find((a) => a.action_type.toLowerCase() === "unfollow")?.count ?? 0;
  const likeCount = todayActions.find((a) => a.action_type.toLowerCase() === "like")?.count ?? 0;
  const totalToday = followCount + unfollowCount + likeCount;

  const successCount = recentActions.filter((a) => a.status === "success").length;
  const successRate = recentActions.length > 0 ? Math.round((successCount / recentActions.length) * 100) : 0;

  const followersToday = (() => {
    if (growthHistory.length < 2) return 0;
    const last = growthHistory[growthHistory.length - 1]?.followers_count ?? 0;
    const prev = growthHistory[growthHistory.length - 2]?.followers_count ?? 0;
    return last - prev;
  })();

  function rateColor(rate: number): string {
    if (rate >= 90) return "hsl(152 72% 48%)";
    if (rate >= 70) return "hsl(42 96% 56%)";
    return "hsl(0 72% 55%)";
  }

  // Empty state — no accounts
  if (!isLoading && accounts.length === 0) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-20">
          <div className="glass-card rounded-2xl p-10 text-center max-w-md space-y-4 animate-fade-in">
            <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "hsl(152 72% 48% / 0.15)" }}>
              <Users className="h-7 w-7" style={{ color: "hsl(152 72% 48%)" }} />
            </div>
            <h2 className="text-xl font-bold">Nenhuma conta conectada</h2>
            <p className="text-sm text-muted-foreground">
              Conecte uma conta do Instagram para começar a usar o dashboard de automação.
            </p>
            <Button className="mt-2" style={{ backgroundColor: "hsl(152 72% 48%)", color: "hsl(222 25% 6%)" }}>
              Conectar conta
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }


  return (
    <AppShell>
      <div className="space-y-6">
        {/* ── Header ── */}
        <header className="flex flex-wrap items-center gap-3 animate-fade-in">
          <h1 className="text-xl font-bold tracking-tight flex-1 truncate">Dashboard</h1>

          {/* Account selector */}
          {isLoading ? (
            <Skeleton className="h-9 w-40" />
          ) : (
            <Select value={activeAccountId ?? ""} onValueChange={setActiveAccountId}>
              <SelectTrigger className="w-44 h-9 text-sm glass-card border-border/60">
                <SelectValue placeholder="Selecionar conta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    @{acc.ig_username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Refresh */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={refresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>

          {/* Toggle bot */}
          {isLoading ? (
            <Skeleton className="h-9 w-36" />
          ) : (
            <Button
              className="h-9 gap-2 relative overflow-hidden font-semibold"
              style={
                botActive
                  ? { backgroundColor: "hsl(152 72% 48%)", color: "hsl(222 25% 6%)" }
                  : { backgroundColor: "hsl(220 18% 18%)", color: "hsl(210 40% 96%)", border: "1px solid hsl(220 18% 28%)" }
              }
              onClick={async () => {
                try {
                  await toggleBot();
                  toast.success(botActive ? "Bot pausado" : "Bot iniciado");
                } catch {
                  toast.error("Erro ao alternar bot");
                }
              }}
            >
              {botActive && (
                <span className="absolute inset-0 rounded-md animate-ping opacity-20" style={{ backgroundColor: "hsl(152 72% 48%)" }} />
              )}
              {botActive ? <Pause className="h-4 w-4 relative z-10" /> : <Play className="h-4 w-4 relative z-10" />}
              <span className="relative z-10">{botActive ? "Bot Ativo — Pausar" : "Iniciar Bot"}</span>
            </Button>
          )}
        </header>

        {/* ── Live Status Bar ── */}
        <LiveStatusBar account={account} />

        {/* ── Row 1: KPI Cards ── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <ActionProgressCard todayActions={todayActions} isLoading={isLoading} />

          <KpiCard
            label="Fila Pendente"
            value={pendingQueueCount.toLocaleString()}
            subtext="targets aguardando execução"
            icon={<List className="h-4 w-4" />}
            badge={pendingQueueCount > 500 ? { label: "Alta", variant: "destructive" } : undefined}
            isLoading={isLoading}
          />

          <KpiCard
            label="Taxa de Sucesso (recente)"
            value={`${successRate}%`}
            subtext={`${successCount} de ${recentActions.length} ações`}
            icon={successRate >= 80 ? <CheckCircle className="h-4 w-4" style={{ color: "hsl(152 72% 48%)" }} /> : <AlertCircle className="h-4 w-4" style={{ color: "hsl(42 96% 56%)" }} />}
            accentColor={rateColor(successRate)}
            isLoading={isLoading}
          />

          <KpiCard
            label="Status da Conta"
            value={account ? `@${account.ig_username}` : "—"}
            subtext={`${(account?.followers_count ?? 0).toLocaleString()} seguidores`}
            badge={
              account?.bot_online
                ? { label: "Ativo", variant: "default" }
                : { label: "Offline", variant: "secondary" }
            }
            delta={followersToday !== 0 ? { value: followersToday, label: "seguidores hoje" } : undefined}
            isLoading={isLoading}
          />
        </section>

        {/* ── Row 2: Actions Area Chart ── */}
        <ActionsAreaChart data={dailyHistory} isLoading={isLoading} />

        {/* ── Row 3: Followers + Sessions ── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FollowersGrowthChart data={growthHistory} isLoading={isLoading} />
          <SessionsTable sessions={sessions} isLoading={isLoading} />
        </section>

        {/* ── Row 4: Recent Actions ── */}
        <RecentActionsTable actions={recentActions} isLoading={isLoading} />

        {/* ── Row 5: Campaigns + Whitelist + Alerts ── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CampaignsCard campaigns={campaigns} isLoading={isLoading} />
          <WhitelistCard count={whitelistCount} preview={whitelistPreview} isLoading={isLoading} />
          <HealthAlertsCard
            todayActions={todayActions}
            pendingQueueCount={pendingQueueCount}
            botOnline={account?.bot_online ?? false}
            igAccountId={activeAccountId}
            lastHeartbeat={account?.last_heartbeat ?? null}
            isLoading={isLoading}
          />
        </section>

        {/* ── Row 6: Recent Bot Commands ── */}
        {(recentCommands.length > 0 || isLoading) && (
          <div className="glass-card rounded-2xl p-5 animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Comandos Recentes do Bot</p>
            </div>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-8 rounded-lg bg-muted/30 animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {recentCommands.map((cmd) => (
                  <div
                    key={cmd.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                    style={{ backgroundColor: "hsl(220 18% 10%)" }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor:
                            cmd.status === "executed" ? "hsl(152 72% 48%)" :
                            cmd.status === "pending" ? "hsl(42 96% 56%)" :
                            "hsl(0 72% 55%)",
                        }}
                      />
                      <span className="font-mono font-semibold capitalize">{cmd.command}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className="text-xs capitalize px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor:
                            cmd.status === "executed" ? "hsl(152 72% 48% / 0.12)" :
                            cmd.status === "pending" ? "hsl(42 96% 56% / 0.12)" :
                            "hsl(0 72% 55% / 0.12)",
                          color:
                            cmd.status === "executed" ? "hsl(152 72% 48%)" :
                            cmd.status === "pending" ? "hsl(42 96% 56%)" :
                            "hsl(0 72% 55%)",
                        }}
                      >
                        {cmd.status}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {cmd.created_at ? new Date(cmd.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

