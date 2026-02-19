import { Target, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Campaign } from "@/hooks/useDashboardV2";

interface Props {
  campaigns: Campaign[];
  isLoading: boolean;
}

export function CampaignsCard({ campaigns, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-5">
        <Skeleton className="h-4 w-32 mb-4" />
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full mb-2" />)}
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-5 animate-fade-in flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Campanhas Ativas</p>
        <Target className="h-4 w-4 text-muted-foreground" />
      </div>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <Target className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhuma campanha ativa</p>
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between p-3 rounded-lg"
              style={{ backgroundColor: "hsl(252 62% 60% / 0.08)", border: "1px solid hsl(252 62% 60% / 0.2)" }}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                {c.niche && <p className="text-xs text-muted-foreground truncate">{c.niche}</p>}
              </div>
              <Badge
                className="ml-2 flex-shrink-0 text-xs"
                style={{ backgroundColor: "hsl(152 72% 48% / 0.15)", color: "hsl(152 72% 48%)", border: "1px solid hsl(152 72% 48% / 0.3)" }}
              >
                Ativa
              </Badge>
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
