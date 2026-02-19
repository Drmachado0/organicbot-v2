import { useState } from "react";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ActionLogRow } from "@/hooks/useDashboardV2";

interface Props {
  actions: ActionLogRow[];
  isLoading: boolean;
}

type Filter = "all" | "follow" | "unfollow" | "like";

const ACTION_BADGE: Record<string, { label: string; color: string }> = {
  follow: { label: "Follow", color: "hsl(152 72% 48%)" },
  unfollow: { label: "Unfollow", color: "hsl(0 72% 55%)" },
  like: { label: "Like", color: "hsl(330 70% 55%)" },
};

function formatTime(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function RecentActionsTable({ actions, isLoading }: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = filter === "all" ? actions : actions.filter((a) => a.action_type.toLowerCase() === filter);

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-5">
        <Skeleton className="h-4 w-40 mb-4" />
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-9 w-full mb-2" />)}
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Log de Ações Recentes</p>
        <div className="flex gap-1">
          {(["all", "follow", "unfollow", "like"] as Filter[]).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "ghost"}
              className="h-7 px-2 text-xs capitalize"
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Todos" : f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center text-muted-foreground text-sm py-8">
          Nenhuma ação encontrada
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40">
                <th className="text-left text-xs text-muted-foreground font-medium pb-2 pr-3 w-24">Horário</th>
                <th className="text-left text-xs text-muted-foreground font-medium pb-2 pr-3 w-24">Tipo</th>
                <th className="text-left text-xs text-muted-foreground font-medium pb-2 pr-3">Target</th>
                <th className="text-center text-xs text-muted-foreground font-medium pb-2 pr-3 w-16">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((action, idx) => {
                const badge = ACTION_BADGE[action.action_type.toLowerCase()];
                const isNew = idx === 0;
                return (
                  <tr
                    key={action.id}
                    className={cn(
                      "border-b border-border/20 last:border-0 transition-all",
                      isNew && "animate-fade-in"
                    )}
                  >
                    <td className="py-2.5 pr-3 text-muted-foreground text-xs tabular-nums whitespace-nowrap">
                      <Clock className="inline h-3 w-3 mr-1 opacity-60" />
                      {formatTime(action.executed_at)}
                    </td>
                    <td className="py-2.5 pr-3">
                      {badge ? (
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                          style={{ backgroundColor: badge.color + "22", color: badge.color, border: `1px solid ${badge.color}44` }}
                        >
                          {badge.label}
                        </span>
                      ) : (
                        <Badge variant="outline" className="text-xs h-5">{action.action_type}</Badge>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-foreground/80">
                      {action.target_username ? (
                        <span className="font-medium">@{action.target_username}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-center">
                      {action.status === "success" ? (
                        <CheckCircle className="h-4 w-4 mx-auto" style={{ color: "hsl(152 72% 48%)" }} />
                      ) : action.status === "failed" || action.status === "error" ? (
                        <XCircle className="h-4 w-4 mx-auto" style={{ color: "hsl(0 72% 55%)" }} />
                      ) : (
                        <Clock className="h-4 w-4 mx-auto text-muted-foreground" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
