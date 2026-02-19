import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Target,
  BarChart2,
  Settings,
  List,
  Shield,
  LogOut,
  Zap,
  ChevronLeft,
  ChevronRight,
  User,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/campaigns",  icon: Target,          label: "Campanhas"     },
  { to: "/reports",    icon: BarChart2,        label: "Relatórios"    },
  { to: "/whitelist",  icon: Shield,           label: "Whitelist"     },
  { to: "/actions",    icon: List,             label: "Log de Ações"  },
  { to: "/settings",  icon: Settings,         label: "Configurações" },
];

interface Profile {
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, email, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProfile(data as Profile);
      });
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const displayName = profile?.full_name || profile?.email?.split("@")[0] || "Usuário";
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border bg-sidebar-background"
    >
      <SidebarContent className="flex flex-col h-full gap-0">
        {/* ── Logo ── */}
        <div
          className={cn(
            "flex items-center gap-2.5 px-4 h-14 border-b border-sidebar-border flex-shrink-0",
            collapsed && "justify-center px-0"
          )}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: "hsl(152 72% 48% / 0.15)",
              border: "1px solid hsl(152 72% 48% / 0.4)",
            }}
          >
            <Zap className="h-4 w-4 text-primary" />
          </div>
          {!collapsed && (
            <span className="font-bold text-sm tracking-tight text-sidebar-foreground">
              Organic Pro
            </span>
          )}
        </div>

        {/* ── Nav items ── */}
        <SidebarGroup className="flex-1 py-3">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {navItems.map(({ to, icon: Icon, label }) => {
                const isActive = location.pathname === to;
                return (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton asChild tooltip={collapsed ? label : undefined}>
                      <NavLink
                        to={to}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 w-full",
                          collapsed && "justify-center px-0",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                        )}
                      >
                        <div className="relative flex-shrink-0">
                          <Icon className="h-4 w-4" />
                          {isActive && (
                            <span
                              className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-4 rounded-r-full"
                              style={{ backgroundColor: "hsl(152 72% 48%)" }}
                            />
                          )}
                        </div>
                        {!collapsed && <span>{label}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Bottom: user + collapse + logout ── */}
        <div className="border-t border-sidebar-border px-2 py-3 flex flex-col gap-1 flex-shrink-0">

          {/* User profile row */}
          <div
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg mb-1",
              collapsed && "justify-center px-0"
            )}
            style={{ backgroundColor: "hsl(220 18% 10%)" }}
          >
            {/* Avatar */}
            <div className="flex-shrink-0">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: "hsl(152 72% 48% / 0.2)",
                    color: "hsl(152 72% 48%)",
                    border: "1px solid hsl(152 72% 48% / 0.3)",
                  }}
                >
                  {initials || <User className="h-3.5 w-3.5" />}
                </div>
              )}
            </div>

            {/* Name + email */}
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-sidebar-foreground truncate leading-tight">
                  {displayName}
                </p>
                {profile?.email && (
                  <p className="text-[10px] text-sidebar-foreground/40 truncate leading-tight">
                    {profile.email}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Collapse toggle */}
          <button
            onClick={toggleSidebar}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full transition-all duration-150",
              "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent",
              collapsed && "justify-center px-0"
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 flex-shrink-0" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 flex-shrink-0" />
                <span>Recolher</span>
              </>
            )}
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full transition-all duration-150",
              "text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10",
              collapsed && "justify-center px-0"
            )}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
