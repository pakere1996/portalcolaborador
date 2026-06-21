import { NavLink, useLocation } from "react-router-dom";
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
  Home,
  Briefcase,
  Building2,
  ShieldAlert,
  MessageSquare,
  Bell,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
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

  const [folgasOpen, setFolgasOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [cadastroOpen, setCadastroOpen] = useState(false);
  const [comunicacaoOpen, setComunicacaoOpen] = useState(false);

  const toggleMenu = useCallback(
    (menu: "folgas" | "docs" | "cadastro" | "comunicacao") => {
      const setters = {
        folgas: setFolgasOpen,
        docs: setDocsOpen,
        cadastro: setCadastroOpen,
        comunicacao: setComunicacaoOpen,
      };

      Object.values(setters).forEach((setter) => setter(false));
      const currentState = {
        folgas: folgasOpen,
        docs: docsOpen,
        cadastro: cadastroOpen,
        comunicacao: comunicacaoOpen,
      }[menu];
      setters[menu](!currentState);
    },
    [folgasOpen, docsOpen, cadastroOpen, comunicacaoOpen]
  );

  const getIsAdmin = () => {
    const savedRole = localStorage.getItem('user_role');
    if (savedRole) return savedRole === 'admin';
    return role === 'admin';
  };

  const isAdmin = getIsAdmin();
  const homePath = isAdmin ? "/admin/home" : "/home";

  useEffect(() => {
    setOpen(false);
  }, [path]);

  useEffect(() => {
    const shouldOpen = {
      cadastro:
        path.startsWith("/admin/colaboradores") ||
        path.startsWith("/admin/cargos") ||
        path.startsWith("/admin/unidades"),
      docs: path.includes("/documentos"),
      comunicacao:
        path.startsWith("/admin/mensagens") ||
        path.startsWith("/admin/avisos"),
      folgas:
        path.includes("/calendario") ||
        path.includes("/trocas") ||
        path.includes("/historico") ||
        (path.startsWith("/admin") &&
          !path.includes("/documentos") &&
          !path.includes("/colaboradores") &&
          !path.includes("/mensagens") &&
          !path.includes("/avisos") &&
          !path.includes("/home")),
    };

    setFolgasOpen(shouldOpen.folgas);
    setDocsOpen(shouldOpen.docs);
    setCadastroOpen(shouldOpen.cadastro);
    setComunicacaoOpen(shouldOpen.comunicacao);
  }, [path]);

  // Navegação do colaborador
  const employeeFolgaNav: NavItem[] = [
    { to: "/calendario", label: "Calendário", icon: Calendar },
    { to: "/trocas", label: "Trocas", icon: ArrowLeftRight },
    { to: "/historico", label: "Histórico", icon: ClipboardList },
  ];

  const adminFolgaNav: NavItem[] = [
    { to: "/admin/folgas", label: "Dashboard", icon: Shield },
    { to: "/admin/calendario", label: "Calendário Geral", icon: Calendar },
    { to: "/admin/solicitacoes", label: "Solicitações", icon: ClipboardList },
    { to: "/admin/aprovacoes", label: "Aprovações", icon: UserCheck },
    { to: "/admin/trocas", label: "Trocas", icon: ArrowLeftRight },
    { to: "/admin/bloqueios", label: "Datas Bloqueadas", icon: Ban },
  ];

  const employeeDocsNav: NavItem[] = [
    { to: "/documentos", label: "Meus Documentos", icon: FileText, end: true },
    { to: "/documentos/atestados", label: "Atestados", icon: FileWarning },
    { to: "/documentos/disciplinar", label: "Registros Disciplinares", icon: ShieldAlert },
  ];

  const adminDocsNav: NavItem[] = [
    { to: "/admin/documentos/contracheque", label: "Contracheques", icon: FileText, end: true },
    { to: "/admin/documentos/ponto", label: "Folhas de Ponto", icon: FileText },
    { to: "/admin/documentos/atestados", label: "Atestados", icon: FileWarning },
    { to: "/admin/documentos/disciplinar", label: "Registros Disciplinares", icon: ShieldAlert },
  ];

  const adminCadastroNav: NavItem[] = [
    { to: "/admin/colaboradores", label: "Colaboradores", icon: Users },
    { to: "/admin/cargos", label: "Cargos", icon: Briefcase },
    { to: "/admin/unidades", label: "Unidades", icon: Building2 },
  ];

  const adminComunicacaoNav: NavItem[] = [
    { to: "/admin/mensagens", label: "Mensagens", icon: MessageSquare },
    { to: "/admin/avisos", label: "Quadro de Avisos", icon: Bell },
  ];

  const folgaNav = isAdmin ? adminFolgaNav : employeeFolgaNav;
  const docsNav = isAdmin ? adminDocsNav : employeeDocsNav;

  const getLinkClass = (isActive: boolean, isHome = false) =>
    cn(
      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
      isActive
        ? isHome
          ? "bg-red-600 text-white font-bold hover:bg-red-700"
          : "bg-primary/15 text-primary font-medium"
        : "text-muted-foreground hover:text-foreground hover:bg-accent"
    );

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
          <NavLink
            to={homePath}
            className={({ isActive }) => getLinkClass(isActive, true)}
          >
            <Home className="size-4" />
            <span>Início</span>
          </NavLink>

          {isAdmin ? (
            <div className="space-y-1">
              <button
                onClick={() => toggleMenu("cadastro")}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-colors",
                  cadastroOpen || path.includes("/admin/colaboradores") || path.includes("/admin/cargos") || path.includes("/admin/unidades")
                    ? "text-primary bg-primary/5"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <Users className="size-4" />
                  <span>Cadastro</span>
                </div>
                {cadastroOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              </button>

              {cadastroOpen && (
                <div className="pl-4 space-y-1 mt-1 border-l border-border ml-5">
                  {adminCadastroNav.map((item) => (
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
              )}
            </div>
          ) : (
            <NavLink
              to="/perfil"
              className={({ isActive }) => getLinkClass(isActive)}
            >
              <Settings className="size-4" />
              <span>Meu Cadastro</span>
            </NavLink>
          )}

          <div className="space-y-1">
            <button
              onClick={() => toggleMenu("folgas")}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-colors",
                folgasOpen || path.includes("/calendario") || path.includes("/trocas") || path.includes("/historico") || (path.startsWith("/admin") && !path.includes("/documentos") && !path.includes("/colaboradores") && !path.includes("/mensagens") && !path.includes("/avisos") && !path.includes("/home"))
                  ? "text-primary bg-primary/5"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
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
                {folgaNav.map((item) => (
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
            )}
          </div>

          <div className="space-y-1">
            <button
              onClick={() => toggleMenu("docs")}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-colors",
                docsOpen || path.includes("/documentos")
                  ? "text-primary bg-primary/5"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
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
                {docsNav.map((item) => (
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
            )}
          </div>

          {isAdmin && (
            <div className="space-y-1">
              <button
                onClick={() => toggleMenu("comunicacao")}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-colors",
                  comunicacaoOpen || path.includes("/admin/mensagens") || path.includes("/admin/avisos")
                    ? "text-primary bg-primary/5"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <MessageSquare className="size-4" />
                  <span>Comunicação</span>
                </div>
                {comunicacaoOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              </button>

              {comunicacaoOpen && (
                <div className="pl-4 space-y-1 mt-1 border-l border-border ml-5">
                  {adminComunicacaoNav.map((item) => (
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
              )}
            </div>
          )}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-border bg-card/80 backdrop-blur">
          <div className="px-3 py-2 mb-2">
            <div className="text-sm font-medium truncate">
              {profile?.nome ?? "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              {isAdmin ? "Administrador" : profile?.cargo ?? "Funcionário"}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={signOut}
          >
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
        <AvisosPopout />
      </main>
    </div>
  );
}