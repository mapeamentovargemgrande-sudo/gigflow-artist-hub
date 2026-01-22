import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { useOrg } from "@/providers/OrgProvider";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, FileText, Handshake, LogOut } from "lucide-react";
import { Outlet } from "react-router-dom";

function TopNavItem({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      end
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border bg-card/60 px-3 py-2 text-sm font-medium text-muted-foreground transition",
        "hover:text-foreground hover:shadow-soft"
      )}
      activeClassName="text-foreground border-brand/30 bg-card shadow-soft"
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </NavLink>
  );
}

export function AppShell() {
  const { user } = useAuth();
  const { profile } = useOrg();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight">CRM do Rodrigo Lopes</div>
            <div className="truncate text-xs text-muted-foreground">
              {profile?.display_name ?? profile?.email ?? user?.email ?? ""}
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <TopNavItem to="/app/calendar" icon={CalendarDays} label="Calendário" />
            <TopNavItem to="/app/leads" icon={Handshake} label="Leads" />
            <TopNavItem to="/app/contracts" icon={FileText} label="Contratos" />
          </nav>

          <Button
            variant="secondary"
            className="gap-2"
            onClick={() => supabase.auth.signOut()}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-10">
        <Outlet />
      </main>
    </div>
  );
}
