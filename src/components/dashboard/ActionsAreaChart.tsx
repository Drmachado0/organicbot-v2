import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { DailyActionPoint } from "@/hooks/useDashboardV2";

interface Props {
  data: DailyActionPoint[];
  isLoading: boolean;
}

type Period = "7d" | "30d" | "90d";

function formatDay(day: string): string {
  const d = new Date(day + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-lg p-3 text-xs border border-border/60 shadow-xl">
      <p className="text-muted-foreground mb-2 font-medium">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="capitalize text-foreground/80">{p.name}:</span>
          <span className="font-bold text-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export function ActionsAreaChart({ data, isLoading }: Props) {
  const [period, setPeriod] = useState<Period>("30d");

  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const filtered = data.slice(-days);

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-5">
        <Skeleton className="h-4 w-48 mb-4" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Ações ao longo do tempo</p>
          <p className="text-sm text-foreground/70 mt-0.5">Follow · Unfollow · Like</p>
        </div>
        <div className="flex gap-1">
          {(["7d", "30d", "90d"] as Period[]).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={period === p ? "default" : "ghost"}
              className="h-7 px-2 text-xs"
              onClick={() => setPeriod(p)}
            >
              {p}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
          Sem dados para o período selecionado
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={filtered} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="gFollow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(152 72% 48%)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="hsl(152 72% 48%)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gUnfollow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(0 72% 55%)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="hsl(0 72% 55%)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gLike" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(330 70% 55%)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="hsl(330 70% 55%)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 18% 18%)" vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={formatDay}
              tick={{ fill: "hsl(215 20% 55%)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "hsl(215 20% 55%)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="follow" name="Follow" stroke="hsl(152 72% 48%)" strokeWidth={2} fill="url(#gFollow)" />
            <Area type="monotone" dataKey="unfollow" name="Unfollow" stroke="hsl(0 72% 55%)" strokeWidth={2} fill="url(#gUnfollow)" />
            <Area type="monotone" dataKey="like" name="Like" stroke="hsl(330 70% 55%)" strokeWidth={2} fill="url(#gLike)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
