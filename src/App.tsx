import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AppShell } from "./components/AppShell";
import { useAuth } from "./lib/auth-context";
import { AtestadosPendentesProvider } from "./lib/atestados-pendentes-context";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Perfil from "./pages/Perfil";
import Calendario from "./pages/Calendario";
import CalendarioAdmin from "./pages/admin/Calendario";
import Trocas from "./pages/Trocas";
import Historico from "./pages/Historico";
import Documentos from "./pages/Documentos";
import DocumentosAtestados from "./pages/DocumentosAtestados";
import DocumentosDisciplinar from "./pages/DocumentosDisciplinar";

// Admin Pages
import HomeAdmin from "./pages/admin/HomeAdmin";
import Colaboradores from "./pages/admin/Colaboradores";
import Cargos from "./pages/admin/Cargos";
import Unidades from "./pages/admin/Unidades";

// Sindicatos – módulo com submenus
import SindicatosCadastro from "./pages/admin/SindicatosCadastro"; // renomeado
import SindicatosNegociacoes from "./pages/admin/SindicatosNegociacoes";
import SindicatosHub from "./pages/admin/SindicatosHub";

// Outras páginas admin
import FolgasDashboard from "./pages/admin/FolgasHub";
import Solicitacoes from "./pages/admin/Solicitacoes";
import Aprovacoes from "./pages/admin/Aprovacoes";
import TrocasAdmin from "./pages/admin/Trocas";
import Bloqueios from "./pages/admin/Bloqueios";
import DocumentosHub from "./pages/admin/Documentos";
import DocumentosContracheque from "./pages/admin/DocumentosContracheque";
import DocumentosPontoAdmin from "./pages/admin/DocumentosPontoAdmin";
import DocumentosAdiantamento from "./pages/admin/DocumentosAdiantamento";
import DocumentosHistoricoCompleto from "./pages/admin/DocumentosHistoricoCompleto";
import AtestadosAdmin from "./pages/admin/AtestadosAdmin";
import RegistrosDisciplinaresAdmin from "./pages/admin/RegistrosDisciplinaresAdmin";
import SetupAdmin from "./pages/SetupAdmin";
import MensagensAdmin from "./pages/admin/Mensagens";
import QuadroAvisosAdmin from "./pages/admin/QuadroAvisos";

// HUBS
import CadastroHub from "./pages/admin/CadastroHub";
import ComunicacaoHub from "./pages/admin/ComunicacaoHub";

const isUserAdmin = (role?: string | null): boolean => {
  if (role === "admin") return true;
  const storedRole = localStorage.getItem('user_role');
  return storedRole === "admin";
};

function AuthenticatedRoutes() {
  const { session, role, loading } = useAuth();
  const isAuthenticated = !!session;
  const isAdmin = isUserAdmin(role);

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
    <AtestadosPendentesProvider>
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
          <Route path="/documentos/disciplinar" element={<DocumentosDisciplinar />} />

          {/* Rotas de Home com redirecionamento */}
          <Route path="/home" element={isAdmin ? <Navigate to="/admin/home" replace /> : <Home />} />
          <Route path="/" element={<Navigate to={isAdmin ? "/admin/home" : "/home"} replace />} />

          {/* Admin Routes */}
          {isAdmin ? (
            <>
              <Route path="/admin" element={<Navigate to="/admin/home" replace />} />
              <Route path="/admin/home" element={<HomeAdmin />} />
              
              {/* HUBS */}
              <Route path="/admin/cadastro" element={<CadastroHub />} />
              <Route path="/admin/comunicacao" element={<ComunicacaoHub />} />

              {/* Cadastro Group (sub-páginas) */}
              <Route path="/admin/colaboradores" element={<Colaboradores />} />
              <Route path="/admin/cargos" element={<Cargos />} />
              <Route path="/admin/unidades" element={<Unidades />} />

              {/* Sindicatos – módulo próprio com submenus */}
              <Route path="/admin/sindicatos" element={<SindicatosHub />} />
              <Route path="/admin/sindicatos/cadastro" element={<SindicatosCadastro />} />
              <Route path="/admin/sindicatos/negociacoes" element={<SindicatosNegociacoes />} />

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
              <Route path="/admin/documentos/adiantamento" element={<DocumentosAdiantamento />} />
              <Route path="/admin/documentos/historico" element={<DocumentosHistoricoCompleto />} />
              <Route path="/admin/documentos/atestados" element={<AtestadosAdmin />} />
              <Route path="/admin/documentos/disciplinar" element={<RegistrosDisciplinaresAdmin />} />
              
              {/* Comunicação Group */}
              <Route path="/admin/mensagens" element={<MensagensAdmin />} />
              <Route path="/admin/avisos" element={<QuadroAvisosAdmin />} />
              
              {/* Setup */}
              <Route path="/admin/setup" element={<SetupAdmin />} />
            </>
          ) : (
            <>
              <Route path="/admin/*" element={<Navigate to="/home" replace />} />
              <Route path="/admin" element={<Navigate to="/home" replace />} />
            </>
          )}

          <Route path="*" element={<Navigate to={isAdmin ? "/admin/home" : "/home"} replace />} />
        </Routes>
      </AppShell>
    </AtestadosPendentesProvider>
  );
}

function App() {
  const { session, loading } = useAuth();

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
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/setup" element={<SetupAdmin />} />
        <Route path="/*" element={<AuthenticatedRoutes />} />
      </Routes>
    </>
  );
}

export default App;