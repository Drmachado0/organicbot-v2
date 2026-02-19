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
import { AccountCardsPanel } from "@/components/dashboard/AccountCardsPanel";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Play,
  Pause,
  RefreshCw,
  Users,
  List,
  CheckCircle,
  AlertCircle,
  Terminal,
  Zap,
  SquareTerminal,
  StopCircle,
  Settings2,
} from "lucide-react";

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const [stopConfirm, setStopConfirm] = useState(false);
  const { user } = useAuth();
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
    syncQueue,
    sendCommand,
    refresh,
  } = useDashboardV2();

  // Deep link: ?account=@username auto-selects the matching account (runs only once)
  const deepLinkApplied = useRef(false);
  useEffect(() => {
    const accountParam = searchParams.get("account");
    if (!accountParam || !accounts.length || deepLinkApplied.current) return;
    const clean = accountParam.replace(/^@/, "").toLowerCase();
    const match = accounts.find((a) => a.ig_username.toLowerCase() === clean);
    if (match) {
      setActiveAccountId(match.id);
      deepLinkApplied.current = true;
    }
  }, [searchParams, accounts, setActiveAccountId]);

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

          {/* Sync Queue */}
          {!isLoading && activeAccountId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 border-border/60"
                  onClick={async () => {
                    try {
                      await syncQueue();
                      toast.success("Comando sync_queue enviado para a extensão");
                    } catch {
                      toast.error("Erro ao sincronizar fila");
                    }
                  }}
                >
                  <Zap className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sincronizar Fila agora</TooltipContent>
            </Tooltip>
          )}

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

        {/* ── Account Cards Panel (multi-account) ── */}
        <AccountCardsPanel
          accounts={accounts}
          activeAccountId={activeAccountId}
          isLoading={isLoading}
          onSelect={setActiveAccountId}
          userId={user?.id ?? null}
        />

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
            progress={
              account?.queue_total && account.queue_total > 0
                ? { current: account.queue_processed ?? 0, total: account.queue_total }
                : undefined
            }
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
            {/* Header + quick actions */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold flex-1">Comandos Recentes do Bot</p>
              {!isLoading && activeAccountId && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs gap-1 border-border/60"
                        onClick={async () => { try { await sendCommand("start"); toast.success("Comando start enviado"); } catch { toast.error("Erro ao enviar start"); } }}
                      >
                        <Play className="h-3 w-3" style={{ color: "hsl(152 72% 48%)" }} /> Start
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Iniciar bot</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs gap-1 border-border/60"
                        onClick={async () => { try { await sendCommand("pause"); toast.success("Comando pause enviado"); } catch { toast.error("Erro ao enviar pause"); } }}
                      >
                        <Pause className="h-3 w-3" style={{ color: "hsl(42 96% 56%)" }} /> Pause
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Pausar bot</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className={`h-7 px-2.5 text-xs gap-1 border-border/60 ${stopConfirm ? "border-destructive text-destructive" : ""}`}
                        onClick={async () => {
                          if (!stopConfirm) { setStopConfirm(true); setTimeout(() => setStopConfirm(false), 3000); return; }
                          setStopConfirm(false);
                          try { await sendCommand("stop"); toast.success("Comando stop enviado"); } catch { toast.error("Erro ao enviar stop"); }
                        }}
                      >
                        <StopCircle className="h-3 w-3" style={{ color: "hsl(0 72% 55%)" }} />
                        {stopConfirm ? "Confirmar?" : "Stop"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Parar bot (clique 2x para confirmar)</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs gap-1 border-border/60"
                        onClick={async () => { try { await syncQueue(); toast.success("sync_queue enviado"); } catch { toast.error("Erro ao sincronizar fila"); } }}
                      >
                        <Zap className="h-3 w-3" style={{ color: "hsl(252 62% 60%)" }} /> Sync Fila
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Sincronizar fila agora</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs gap-1 border-border/60"
                        onClick={async () => { try { await sendCommand("sync_settings"); toast.success("sync_settings enviado"); } catch { toast.error("Erro ao sincronizar configurações"); } }}
                      >
                        <Settings2 className="h-3 w-3" style={{ color: "hsl(210 40% 70%)" }} /> Sync Config
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Forçar releitura de configurações</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground"
                        onClick={refresh}
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Atualizar lista</TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-8 rounded-lg bg-muted/30 animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {recentCommands.map((cmd) => (
                  <Tooltip key={cmd.id}>
                    <TooltipTrigger asChild>
                      <div
                        className="flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-default"
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
                          <SquareTerminal className="h-3 w-3 text-muted-foreground" />
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
                    </TooltipTrigger>
                    {(cmd.result || cmd.params) && (
                      <TooltipContent side="left" className="max-w-xs text-xs font-mono">
                        {cmd.params && Object.keys(cmd.params).length > 0 && (
                          <p><span className="text-muted-foreground">params:</span> {JSON.stringify(cmd.params)}</p>
                        )}
                        {cmd.result && Object.keys(cmd.result).length > 0 && (
                          <p><span className="text-muted-foreground">result:</span> {JSON.stringify(cmd.result)}</p>
                        )}
                      </TooltipContent>
                    )}
                  </Tooltip>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </AppShell>
  );
}

