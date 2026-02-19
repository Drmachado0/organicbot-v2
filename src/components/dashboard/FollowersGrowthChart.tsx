import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { GrowthPoint } from "@/hooks/useDashboardV2";

interface Props {
  data: GrowthPoint[];
  isLoading: boolean;
}

function formatDay(day: string): string {
  const d = new Date(day + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-lg p-3 text-xs border border-border/60 shadow-xl">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="font-bold text-foreground">{payload[0].value.toLocaleString()} seguidores</p>
    </div>
  );
};

export function FollowersGrowthChart({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-5">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const first = data[0]?.followers_count ?? 0;
  const last = data[data.length - 1]?.followers_count ?? 0;
  const delta = last - first;
  const peak = Math.max(...data.map((d) => d.followers_count), 0);
  const avg = data.length ? Math.round(data.reduce((s, d) => s + d.followers_count, 0) / data.length) : 0;

  return (
    <div className="glass-card rounded-xl p-5 animate-fade-in flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Crescimento de Seguidores</p>
          <p className="text-2xl font-bold mt-1">{last.toLocaleString()}</p>
        </div>
        <div className={`flex items-center gap-1 text-sm font-semibold ${delta >= 0 ? "text-follow" : "text-unfollow"}`}>
          {delta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          {delta >= 0 ? "+" : ""}{delta.toLocaleString()}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
          Sem dados de crescimento
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 18% 18%)" vertical={false} />
            <XAxis dataKey="day" tickFormatter={formatDay} tick={{ fill: "hsl(215 20% 55%)", fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="followers_count" stroke="hsl(152 72% 48%)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "hsl(152 72% 48%)" }} />
          </LineChart>
        </ResponsiveContainer>
      )}

      <div className="flex gap-4 pt-1 border-t border-border/40">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Pico</p>
          <p className="text-sm font-semibold">{peak.toLocaleString()}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Média diária</p>
          <p className="text-sm font-semibold">{avg.toLocaleString()}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Período</p>
          <p className="text-sm font-semibold">{data.length}d</p>
        </div>
      </div>
    </div>
  );
}
