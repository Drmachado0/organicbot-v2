import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: ReactNode;
  badge?: { label: string; variant?: "default" | "destructive" | "secondary" | "outline" };
  delta?: { value: number; label?: string };
  accentColor?: string;
  isLoading?: boolean;
  children?: ReactNode;
  progress?: { current: number; total: number };
}

export function KpiCard({ label, value, subtext, icon, badge, delta, accentColor, isLoading, children, progress }: Props) {
  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-5 space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-3 w-40" />
      </div>
    );
  }

  const deltaPositive = delta && delta.value >= 0;
  const progressPct = progress && progress.total > 0 ? Math.min(100, Math.round((progress.current / progress.total) * 100)) : 0;

  return (
    <div className="glass-card rounded-xl p-5 animate-fade-in flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">{label}</p>
        <div className="flex items-center gap-2">
          {badge && (
            <Badge variant={badge.variant ?? "default"} className="text-xs h-5 px-2">
              {badge.label}
            </Badge>
          )}
          {icon && <span className="text-muted-foreground">{icon}</span>}
        </div>
      </div>

      <div
        className="text-3xl font-bold tabular-nums leading-none"
        style={accentColor ? { color: accentColor } : undefined}
      >
        {value}
      </div>

      {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}

      {progress && progress.total > 0 && (
        <div className="space-y-1 mt-0.5">
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, backgroundColor: "hsl(152 72% 48%)" }}
            />
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {progress.current.toLocaleString()} de {progress.total.toLocaleString()} processados ({progressPct}%)
          </p>
        </div>
      )}

      {delta && (
        <div className={cn("flex items-center gap-1 text-xs font-medium", deltaPositive ? "text-follow" : "text-unfollow")}>
          {deltaPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          <span>
            {deltaPositive ? "+" : ""}
            {delta.value} {delta.label ?? "hoje"}
          </span>
        </div>
      )}

      {children}
    </div>
  );
}
