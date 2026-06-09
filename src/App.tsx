import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";

import LoginPage from "@/pages/Login";
import SetupAdminPage from "@/pages/SetupAdmin";
import CalendarioPage from "@/pages/Calendario";
import HistoricoPage from "@/pages/Historico";
import TrocasPage from "@/pages/Trocas";
import PerfilPage from "@/pages/Perfil";
import DocumentosPage from "@/pages/Documentos";
import DocumentosAtestadosPage from "@/pages/DocumentosAtestados";

import AdminDashboard from "@/pages/admin/Dashboard";
import AdminCalendario from "@/pages/admin/Calendario";
import AdminSolicitacoes from "@/pages/admin/Solicitacoes";
import AdminAprovacoes from "@/pages/admin/Aprovacoes";
import AdminTrocas from "@/pages/admin/Trocas";
import AdminBloqueios from "@/pages/admin/Bloqueios";
import AdminFuncionarios from "@/pages/admin/Funcionarios";
import AdminDocumentos from "@/pages/admin/Documentos";
import AdminDocumentosAtestados from "@/pages/admin/DocumentosAtestadosAdmin";
import AdminDocumentosDisciplinar from "@/pages/admin/DocumentosDisciplinar";

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { session, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="size-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-muted-foreground">Verificando permissões...</p>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (adminOnly && role !== "admin") {
    console.warn("[App] Acesso negado: Usuário não é administrador. Role atual:", role);
    return <Navigate to="/calendario" replace />;
  }

  return <AppShell>{children}</AppShell>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup-admin" element={<SetupAdminPage />} />

      <Route path="/calendario" element={<ProtectedRoute><CalendarioPage /></ProtectedRoute>} />
      <Route path="/historico" element={<ProtectedRoute><HistoricoPage /></ProtectedRoute>} />
      <Route path="/trocas" element={<ProtectedRoute><TrocasPage /></ProtectedRoute>} />
      <Route path="/perfil" element={<ProtectedRoute><PerfilPage /></ProtectedRoute>} />
      <Route path="/documentos" element={<ProtectedRoute><DocumentosPage /></ProtectedRoute>} />
      <Route path="/documentos/ponto" element={<ProtectedRoute><DocumentosPage /></ProtectedRoute>} />
      <Route path="/documentos/atestados" element={<ProtectedRoute><DocumentosAtestadosPage /></ProtectedRoute>} />

      <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/calendario" element={<ProtectedRoute adminOnly><AdminCalendario /></ProtectedRoute>} />
      <Route path="/admin/solicitacoes" element={<ProtectedRoute adminOnly><AdminSolicitacoes /></ProtectedRoute>} />
      <Route path="/admin/aprovacoes" element={<ProtectedRoute adminOnly><AdminAprovacoes /></ProtectedRoute>} />
      <Route path="/admin/trocas" element={<ProtectedRoute adminOnly><AdminTrocas /></ProtectedRoute>} />
      <Route path="/admin/bloqueios" element={<ProtectedRoute adminOnly><AdminBloqueios /></ProtectedRoute>} />
      <Route path="/admin/funcionarios" element={<ProtectedRoute adminOnly><AdminFuncionarios /></ProtectedRoute>} />
      <Route path="/admin/documentos" element={<ProtectedRoute adminOnly><AdminDocumentos /></ProtectedRoute>} />
      <Route path="/admin/documentos/ponto" element={<ProtectedRoute adminOnly><AdminDocumentos /></ProtectedRoute>} />
      <Route path="/admin/documentos/atestados" element={<ProtectedRoute adminOnly><AdminDocumentosAtestados /></ProtectedRoute>} />
      <Route path="/admin/documentos/disciplinar" element={<ProtectedRoute adminOnly><AdminDocumentosDisciplinar /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}