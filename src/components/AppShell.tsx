import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import {
  ArrowLeftRight,
  Ban,
  Calendar,
  ClipboardList,
  LogOut,
  Menu,
  Shield,
  UserCheck,
  Users,
  X,
  ChevronDown,
  ChevronRight,
  Settings,
  FileText,
  FileWarning,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";
import logo from "@/assets/pakere-logo.png";
import { cn } from "@/lib/utils";

interface NavItem { to: string; label: string; icon: any }

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();
  const path = location.pathname;
  const [open, setOpen] = useState(false);
  const [folgasOpen, setFolgasOpen] = useState(true);
  const [docsOpen, setDocsOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  useEffect(() => {
    if (path.startsWith("/documentos") || path.startsWith("/admin/documentos")) {
      setDocsOpen(true);
    }
  }, [path]);

  const employeeFolgaNav: NavItem[] = [
    { to: "/calendario", label: "Calendário", icon: Calendar },
    { to: "/trocas", label: "Trocas", icon: ArrowLeftRight },
    { to: "/historico", label: "Histórico", icon: ClipboardList },
  ];

  const adminFolgaNav: NavItem[] = [
    { to: "/admin", label: "Dashboard", icon: Shield },
    { to: "/admin/calendario", label: "Calendário Geral", icon: Calendar },
    { to: "/admin/solicitacoes", label: "Solicitações", icon: ClipboardList },
    { to: "/admin/aprovacoes", label: "Aprovações", icon: UserCheck },
    { to: "/admin/trocas", label: "Trocas", icon: ArrowLeftRight },
    { to: "/admin/bloqueios", label: "Datas Bloqueadas", icon: Ban },
  ];

  const employeeDocsNav: NavItem[] = [
    { to: "/documentos", label: "Contracheques", icon: FileText },
    { to: "/documentos/ponto", label: "Folhas de Ponto", icon: FileText },
    { to: "/documentos/atestados", label: "Atestados", icon: FileWarning },
  ];

  const adminDocsNav: NavItem[] = [
    { to: "/admin/documentos", label: "Contracheques", icon: FileText },
    { to: "/admin/documentos/ponto", label: "Folhas de Ponto", icon: FileText },
    { to: "/admin/documentos/atestados", label: "Atestados", icon: FileWarning },
    { to: "/admin/documentos/disciplinar", label: "Registros Disciplinares", icon: Shield },
  ];

  const isAdmin = role === "admin";
  const folgaNav = isAdmin ? adminFolgaNav : employeeFolgaNav;
  const docsNav = isAdmin ? adminDocsNav : employeeDocsNav;
  
  // A home agora é a rota principal
  const homePath = isAdmin ? "/admin/home" : "/home";

  const isFolgaActive = path.startsWith("/calendario") ||
    path.startsWith("/trocas") ||
    path.startsWith("/historico") ||
    (path.startsWith("/admin") && path !== "/admin/funcionarios" && !path.startsWith("/admin/documentos"));
  const isDocsActive = path.startsWith("/documentos") || path.startsWith("/admin/documentos");

  const cadastroPath = isAdmin ? "/admin/funcionarios" : "/perfil";
  const cadastroLabel = isAdmin ? "Gestão de Equipe" : "Meu Cadastro";

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <header className="md:hidden flex items-center justify-between border-b border-border bg-card/50 backdrop-blur px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Pakerê" className="size-7 rounded-md object-cover" />
          <span className="font-semibold text-sm">Portal do Colaborador</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </header>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-card/40 backdrop-blur border-r border-border transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="hidden md:flex items-center gap-3 px-6 py-5 border-b border-border">
          <img src={logo} alt="Pakerê" className="size-10 rounded-lg object-cover" />
          <div>
            <div className="font-bold text-lg leading-tight">Pakerê</div>
            <div className="text-xs text-muted-foreground">Portal do Colaborador</div>
          </div>
        </div>

        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-180px)]">
          {/* Link para a Home/Dashboard principal */}
          <Link
            to={homePath}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors mb-2",
              path === homePath
                ? "bg-red-600 text-white font-bold hover:bg-red-700"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            <Shield className="size-4" />
            <span>{isAdmin ? "Dashboard Principal" : "Home"}</span>
          </Link>

          {/* Link para Cadastro/Gestão de Equipe */}
          <Link
            to={cadastroPath}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors mb-2",
              path === cadastroPath
                ? "bg-primary/15 text-primary font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            {isAdmin ? <Users className="size-4" /> : <Settings className="size-4" />}
            <span>{cadastroLabel}</span>
          </Link>

          <div className="space-y-1">
            <button
              onClick={() => setFolgasOpen(!folgasOpen)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-colors",
                isFolgaActive ? "text-primary bg-primary/5" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <div className="flex items-center gap-3">
                <Calendar className="size-4" />
                <span>Folgas</span>
              </div>
              {folgasOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            </button>

            {folgasOpen && (
              <div className="pl-4 space-y-1 mt-1 border-l border-border ml-5">
                {folgaNav.map((item) => {
                  const active = path === item.to;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                        active
                          ? "bg-primary/15 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent",
                      )}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <button
              onClick={() => setDocsOpen(!docsOpen)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-colors",
                isDocsActive ? "text-primary bg-primary/5" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <div className="flex items-center gap-3">
                <FileText className="size-4" />
                <span>Documentos</span>
              </div>
              {docsOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            </button>

            {docsOpen && (
              <div className="pl-4 space-y-1 mt-1 border-l border-border ml-5">
                {docsNav.map((item) => {
                  const active = path === item.to || path.startsWith(`${item.to}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                        active
                          ? "bg-primary/15 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent",
                      )}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-border bg-card/80 backdrop-blur">
          <div className="px-3 py-2 mb-2">
            <div className="text-sm font-medium truncate">{profile?.nome ?? "—"}</div>
            <div className="text-xs text-muted-foreground">
              {role === "admin" ? "Administrador" : profile?.cargo ?? "Funcionário"}
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10" onClick={signOut}>
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <main className="flex-1 min-w-0 p-4 md:p-8">
        <div className="hidden md:flex justify-end mb-6">
          <NotificationBell />
        </div>
        {children}
      </main>
    </div>
  );
}