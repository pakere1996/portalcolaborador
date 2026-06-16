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
import DocumentosAdmin from "./pages/admin/Documentos";
import DocumentosAtestadosAdmin from "./pages/admin/DocumentosAtestadosAdmin";
import DocumentosDisciplinar from "./pages/admin/DocumentosDisciplinar";
import SetupAdmin from "./pages/SetupAdmin";

function AuthenticatedRoutes() {
  const { session, role } = useAuth();
  const isAuthenticated = !!session;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = role === "admin";
  console.log("ROLE ATUAL:", role, "isAdmin:", isAdmin);

  // Todas as rotas autenticadas são renderizadas dentro do AppShell
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

        {/* Employee Home */}
        <Route path="/home" element={<Home />} />
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
            <Route path="/admin/documentos" element={<DocumentosAdmin />} />
            <Route path="/admin/documentos/ponto" element={<DocumentosAdmin />} />
            <Route path="/admin/documentos/atestados" element={<DocumentosAtestadosAdmin />} />
            <Route path="/admin/documentos/disciplinar" element={<DocumentosDisciplinar />} />
            
            {/* Setup */}
            <Route path="/admin/setup" element={<SetupAdmin />} />
          </>
        ) : (
          <Route path="/admin/*" element={<Navigate to="/home" replace />} />
        )}

        {/* Fallback for authenticated users */}
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