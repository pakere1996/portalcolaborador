import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import {
  ArrowLeftRight,
  Ban,
  Calendar,
  ClipboardList,
  LogOut,
  Menu,
  UserCheck,
  Users,
  X,
  Settings,
  FileText,
  FileWarning,
  Home,
  Briefcase,
  Building2,
  ShieldAlert,
  MessageSquare,
  Megaphone,
  Bell,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";
import { AvisosPopout } from "@/components/AvisosPopout";
import logo from "@/assets/pakere-logo.png";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: any;
  end?: boolean;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();
  const path = location.pathname;
  const [open, setOpen] = useState(false);

  const getIsAdmin = () => {
    const savedRole = localStorage.getItem('user_role');
    if (savedRole) return savedRole === 'admin';
    return role === 'admin';
  };

  const isAdmin = getIsAdmin();

  useEffect(() => {
    setOpen(false);
  }, [path]);

  const getLinkClass = (isActive: boolean, isHome = false) =>
    cn(
      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
      isActive
        ? isHome
          ? "bg-red-600 text-white font-bold hover:bg-red-700"
          : "bg-primary/15 text-primary font-medium"
        : "text-muted-foreground hover:text-foreground hover:bg-accent"
    );

  // 🔥 MENU ADMIN – links diretos (sem submenus expansíveis)
  const adminMainNav: NavItem[] = [
    { to: "/admin/home", label: "Início", icon: Home },
    { to: "/admin/cadastro", label: "Cadastro", icon: Users },
    { to: "/admin/folgas", label: "Folgas", icon: Calendar },
    { to: "/admin/documentos", label: "Documentos", icon: FileText },
    { to: "/admin/comunicacao", label: "Comunicação", icon: Megaphone },
  ];

  // 🔥 MENU COLABORADOR – mantém submenus
  const employeeMainNav: NavItem[] = [
    { to: "/home", label: "Início", icon: Home },
    { to: "/perfil", label: "Meu Cadastro", icon: Settings },
  ];

  const employeeFolgaNav: NavItem[] = [
    { to: "/calendario", label: "Calendário", icon: Calendar },
    { to: "/trocas", label: "Trocas", icon: ArrowLeftRight },
    { to: "/historico", label: "Histórico", icon: ClipboardList },
  ];

  const employeeDocsNav: NavItem[] = [
    { to: "/documentos", label: "Meus Documentos", icon: FileText, end: true },
    { to: "/documentos/atestados", label: "Atestados", icon: FileWarning },
    { to: "/documentos/disciplinar", label: "Registros Disciplinares", icon: ShieldAlert },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* HEADER MOBILE */}
      <header className="md:hidden flex items-center justify-between border-b border-border bg-card/50 backdrop-blur px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Pakerê" className="size-7 rounded-md object-cover" />
          <span className="font-semibold text-sm">Portal do Colaborador</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </header>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-card/40 backdrop-blur border-r border-border transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="hidden md:flex items-center gap-3 px-6 py-5 border-b border-border">
          <img src={logo} alt="Pakerê" className="size-10 rounded-lg object-cover" />
          <div>
            <div className="font-bold text-lg leading-tight">Pakerê</div>
            <div className="text-xs text-muted-foreground">Portal do Colaborador</div>
          </div>
        </div>

        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-180px)]">
          {isAdmin ? (
            // 🔥 ADMIN: links diretos sem submenus
            <>
              {adminMainNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => getLinkClass(isActive, item.to === "/admin/home")}
                >
                  <item.icon className="size-4" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </>
          ) : (
            // 🔥 COLABORADOR: mantém submenus
            <>
              {employeeMainNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => getLinkClass(isActive, item.to === "/home")}
                >
                  <item.icon className="size-4" />
                  <span>{item.label}</span>
                </NavLink>
              ))}

              {/* Folgas - submenu para colaborador */}
              <div className="space-y-1 mt-4">
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-muted-foreground">
                  <Calendar className="size-4" />
                  <span>Folgas</span>
                </div>
                <div className="pl-4 space-y-1 border-l border-border ml-5">
                  {employeeFolgaNav.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) => getLinkClass(isActive)}
                    >
                      <item.icon className="size-4" />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>

              {/* Documentos - submenu para colaborador */}
              <div className="space-y-1 mt-4">
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-muted-foreground">
                  <FileText className="size-4" />
                  <span>Documentos</span>
                </div>
                <div className="pl-4 space-y-1 border-l border-border ml-5">
                  {employeeDocsNav.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) => getLinkClass(isActive)}
                    >
                      <item.icon className="size-4" />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            </>
          )}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-border bg-card/80 backdrop-blur">
          <div className="px-3 py-2 mb-2">
            <div className="text-sm font-medium truncate">{profile?.nome ?? "—"}</div>
            <div className="text-xs text-muted-foreground">
              {isAdmin ? "Administrador" : profile?.cargo ?? "Funcionário"}
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10" onClick={signOut}>
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden" onClick={() => setOpen(false)} />
      )}

      {/* MAIN */}
      <main className="flex-1 min-w-0 p-4 md:p-8">
        <div className="flex justify-end mb-6">
          <NotificationBell />
        </div>
        {children}
        <AvisosPopout />
      </main>
    </div>
  );
}