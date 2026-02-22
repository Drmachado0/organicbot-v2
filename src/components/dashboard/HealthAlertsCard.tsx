import { useState, useEffect, useCallback } from "react";
import { CheckCircle, AlertTriangle, Bell, Shield, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { TodayAction } from "@/hooks/useDashboardV2";

interface Props {
  todayActions: TodayAction[];
  pendingQueueCount: number;
  botOnline: boolean;
  isLoading: boolean;
  igAccountId?: string | null;
  lastHeartbeat?: string | null;
  limits?: { follow: number; unfollow: number; like: number };
}

interface Alert {
  level: "ok" | "warn" | "error" | "info";
  message: string;
}



const LEVEL_CONFIG = {
  ok:    { Icon: CheckCircle,   color: "hsl(152 72% 48%)", bg: "hsl(152 72% 48% / 0.1)" },
  warn:  { Icon: AlertTriangle, color: "hsl(42 96% 56%)",  bg: "hsl(42 96% 56% / 0.1)"  },
  error: { Icon: XCircle,       color: "hsl(0 72% 55%)",   bg: "hsl(0 72% 55% / 0.1)"   },
  info:  { Icon: Bell,          color: "hsl(252 62% 60%)", bg: "hsl(252 62% 60% / 0.1)" },
};

export function HealthAlertsCard({ todayActions, pendingQueueCount, botOnline, isLoading, igAccountId, lastHeartbeat, limits }: Props) {
  const [errorRate, setErrorRate] = useState<number | null>(null);
  const LIMITS = {
    follow: limits?.follow ?? 150,
    unfollow: limits?.unfollow ?? 100,
    like: limits?.like ?? 300,
  };

  const fetchErrorRate = useCallback(async () => {
    if (!igAccountId) return;
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("action_log")
      .select("status")
      .eq("ig_account_id", igAccountId)
      .gte("executed_at", since)
      .limit(200);
    if (!data || data.length === 0) { setErrorRate(null); return; }
    const failed = data.filter((r) => r.status === "failed").length;
    setErrorRate(Math.round((failed / data.length) * 100));
  }, [igAccountId]);

  // Initial fetch
  useEffect(() => {
    fetchErrorRate();
  }, [fetchErrorRate]);

  // Realtime subscription — atualiza taxa de erro ao receber novos action_logs
  useEffect(() => {
    if (!igAccountId) return;
    const channel = supabase
      .channel(`health-alerts-${igAccountId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "action_log", filter: `ig_account_id=eq.${igAccountId}` },
        () => { fetchErrorRate(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [igAccountId, fetchErrorRate]);

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-5">
        <Skeleton className="h-4 w-36 mb-4" />
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full mb-2" />)}
      </div>
    );
  }

  const alerts: Alert[] = [];
  const getCount = (type: string) => todayActions.find((a) => a.action_type.toLowerCase() === type)?.count ?? 0;
  const follows = getCount("follow");
  const unfollows = getCount("unfollow");
  const likes = getCount("like");

  // Bot status
  if (!botOnline) {
    alerts.push({ level: "error", message: "Bot offline — nenhuma ação em execução" });
  } else if (lastHeartbeat) {
    const diffMin = (Date.now() - new Date(lastHeartbeat).getTime()) / 60000;
    if (diffMin > 15) alerts.push({ level: "warn", message: `Sem heartbeat há ${Math.round(diffMin)} min` });
  }

  // Daily limits
  if (follows >= LIMITS.follow) alerts.push({ level: "warn", message: `Limite diário de Follow atingido (${follows})` });
  else if (follows >= LIMITS.follow * 0.85) alerts.push({ level: "info", message: `Follow próximo do limite (${follows}/${LIMITS.follow})` });
  if (unfollows >= LIMITS.unfollow) alerts.push({ level: "warn", message: `Limite diário de Unfollow atingido (${unfollows})` });
  if (likes >= LIMITS.like) alerts.push({ level: "warn", message: `Limite diário de Like atingido (${likes})` });

  // Queue
  if (pendingQueueCount === 0) alerts.push({ level: "warn", message: "Fila de targets vazia" });
  else if (pendingQueueCount < 50) alerts.push({ level: "info", message: `Fila quase vazia (${pendingQueueCount} targets)` });

  // Error rate
  if (errorRate !== null && errorRate > 30) alerts.push({ level: "error", message: `Taxa de erro alta na última hora: ${errorRate}%` });
  else if (errorRate !== null && errorRate > 15) alerts.push({ level: "warn", message: `Taxa de erro elevada: ${errorRate}%` });

  // All good
  if (alerts.length === 0 && botOnline) {
    alerts.push({ level: "ok", message: "Bot funcionando normalmente" });
    if (pendingQueueCount > 0) alerts.push({ level: "ok", message: `${pendingQueueCount} targets na fila` });
  }

  return (
    <div className="glass-card rounded-xl p-5 animate-fade-in flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Saúde do Sistema</p>
        <Shield className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        {alerts.map((alert, i) => {
          const { Icon, color, bg } = LEVEL_CONFIG[alert.level];
          return (
            <div
              key={i}
              className="flex items-start gap-2.5 p-3 rounded-lg text-sm"
              style={{ backgroundColor: bg, border: `1px solid ${color}30` }}
            >
              <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color }} />
              <span className="text-foreground/85">{alert.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
