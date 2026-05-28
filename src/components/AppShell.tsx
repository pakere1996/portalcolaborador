import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeftRight, Ban, Calendar, ClipboardList, LogOut, Menu, Shield, UserCheck, Users, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";
import logo from "@/assets/pakere-logo.png";

interface NavItem { to: string; label: string; icon: typeof Calendar }

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();
  const path = location.pathname;
  const [open, setOpen] = useState(false);

  const employeeNav: NavItem[] = [
    { to: "/calendario", label: "Calendário", icon: Calendar },
    { to: "/trocas", label: "Trocas", icon: ArrowLeftRight },
    { to: "/historico", label: "Histórico", icon: ClipboardList },
  ];
  const adminNav: NavItem[] = [
    { to: "/admin", label: "Dashboard", icon: Shield },
    { to: "/admin/calendario", label: "Calendário Geral", icon: Calendar },
    { to: "/admin/solicitacoes", label: "Solicitações", icon: ClipboardList },
    { to: "/admin/aprovacoes", label: "Aprovações", icon: UserCheck },
    { to: "/admin/trocas", label: "Trocas", icon: ArrowLeftRight },
    { to: "/admin/bloqueios", label: "Datas Bloqueadas", icon: Ban },
    { to: "/admin/funcionarios", label: "Funcionários", icon: Users },
  ];

  const nav = role === "admin" ? adminNav : employeeNav;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <header className="md:hidden flex items-center justify-between border-b border-border bg-card/50 backdrop-blur px-4 py-3">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Pakerê" className="size-7 rounded-md object-cover" />
          <span className="font-semibold">Portal do Colaborador</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </header>

      <aside className={`${open ? "block" : "hidden"} md:block md:w-64 shrink-0 border-r border-border bg-card/40 backdrop-blur md:min-h-screen`}>
        <div className="hidden md:flex items-center gap-3 px-6 py-5 border-b border-border">
          <img src={logo} alt="Pakerê" className="size-10 rounded-lg object-cover" />
          <div>
            <div className="font-bold text-lg leading-tight">Pakerê</div>
            <div className="text-xs text-muted-foreground">Gestão de Folgas</div>
          </div>
        </div>
        <nav className="p-3 space-y-1">
          {nav.map((item) => {
            const active = path === item.to || (item.to !== "/" && path.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border mt-4">
          <div className="px-3 py-2 mb-2">
            <div className="text-sm font-medium truncate">{profile?.nome ?? "—"}</div>
            <div className="text-xs text-muted-foreground">
              {role === "admin" ? "Administrador" : profile?.cargo ?? "Funcionário"}
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-4 md:p-8">
        <div className="hidden md:flex justify-end mb-2">
          <NotificationBell />
        </div>
        {children}
      </main>
    </div>
  );
}