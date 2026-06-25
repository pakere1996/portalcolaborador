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
  Megaphone,
  Bell,
  Coins,
  ListChecks,
  Scale,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";
import { AvisosPopout } from "@/components/AvisosPopout";
import logo from "@/assets/pakere-logo.png";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();
  const path = location.pathname;
  const [open, setOpen] = useState(false);

  // Estados de expansão dos menus (admin)
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
      // Fecha todos
      Object.values(setters).forEach((setter) => setter(false));
      // Abre o selecionado se estava fechado
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

  // Fechar menu mobile ao navegar
  useEffect(() => {
    setOpen(false);
  }, [path]);

  // Abrir submenus automaticamente com base na rota atual
  useEffect(() => {
    const shouldOpen = {
      cadastro:
        path.startsWith("/admin/colaboradores") ||
        path.startsWith("/admin/cargos") ||
        path.startsWith("/admin/unidades") ||
        path.startsWith("/admin/cadastro") ||
        path === "/admin/cadastro",
      docs:
        path.startsWith("/admin/documentos") ||
        path === "/admin/documentos",
      comunicacao:
        path.startsWith("/admin/mensagens") ||
        path.startsWith("/admin/avisos") ||
        path === "/admin/comunicacao",
      folgas:
        path.startsWith("/admin/calendario") ||
        path.startsWith("/admin/solicitacoes") ||
        path.startsWith("/admin/aprovacoes") ||
        path.startsWith("/admin/trocas") ||
        path.startsWith("/admin/bloqueios") ||
        path === "/admin/folgas",
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

  // 🔹 ADICIONADO: item "Sindicato" no menu de documentos do colaborador
  const employeeDocsNav: NavItem[] = [
    { to: "/documentos", label: "Meus Documentos", icon: FileText, end: true },
    { to: "/documentos/atestados", label: "Atestados", icon: FileWarning },
    { to: "/documentos/disciplinar", label: "Registros Disciplinares", icon: ShieldAlert },
    { to: "/documentos/sindicato", label: "Sindicato", icon: Scale }, // <-- NOVO
  ];

  // ADMIN: submenu Cadastro
  const adminCadastroNav: NavItem[] = [
    { to: "/admin/colaboradores", label: "Colaboradores", icon: Users },
    { to: "/admin/cargos", label: "Cargos", icon: Briefcase },
    { to: "/admin/unidades", label: "Unidades", icon: Building2 },
    { to: "/admin/cadastro/sindicatos", label: "Sindicatos", icon: Scale },
  ];

  // ADMIN: submenu Documentos
  const adminDocsNav: NavItem[] = [
    { to: "/admin/documentos/contracheque", label: "Contracheques", icon: FileText, end: true },
    { to: "/admin/documentos/adiantamento", label: "Adiantamentos", icon: Coins },
    { to: "/admin/documentos/ponto", label: "Folhas de Ponto", icon: FileText },
    { to: "/admin/documentos/atestados", label: "Atestados", icon: FileWarning },
    { to: "/admin/documentos/disciplinar", label: "Registros Disciplinares", icon: ShieldAlert },
    { to: "/admin/documentos/act-cct", label: "ACT-CCT", icon: FileText },
    { to: "/admin/documentos/historico", label: "Histórico Completo", icon: ListChecks },
  ];

  // ADMIN: demais submenus
  const adminFolgaNav: NavItem[] = [
    { to: "/admin/calendario", label: "Calendário Geral", icon: Calendar },
    { to: "/admin/solicitacoes", label: "Solicitações", icon: ClipboardList },
    { to: "/admin/aprovacoes", label: "Aprovações", icon: UserCheck },
    { to: "/admin/trocas", label: "Trocas", icon: ArrowLeftRight },
    { to: "/admin/bloqueios", label: "Datas Bloqueadas", icon: Ban },
  ];

  const adminComunicacaoNav: NavItem[] = [
    { to: "/admin/mensagens", label: "Comunicados", icon: MessageSquare },
    { to: "/admin/avisos", label: "Quadro de Avisos", icon: Bell },
  ];

  const getLinkClass = (isActive: boolean, isHome = false) =>
    cn(
      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
      isActive
        ? isHome
          ? "bg-red-600 text-white font-bold hover:bg-red-700"
          : "bg-primary/15 text-primary font-medium"
        : "text-muted-foreground hover:text-foreground hover:bg-accent"
    );

  const renderAdminMenuItem = (
    label: string,
    Icon: LucideIcon,
    linkTo: string,
    isOpen: boolean,
    toggleFn: () => void,
    subItems: NavItem[]
  ) => {
    return (
      <div className="space-y-1">
        <div className="flex items-center">
          <NavLink
            to={linkTo}
            className={({ isActive }) =>
              cn(
                "flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )
            }
          >
            <Icon className="size-4" />
            <span>{label}</span>
          </NavLink>
          <button
            onClick={toggleFn}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
          >
            {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        </div>

        {isOpen && (
          <div className="pl-4 space-y-1 mt-1 border-l border-border ml-5">
            {subItems.map((item) => (
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
    );
  };

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
          {/* INÍCIO */}
          <NavLink
            to={homePath}
            className={({ isActive }) => getLinkClass(isActive, true)}
          >
            <Home className="size-4" />
            <span>Início</span>
          </NavLink>

          {isAdmin ? (
            <>
              {renderAdminMenuItem(
                "Cadastro",
                Users,
                "/admin/cadastro",
                cadastroOpen,
                () => toggleMenu("cadastro"),
                adminCadastroNav
              )}

              {renderAdminMenuItem(
                "Folgas",
                Calendar,
                "/admin/folgas",
                folgasOpen,
                () => toggleMenu("folgas"),
                adminFolgaNav
              )}

              {renderAdminMenuItem(
                "Documentos",
                FileText,
                "/admin/documentos",
                docsOpen,
                () => toggleMenu("docs"),
                adminDocsNav
              )}

              {renderAdminMenuItem(
                "Comunicação",
                Megaphone,
                "/admin/comunicacao",
                comunicacaoOpen,
                () => toggleMenu("comunicacao"),
                adminComunicacaoNav
              )}
            </>
          ) : (
            <>
              <NavLink
                to="/perfil"
                className={({ isActive }) => getLinkClass(isActive)}
              >
                <Settings className="size-4" />
                <span>Meu Cadastro</span>
              </NavLink>

              <div className="space-y-1">
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

              <div className="space-y-1">
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