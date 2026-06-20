import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AppShell } from "./components/AppShell";
import { useAuth } from "./lib/auth-context";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Perfil from "./pages/Perfil";
import Calendario from "./pages/Calendario";
import CalendarioAdmin from "./pages/admin/Calendario";
import Trocas from "./pages/Trocas";
import Historico from "./pages/Historico";
import Documentos from "./pages/Documentos";
import DocumentosAtestados from "./pages/DocumentosAtestados";

// Admin Pages
import HomeAdmin from "./pages/admin/HomeAdmin";
import Colaboradores from "./pages/admin/Colaboradores";
import Cargos from "./pages/admin/Cargos";
import Unidades from "./pages/admin/Unidades";
import FolgasDashboard from "./pages/admin/Dashboard";
import Solicitacoes from "./pages/admin/Solicitacoes";
import Aprovacoes from "./pages/admin/Aprovacoes";
import TrocasAdmin from "./pages/admin/Trocas";
import Bloqueios from "./pages/admin/Bloqueios";
import DocumentosHub from "./pages/admin/Documentos";
import DocumentosContracheque from "./pages/admin/DocumentosContracheque";
import DocumentosPontoAdmin from "./pages/admin/DocumentosPontoAdmin";
import AtestadosAdmin from "./pages/admin/AtestadosAdmin";
import RegistrosDisciplinaresAdmin from "./pages/admin/RegistrosDisciplinaresAdmin";
import SetupAdmin from "./pages/SetupAdmin";
// 🔥 NOVA IMPORTAÇÃO PARA MENSAGENS
import MensagensAdmin from "./pages/admin/Mensagens";

// 🔥 Função para verificar se o usuário é admin (usando localStorage como fallback)
const isUserAdmin = (role?: string | null): boolean => {
  if (role === "admin") return true;
  const storedRole = localStorage.getItem('user_role');
  return storedRole === "admin";
};

function AuthenticatedRoutes() {
  const { session, role, loading } = useAuth();
  const isAuthenticated = !!session;

  // 🔥 Determina se é admin (prioriza role do contexto, fallback para localStorage)
  const isAdmin = isUserAdmin(role);

  console.log('🔍 AuthenticatedRoutes - role:', role, 'isAdmin:', isAdmin, 'loading:', loading);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell>
      <Routes>
        {/* Shared Routes */}
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/calendario" element={<Calendario />} />
        <Route path="/admin/calendario" element={<CalendarioAdmin />} />
        <Route path="/trocas" element={<Trocas />} />
        <Route path="/historico" element={<Historico />} />
        <Route path="/documentos" element={<Documentos />} />
        <Route path="/documentos/atestados" element={<DocumentosAtestados />} />
        <Route path="/documentos/ponto" element={<Documentos />} />

        {/* 🔥 Rotas de Home com redirecionamento baseado em isAdmin */}
        <Route path="/home" element={isAdmin ? <Navigate to="/admin/home" replace /> : <Home />} />
        <Route path="/" element={<Navigate to={isAdmin ? "/admin/home" : "/home"} replace />} />

        {/* Admin Routes */}
        {isAdmin ? (
          <>
            <Route path="/admin" element={<Navigate to="/admin/home" replace />} />
            <Route path="/admin/home" element={<HomeAdmin />} />
            
            {/* Cadastro Group */}
            <Route path="/admin/colaboradores" element={<Colaboradores />} />
            <Route path="/admin/cargos" element={<Cargos />} />
            <Route path="/admin/unidades" element={<Unidades />} />

            {/* Folgas Group */}
            <Route path="/admin/folgas" element={<FolgasDashboard />} />
            <Route path="/admin/solicitacoes" element={<Solicitacoes />} />
            <Route path="/admin/aprovacoes" element={<Aprovacoes />} />
            <Route path="/admin/trocas" element={<TrocasAdmin />} />
            <Route path="/admin/bloqueios" element={<Bloqueios />} />

            {/* Documentos Group */}
            <Route path="/admin/documentos" element={<DocumentosHub />} />
            <Route path="/admin/documentos/contracheque" element={<DocumentosContracheque />} />
            <Route path="/admin/documentos/ponto" element={<DocumentosPontoAdmin />} />
            <Route path="/admin/documentos/atestados" element={<AtestadosAdmin />} />
            <Route path="/admin/documentos/disciplinar" element={<RegistrosDisciplinaresAdmin />} />
            
            {/* 🔥 NOVA ROTA PARA MENSAGENS/COMUNICADOS */}
            <Route path="/admin/mensagens" element={<MensagensAdmin />} />
            
            {/* Setup */}
            <Route path="/admin/setup" element={<SetupAdmin />} />
          </>
        ) : (
          <>
            {/* Se não for admin, redireciona qualquer rota admin para home */}
            <Route path="/admin/*" element={<Navigate to="/home" replace />} />
            <Route path="/admin" element={<Navigate to="/home" replace />} />
          </>
        )}

        {/* Fallback para usuários autenticados */}
        <Route path="*" element={<Navigate to={isAdmin ? "/admin/home" : "/home"} replace />} />
      </Routes>
    </AppShell>
  );
}

function App() {
  const { session, loading } = useAuth();
  const isAuthenticated = !!session;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <>
      <Toaster richColors position="top-right" />
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/setup" element={<SetupAdmin />} />
        <Route path="/*" element={<AuthenticatedRoutes />} />
      </Routes>
    </>
  );
}

export default App;