import { useState, useEffect } from "react";
import { Clock, Wifi, WifiOff, Chrome } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { DashboardAccount } from "@/hooks/useDashboardV2";

interface Props {
  account: DashboardAccount | null;
}

function formatHeartbeatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function getModeLabel(mode: string | null): string {
  if (!mode) return "Desconhecido";
  const map: Record<string, string> = {
    seguir_curtir: "Follow + Like",
    seguir: "Follow Mode",
    desseguir: "Unfollow Mode",
    curtir: "Like Mode",
    mixed: "Mixed Mode",
  };
  return map[mode] ?? mode;
}

function getExtensionStatus(lastHeartbeat: string | null): "online" | "away" | "offline" {
  if (!lastHeartbeat) return "offline";
  const diff = Date.now() - new Date(lastHeartbeat).getTime();
  if (diff < 6 * 60 * 1000) return "online";
  if (diff < 30 * 60 * 1000) return "away";
  return "offline";
}

const extStatusConfig = {
  online:  { label: "Extensão ativa",   color: "hsl(152 72% 48%)", bg: "hsl(152 72% 48% / 0.12)" },
  away:    { label: "Extensão ausente", color: "hsl(42 96% 56%)",  bg: "hsl(42 96% 56% / 0.12)"  },
  offline: { label: "Extensão offline", color: "hsl(215 20% 45%)", bg: "hsl(215 20% 45% / 0.08)" },
};

export function LiveStatusBar({ account }: Props) {
  // Tick every 10s to keep heartbeat label fresh
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const isOnline = account?.bot_online ?? false;
  const mode = getModeLabel(account?.bot_mode ?? null);
  const extStatus = getExtensionStatus(account?.last_heartbeat ?? null);
  const extCfg = extStatusConfig[extStatus];

  const heartbeatAge = account?.last_heartbeat
    ? Math.floor((Date.now() - new Date(account.last_heartbeat).getTime()) / 1000)
    : null;

  return (
    <div
      className="glass-card rounded-xl px-4 py-3 flex flex-wrap items-center gap-4 animate-fade-in"
      style={{ borderColor: isOnline ? "hsl(152 72% 48% / 0.4)" : "hsl(0 72% 55% / 0.3)" }}
    >
      {/* Status dot */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="relative flex h-3 w-3">
          {isOnline && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          )}
          <span
            className="relative inline-flex rounded-full h-3 w-3"
            style={{ backgroundColor: isOnline ? "hsl(152 72% 48%)" : "hsl(0 72% 55%)" }}
          />
        </span>
        <span className="text-sm font-semibold" style={{ color: isOnline ? "hsl(152 72% 48%)" : "hsl(0 72% 55%)" }}>
          {isOnline ? "Bot Online" : "Bot Offline"}
        </span>
      </div>

      <div className="w-px h-4 bg-border/60 hidden sm:block" />

      {/* Mode */}
      <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
        {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        <span>{mode}</span>
      </div>

      <div className="w-px h-4 bg-border/60 hidden sm:block" />

      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 text-muted-foreground text-sm cursor-default">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {heartbeatAge !== null ? (
                <>Último heartbeat há <span className="text-foreground font-medium">{formatHeartbeatAge(heartbeatAge)}</span></>
              ) : (
                <span>Sem heartbeat</span>
              )}
            </span>
          </div>
        </TooltipTrigger>
        {account?.last_heartbeat && (
          <TooltipContent>
            {new Date(account.last_heartbeat).toLocaleString("pt-BR")}
          </TooltipContent>
        )}
      </Tooltip>

      {/* Extension heartbeat badge */}
      <div
        className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0"
        style={{ color: extCfg.color, backgroundColor: extCfg.bg }}
        title={account?.last_heartbeat ? `Último heartbeat: ${new Date(account.last_heartbeat).toLocaleTimeString("pt-BR")}` : "Sem heartbeat registrado"}
      >
        <Chrome className="h-3 w-3" />
        {extCfg.label}
      </div>

      {account && (
        <div className="text-xs text-muted-foreground hidden md:block">
          @{account.ig_username}
        </div>
      )}
    </div>
  );
}
