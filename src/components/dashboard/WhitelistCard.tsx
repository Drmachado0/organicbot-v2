import { Shield, ArrowRight, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { WhitelistRow } from "@/hooks/useDashboardV2";

interface Props {
  count: number;
  preview: WhitelistRow[];
  isLoading: boolean;
}

export function WhitelistCard({ count, preview, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-5">
        <Skeleton className="h-4 w-28 mb-4" />
        <Skeleton className="h-10 w-full mb-2" />
        <Skeleton className="h-10 w-full mb-2" />
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-5 animate-fade-in flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Whitelist</p>
        <Shield className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="flex items-center gap-3">
        <span className="text-3xl font-bold">{count}</span>
        <span className="text-sm text-muted-foreground">usuários protegidos</span>
      </div>

      {preview.length > 0 && (
        <div className="space-y-1.5">
          {preview.map((u) => (
            <div key={u.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: "hsl(220 18% 14%)" }}>
              <UserCheck className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              <span className="text-sm text-foreground/80 truncate">@{u.username}</span>
            </div>
          ))}
        </div>
      )}

      <Button variant="ghost" size="sm" className="text-xs self-start h-7 px-2 gap-1 text-muted-foreground hover:text-foreground">
        Gerenciar <ArrowRight className="h-3 w-3" />
      </Button>
    </div>
  );
}
