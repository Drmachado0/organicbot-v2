import { CheckCircle, AlertTriangle, Bell, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { TodayAction } from "@/hooks/useDashboardV2";

interface Props {
  todayActions: TodayAction[];
  pendingQueueCount: number;
  botOnline: boolean;
  isLoading: boolean;
}

interface Alert {
  level: "ok" | "warn" | "info";
  message: string;
}

const LIMITS = { follow: 150, unfollow: 120, like: 300 };

function buildAlerts(todayActions: TodayAction[], pendingQueueCount: number, botOnline: boolean): Alert[] {
  const alerts: Alert[] = [];
  const getCount = (type: string) => todayActions.find((a) => a.action_type.toLowerCase() === type)?.count ?? 0;

  const follows = getCount("follow");
  const unfollows = getCount("unfollow");
  const likes = getCount("like");
  const total = follows + unfollows + likes;

  if (follows >= LIMITS.follow) alerts.push({ level: "warn", message: "Limite diário de Follow atingido" });
  if (unfollows >= LIMITS.unfollow) alerts.push({ level: "warn", message: "Limite diário de Unfollow atingido" });
  if (likes >= LIMITS.like) alerts.push({ level: "warn", message: "Limite diário de Like atingido" });

  if (pendingQueueCount < 50 && pendingQueueCount >= 0) {
    alerts.push({ level: "info", message: `Fila quase vazia (${pendingQueueCount} targets)` });
  }

  if (total > 0) {
    const errorRate = 0; // would need real error tracking
    if (errorRate > 0.2) alerts.push({ level: "warn", message: `Taxa de erro alta (${Math.round(errorRate * 100)}%)` });
  }

  if (alerts.length === 0 && botOnline) {
    alerts.push({ level: "ok", message: "Bot funcionando normalmente" });
  }

  if (!botOnline) {
    alerts.push({ level: "info", message: "Bot offline — nenhuma ação sendo executada" });
  }

  return alerts;
}

const LEVEL_CONFIG = {
  ok: { Icon: CheckCircle, color: "hsl(152 72% 48%)", bg: "hsl(152 72% 48% / 0.1)" },
  warn: { Icon: AlertTriangle, color: "hsl(42 96% 56%)", bg: "hsl(42 96% 56% / 0.1)" },
  info: { Icon: Bell, color: "hsl(252 62% 60%)", bg: "hsl(252 62% 60% / 0.1)" },
};

export function HealthAlertsCard({ todayActions, pendingQueueCount, botOnline, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-5">
        <Skeleton className="h-4 w-36 mb-4" />
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full mb-2" />)}
      </div>
    );
  }

  const alerts = buildAlerts(todayActions, pendingQueueCount, botOnline);

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
