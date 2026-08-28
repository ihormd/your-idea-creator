import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import {
  Camera,
  FolderKanban,
  LayoutDashboard,
  ReceiptText,
  FileBarChart,
  Settings,
  LogOut,
  ChevronsUpDown,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useBusiness } from "@/lib/business";
import { ROLE_LABELS } from "@/lib/domain";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };

const jobNav: NavItem[] = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/receipts", label: "Expenses", icon: ReceiptText },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/settings", label: "Settings", icon: Settings },
];

const expenseNav: NavItem[] = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/receipts", label: "Receipts", icon: ReceiptText },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  children,
  title,
  subtitle,
  action,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const {
    business,
    role,
    memberships,
    hasAnyBusiness,
    loading: bizLoading,
    setActiveBusinessId,
  } = useBusiness();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (loading || bizLoading || !user) return;
    if ((!hasAnyBusiness || (business && !business.onboarded)) && pathname !== "/onboarding") {
      navigate({ to: "/onboarding" });
    }
  }, [loading, bizLoading, user, hasAnyBusiness, business, pathname, navigate]);

  const nav = business?.mode === "expense" ? expenseNav : jobNav;

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            {memberships.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground">
                    <span className="truncate">
                      {business?.name || "Your business"}
                      {role ? ` · ${ROLE_LABELS[role]}` : ""}
                    </span>
                    <ChevronsUpDown className="size-3 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {memberships.map((m) => (
                    <DropdownMenuItem
                      key={m.business_id}
                      onClick={() => setActiveBusinessId(m.business_id)}
                    >
                      {m.business.name || "Untitled business"} · {ROLE_LABELS[m.role]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {business?.name || "Your business"} ·{" "}
                {business?.mode === "expense" ? "Expense mode" : "Job mode"}
              </p>
            )}
            {title ? <h1 className="truncate text-xl font-semibold">{title}</h1> : null}
            {subtitle ? <p className="truncate text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {action}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-5">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur">
        <div
          className={cn(
            "mx-auto grid max-w-5xl items-end gap-1 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2",
            role === "accountant" ? "grid-cols-4" : "grid-cols-5",
          )}
        >
          {nav.slice(0, 2).map((item) => (
            <NavLink key={item.to} item={item} active={isActive(pathname, item.to)} />
          ))}
          {role !== "accountant" && (
            <div className="flex justify-center">
              <Link
                to="/scan"
                aria-label="Scan Receipt"
                className="-mt-8 flex size-16 flex-col items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[var(--shadow-raised)] transition-transform active:scale-95"
              >
                <Camera className="size-6" />
                <span className="text-[10px] font-semibold">Scan</span>
              </Link>
            </div>
          )}
          {nav.slice(2, 4).map((item) => (
            <NavLink key={item.to} item={item} active={isActive(pathname, item.to)} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function isActive(pathname: string, to: string) {
  return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-5" />
      <span>{item.label}</span>
      <span
        className={cn("h-0.5 w-6 rounded-full", active ? "bg-primary" : "bg-transparent")}
        aria-hidden
      />
    </Link>
  );
}
