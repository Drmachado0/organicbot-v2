import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { useBotOfflineAlert } from "@/hooks/useBotOfflineAlert";
import { useBotStatus } from "@/hooks/useBotStatus";
import { Wifi, WifiOff } from "lucide-react";

function BotAlertListener() {
  const { user } = useAuth();
  useBotOfflineAlert(user);
  return null;
}

function BotStatusBadge() {
  const { user } = useAuth();
  const { online, offline, total } = useBotStatus(user);

  if (total === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {online > 0 && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
          style={{
            backgroundColor: "hsl(152 72% 48% / 0.12)",
            borderColor: "hsl(152 72% 48% / 0.35)",
            color: "hsl(152 72% 48%)",
          }}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: "hsl(152 72% 48%)" }} />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5"
              style={{ backgroundColor: "hsl(152 72% 48%)" }} />
          </span>
          <Wifi className="h-3 w-3" />
          {online} online
        </span>
      )}
      {offline > 0 && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-destructive/30 bg-destructive/10 text-destructive">
          <WifiOff className="h-3 w-3" />
          {offline} offline
        </span>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full bg-background text-foreground">
        <BotAlertListener />
        <AppSidebar />

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar — hamburger on mobile + bot status badge on all sizes */}
          <header className="sticky top-0 z-40 flex items-center justify-between h-12 px-4 border-b border-border/40 bg-background/80 backdrop-blur-md">
            <SidebarTrigger className="h-8 w-8 text-muted-foreground hover:text-foreground lg:hidden" />
            <div className="flex-1 flex justify-end">
              <BotStatusBadge />
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

