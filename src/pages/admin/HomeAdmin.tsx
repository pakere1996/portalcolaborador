import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Users,
  Shield,
  UserCheck,
  ClipboardList,
  FileText,
  FileWarning,
  ArrowLeftRight,
  Ban,
  Building2,
  Briefcase,
  ShieldAlert,
  Calendar,
  Bell,
  Loader2,
  X,
} from "lucide-react";
import { useAtestadosPendentes } from "@/lib/atestados-pendentes-context";

const adminModules = [
  {
    title: "Colaboradores",
    description: "Gerencie perfis, cargos e status de colaboradores.",
    icon: Users,
    to: "/admin/colaboradores",
    category: "Cadastro",
  },
  {
    title: "Cargos",
    description: "Gerencie os cargos da empresa.",
    icon: Briefcase,
    to: "/admin/cargos",
    category: "Cadastro",
  },
  {
    title: "Unidades",
    description: "Gerencie as unidades da loja.",
    icon: Building2,
    to: "/admin/unidades",
    category: "Cadastro",
  },
  {
    title: "Dashboard Folgas",
    description: "Visão geral e estatísticas do sistema de folgas.",
    icon: Shield,
    to: "/admin/folgas",
    category: "Folgas",
  },
  {
    title: "Calendário Geral",
    description: "Visão consolidada de todas as folgas da equipe.",
    icon: Calendar,
    to: "/admin/calendario",
    category: "Folgas",
  },
  {
    title: "Solicitações Especiais",
    description: "Gerencie pedidos de folgas fora das regras normais.",
    icon: ClipboardList,
    to: "/admin/solicitacoes",
    category: "Folgas",
  },
  {
    title: "Aprovações",
    description: "Aprove ou rejeite folgas pendentes e prioridades de aniversário.",
    icon: UserCheck,
    to: "/admin/aprovacoes",
    category: "Folgas",
  },
  {
    title: "Trocas de Folga",
    description: "Monitore e gerencie as solicitações de troca entre colaboradores.",
    icon: ArrowLeftRight,
    to: "/admin/trocas",
    category: "Folgas",
  },
  {
    title: "Datas Bloqueadas",
    description: "Configure e gerencie dias de bloqueio de folgas.",
    icon: Ban,
    to: "/admin/bloqueios",
    category: "Folgas",
  },
  {
    title: "Contracheques",
    description: "Faça upload e gerencie contracheques.",
    icon: FileText,
    to: "/admin/documentos/contracheque",
    category: "Documentos",
  },
  {
    title: "Folhas de Ponto",
    description: "Faça upload e gerencie folhas de ponto.",
    icon: FileText,
    to: "/admin/documentos/ponto",
    category: "Documentos",
  },
  {
    title: "Atestados",
    description: "Gerencie e aprove atestados médicos.",
    icon: FileWarning,
    to: "/admin/documentos/atestados",
    category: "Documentos",
  },
  {
    title: "Registros Disciplinares",
    description: "Cadastre advertências e suspensões.",
    icon: ShieldAlert,
    to: "/admin/documentos/disciplinar",
    category: "Documentos",
  },
  {
    title: "Comunicados",
    description: "Envie mensagens para colaboradores.",
    icon: MessageSquare,
    to: "/admin/mensagens",
    category: "Comunicação",
  },
  {
    title: "Quadro de Avisos",
    description: "Crie avisos para os colaboradores.",
    icon: Bell,
    to: "/admin/avisos",
    category: "Comunicação",
  },
];

export default function AdminHomeAdminPage() {
  const { pendentes, totalPendentes, loading, showNotification, setShowNotification } = useAtestadosPendentes();

  // 🔥 Toast de notificação quando há pendências
  useEffect(() => {
    if (totalPendentes > 0 && !showNotification) {
      toast.info(`📋 ${totalPendentes} atestado(s) pendente(s) de aprovação`, {
        duration: 6000,
        action: {
          label: "Ver agora",
          onClick: () => {
            window.location.href = "/admin/documentos/atestados";
          },
        },
      });
    }
  }, [totalPendentes, showNotification]);

  const groupedModules = adminModules.reduce((acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  }, {} as Record<string, typeof adminModules>);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Shield className="size-6 text-primary" /> Painel Administrativo
        </h1>
        <p className="text-muted-foreground mt-1">Acesso rápido aos módulos de gestão.</p>
      </div>

      {/* 🔥 Card de Pendências – agora com título fixo e estados claros */}
      {loading ? (
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="size-5 text-muted-foreground" />
              Pendências
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ) : totalPendentes > 0 ? (
        <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <Bell className="size-5" />
              Pendências
              <Badge className="ml-2 bg-amber-600 text-white">{totalPendentes}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendentes.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div>
                    <div className="font-medium">{p.colaborador_nome}</div>
                    <div className="text-sm text-muted-foreground">
                      Atestado de {new Date(p.data_atestado + "T00:00:00").toLocaleDateString("pt-BR")}
                      {" • "}
                      {p.dias_afastamento} dia(s)
                    </div>
                  </div>
                  <Link to="/admin/documentos/atestados">
                    <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
                      Revisar
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="size-5 text-muted-foreground" />
              Pendências
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-muted-foreground py-6">
              Nenhuma pendência no momento.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Módulos administrativos */}
      {Object.entries(groupedModules).map(([category, modules]) => (
        <div key={category} className="space-y-4">
          <h2 className="text-xl font-semibold border-b pb-1 text-primary">{category}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {modules.map((module) => (
              <Link key={module.to} to={module.to} className="block h-full">
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-lg hover:border-primary/50 transition-all duration-200 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-semibold text-primary">{module.title}</h3>
                    <module.icon className="size-6 text-yellow-500 shrink-0" />
                  </div>
                  <p className="text-sm text-muted-foreground flex-1">{module.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {/* 🔥 AlertDialog – notificação em tela */}
      <AlertDialog open={showNotification} onOpenChange={setShowNotification}>
        <AlertDialogContent className="max-w-md rounded-2xl">
          <AlertDialogHeader>
            <div className="flex items-center justify-between">
              <AlertDialogTitle className="flex items-center gap-2 text-amber-800">
                <Bell className="size-5 text-amber-600" />
                Atenção: Atestados Pendentes
              </AlertDialogTitle>
              <Button variant="ghost" size="icon" onClick={() => setShowNotification(false)}>
                <X className="size-4" />
              </Button>
            </div>
          </AlertDialogHeader>

          <AlertDialogDescription asChild>
            <div className="text-base text-muted-foreground">
              Existem <strong>{totalPendentes}</strong> atestado(s) aguardando sua aprovação.
              <br />
              <br />
              {pendentes.map((p) => (
                <div key={p.id} className="flex items-center gap-2 mt-1 text-sm">
                  <span className="font-medium">{p.colaborador_nome}</span>
                  <span className="text-muted-foreground">
                    • {new Date(p.data_atestado + "T00:00:00").toLocaleDateString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          </AlertDialogDescription>

          <AlertDialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowNotification(false)}>
              Fechar
            </Button>
            <Link to="/admin/documentos/atestados">
              <Button onClick={() => setShowNotification(false)}>
                Ir para Atestados
              </Button>
            </Link>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}