import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { SessionRow } from "@/hooks/useDashboardV2";

interface Props {
  sessions: SessionRow[];
  isLoading: boolean;
}

function formatDate(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return "—";
  const endTime = end ? new Date(end).getTime() : Date.now();
  const ms = endTime - new Date(start).getTime();
  if (ms < 0) return "—";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getSuccessRate(session: SessionRow): number {
  const total = (session.follows_count ?? 0) + (session.unfollows_count ?? 0) + (session.likes_count ?? 0);
  if (total === 0) return 0;
  const errors = session.errors_count ?? 0;
  return Math.round(((total - errors) / total) * 100);
}

function rateColor(rate: number): string {
  if (rate >= 90) return "hsl(152 72% 48% / 0.15)";
  if (rate >= 70) return "hsl(42 96% 56% / 0.1)";
  return "hsl(0 72% 55% / 0.12)";
}

function rateTextColor(rate: number): string {
  if (rate >= 90) return "hsl(152 72% 48%)";
  if (rate >= 70) return "hsl(42 96% 56%)";
  return "hsl(0 72% 55%)";
}

export function SessionsTable({ sessions, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-5">
        <Skeleton className="h-4 w-36 mb-4" />
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full mb-2" />)}
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-5 animate-fade-in flex flex-col gap-4">
      <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Sessões Recentes</p>

      {sessions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm py-8">
          Nenhuma sessão registrada
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40">
                <th className="text-left text-xs text-muted-foreground font-medium pb-2 pr-3">Data</th>
                <th className="text-right text-xs text-muted-foreground font-medium pb-2 pr-3">Duração</th>
                <th className="text-right text-xs text-muted-foreground font-medium pb-2 pr-3">Follows</th>
                <th className="text-right text-xs text-muted-foreground font-medium pb-2 pr-3">Erros</th>
                <th className="text-right text-xs text-muted-foreground font-medium pb-2">Taxa</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const rate = getSuccessRate(s);
                return (
                  <tr
                    key={s.id}
                    className={cn("border-b border-border/20 last:border-0")}
                    style={{ backgroundColor: rateColor(rate) }}
                  >
                    <td className="py-2 pr-3 text-foreground/80 whitespace-nowrap">{formatDate(s.session_start)}</td>
                    <td className="py-2 pr-3 text-right text-foreground/70">{formatDuration(s.session_start, s.session_end)}</td>
                    <td className="py-2 pr-3 text-right font-medium" style={{ color: "hsl(152 72% 48%)" }}>{s.follows_count ?? 0}</td>
                    <td className="py-2 pr-3 text-right" style={{ color: s.errors_count ? "hsl(0 72% 55%)" : "hsl(215 20% 55%)" }}>{s.errors_count ?? 0}</td>
                    <td className="py-2 text-right font-bold" style={{ color: rateTextColor(rate) }}>{rate}%</td>
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
