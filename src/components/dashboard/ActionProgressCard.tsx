import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, UserMinus, Heart } from "lucide-react";
import type { TodayAction } from "@/hooks/useDashboardV2";

interface Props {
  todayActions: TodayAction[];
  isLoading: boolean;
}

const LIMITS = {
  follow: 150,
  unfollow: 120,
  like: 300,
};

const ACTION_CONFIG = [
  {
    key: "follow",
    label: "Follow",
    icon: UserPlus,
    colorClass: "text-follow",
    barColor: "hsl(152 72% 48%)",
    bgColor: "hsl(152 72% 48% / 0.12)",
  },
  {
    key: "unfollow",
    label: "Unfollow",
    icon: UserMinus,
    colorClass: "text-unfollow",
    barColor: "hsl(0 72% 55%)",
    bgColor: "hsl(0 72% 55% / 0.12)",
  },
  {
    key: "like",
    label: "Like",
    icon: Heart,
    colorClass: "text-like",
    barColor: "hsl(330 70% 55%)",
    bgColor: "hsl(330 70% 55% / 0.12)",
  },
];

export function ActionProgressCard({ todayActions, isLoading }: Props) {
  const getCount = (key: string) =>
    todayActions.find((a) => a.action_type.toLowerCase() === key)?.count ?? 0;

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-5 space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-5 animate-fade-in">
      <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-4">
        Ações de Hoje
      </p>
      <div className="space-y-4">
        {ACTION_CONFIG.map(({ key, label, icon: Icon, colorClass, barColor, bgColor }) => {
          const count = getCount(key);
          const limit = LIMITS[key as keyof typeof LIMITS];
          const pct = Math.min(Math.round((count / limit) * 100), 100);
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1.5">
                <div className={`flex items-center gap-1.5 text-sm font-medium ${colorClass}`}>
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-semibold text-foreground">{count}</span>
                  <span className="text-muted-foreground">/ {limit}</span>
                  <span
                    className="ml-1 font-bold tabular-nums"
                    style={{ color: barColor }}
                  >
                    {pct}%
                  </span>
                </div>
              </div>
              <div className="relative h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: bgColor }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, backgroundColor: barColor }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
