import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full bg-background text-foreground">
        <AppSidebar />

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile topbar — only shows the hamburger trigger */}
          <header className="sticky top-0 z-40 flex items-center h-12 px-4 border-b border-border/40 bg-background/80 backdrop-blur-md lg:hidden">
            <SidebarTrigger className="h-8 w-8 text-muted-foreground hover:text-foreground" />
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
