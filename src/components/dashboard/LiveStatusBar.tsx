import { useState, useEffect } from "react";
import { Clock, Wifi, WifiOff, Zap } from "lucide-react";
import type { DashboardAccount } from "@/hooks/useDashboardV2";

interface Props {
  account: DashboardAccount | null;
}

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
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

export function LiveStatusBar({ account }: Props) {
  const [countdown, setCountdown] = useState(47);
  const [sessionMs, setSessionMs] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? Math.floor(Math.random() * 60) + 20 : prev - 1));
      setSessionMs((prev) => prev + 1000);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const isOnline = account?.bot_online ?? false;
  const mode = getModeLabel(account?.bot_mode ?? null);

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

      {/* Session time */}
      <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
        <Clock className="h-3.5 w-3.5" />
        <span>
          {isOnline ? (
            <>Rodando há <span className="text-foreground font-medium">{formatDuration(sessionMs)}</span></>
          ) : (
            <span>Sessão inativa</span>
          )}
        </span>
      </div>

      {isOnline && (
        <>
          <div className="w-px h-4 bg-border/60 hidden sm:block" />
          <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span>
              Próxima ação em{" "}
              <span className="text-foreground font-medium tabular-nums">{countdown}s</span>
            </span>
          </div>
        </>
      )}

      {account && (
        <div className="ml-auto text-xs text-muted-foreground hidden md:block">
          @{account.ig_username}
        </div>
      )}
    </div>
  );
}
