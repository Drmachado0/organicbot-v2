import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff, User, Clock } from "lucide-react";
import type { DashboardAccount } from "@/hooks/useDashboardV2";

function heartbeatLabel(last: string | null): string {
  if (!last) return "Nunca";
  const diff = Math.floor((Date.now() - new Date(last).getTime()) / 1000);
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

function botModeLabel(mode: string | null): string {
  const map: Record<string, string> = {
    seguir_curtir: "Seguir + Curtir",
    seguir: "Só Seguir",
    curtir: "Só Curtir",
    unfollow: "Unfollow",
  };
  return mode ? (map[mode] ?? mode) : "—";
}

interface Props {
  accounts: DashboardAccount[];
  activeAccountId: string | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
  userId: string | null;
}

export function AccountCardsPanel({ accounts, activeAccountId, isLoading, onSelect, userId }: Props) {
  const [liveAccounts, setLiveAccounts] = useState<DashboardAccount[]>(accounts);

  // Sync with parent prop changes
  useEffect(() => {
    setLiveAccounts(accounts);
  }, [accounts]);

  // Realtime subscription for live updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`account-cards-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ig_accounts",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as DashboardAccount;
          setLiveAccounts((prev) =>
            prev.map((a) =>
              a.id === row.id
                ? {
                    ...a,
                    bot_online: row.bot_online,
                    bot_status: row.bot_status,
                    bot_mode: row.bot_mode,
                    queue_total: row.queue_total,
                    queue_processed: row.queue_processed,
                    followers_count: row.followers_count,
                    following_count: row.following_count,
                    last_heartbeat: row.last_heartbeat,
                    profile_pic_url: row.profile_pic_url,
                  }
                : a
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Heartbeat label ticks every 10s
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-1">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-48 flex-shrink-0 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (liveAccounts.length <= 1) return null; // Only show panel for multi-account

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 animate-fade-in">
      {liveAccounts.map((acc) => {
        const isActive = acc.id === activeAccountId;
        const online = acc.bot_online === true;
        const pending = (acc.queue_total ?? 0) - (acc.queue_processed ?? 0);

        return (
          <button
            key={acc.id}
            onClick={() => onSelect(acc.id)}
            className={cn(
              "flex-shrink-0 w-48 rounded-2xl p-3.5 text-left transition-all duration-200 cursor-pointer group",
              "glass-card border hover:border-primary/40",
              isActive
                ? "border-primary/50 shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]"
                : "border-border/40"
            )}
          >
            {/* Avatar + online badge */}
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="relative flex-shrink-0">
              {acc.profile_pic_url ? (
                  <img
                    src={acc.profile_pic_url}
                    alt={acc.ig_username}
                    className="h-9 w-9 rounded-full object-cover"
                    style={{ outline: `2px solid ${online ? "hsl(152 72% 48% / 0.5)" : "hsl(220 18% 28%)"}`, outlineOffset: "1px" }}
                  />
                ) : (
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: "hsl(220 18% 18%)",
                      outline: `2px solid ${online ? "hsl(152 72% 48% / 0.4)" : "hsl(220 18% 28%)"}`,
                      outlineOffset: "1px",
                    }}
                  >
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                {/* Online indicator */}
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background flex-shrink-0"
                  style={{ backgroundColor: online ? "hsl(152 72% 48%)" : "hsl(220 18% 35%)" }}
                >
                  {online && (
                    <span
                      className="absolute inset-0 rounded-full animate-ping opacity-60"
                      style={{ backgroundColor: "hsl(152 72% 48%)" }}
                    />
                  )}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate leading-tight">@{acc.ig_username}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  {online ? (
                    <Wifi className="h-2.5 w-2.5 flex-shrink-0" style={{ color: "hsl(152 72% 48%)" }} />
                  ) : (
                    <WifiOff className="h-2.5 w-2.5 flex-shrink-0 text-muted-foreground" />
                  )}
                  <span
                    className="text-[10px] font-semibold"
                    style={{ color: online ? "hsl(152 72% 48%)" : "hsl(var(--muted-foreground))" }}
                  >
                    {online ? "Online" : "Offline"}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Modo</span>
                <span className="text-[10px] font-medium text-foreground truncate max-w-[6rem] text-right">
                  {botModeLabel(acc.bot_mode)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Fila</span>
                <span
                  className="text-[10px] font-semibold tabular-nums"
                  style={{
                    color: pending > 500 ? "hsl(42 96% 56%)" : pending > 0 ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                  }}
                >
                  {pending > 0 ? pending.toLocaleString() + " pend." : "Vazia"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <Clock className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {/* tick forces re-render for live label */}
                  {tick >= 0 && heartbeatLabel(acc.last_heartbeat)}
                </span>
              </div>
            </div>

            {/* Active indicator bar */}
            {isActive && (
              <div
                className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full"
                style={{ backgroundColor: "hsl(152 72% 48%)" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
