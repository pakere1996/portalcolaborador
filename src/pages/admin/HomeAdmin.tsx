import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Users,
  Shield,
  UserCheck,
  Calendar,
  ClipboardList,
  FileText,
  FileWarning,
  ArrowLeftRight,
  Ban,
  Building2,
  Briefcase,
  ShieldAlert,
  MessageSquare,
  Bell,
  AlertCircle,
} from "lucide-react";

const adminModules = [
  {
    title: "Gestão de Equipe",
    description: "Gerencie perfis, cargos e status de colaboradores.",
    icon: Users,
    to: "/admin/colaboradores",
    category: "Geral",
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
    title: "Mensagens",
    description: "Envie comunicados e mensagens para a equipe.",
    icon: MessageSquare,
    to: "/admin/mensagens",
    category: "Comunicação",
  },
  {
    title: "Quadro de Avisos",
    description: "Crie avisos que aparecem no login dos colaboradores.",
    icon: Bell,
    to: "/admin/avisos",
    category: "Comunicação",
  },
];

interface AtestadoPendente {
  id: string;
  colaborador_id: string;
  colaborador_nome: string;
  data_atestado: string;
  dias_afastamento: number;
  created_at: string;
}

export default function HomeAdmin() {
  const [atestadosPendentes, setAtestadosPendentes] = useState<AtestadoPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPendentes, setTotalPendentes] = useState(0);

  const loadAtestadosPendentes = async () => {
    setLoading(true);
    try {
      // Busca atestados pendentes com nome do colaborador
      const { data, error } = await supabase
        .from("atestados")
        .select(`
          id,
          colaborador_id,
          data_atestado,
          dias_afastamento,
          created_at,
          profiles!colaborador_id (nome, unidade_id)
        `)
        .eq("status", "pendente")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      const pendentes = (data || []).map((item: any) => ({
        id: item.id,
        colaborador_id: item.colaborador_id,
        colaborador_nome: item.profiles?.nome || "Colaborador",
        data_atestado: item.data_atestado,
        dias_afastamento: item.dias_afastamento,
        created_at: item.created_at,
      }));

      setAtestadosPendentes(pendentes);
      setTotalPendentes(pendentes.length);
    } catch (error) {
      console.error("Erro ao carregar atestados pendentes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAtestadosPendentes();

    // Inscreve para mudanças em tempo real
    const channel = supabase
      .channel("atestados-pendentes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "atestados",
          filter: "status=eq.pendente",
        },
        () => {
          loadAtestadosPendentes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
        <p className="text-muted-foreground mt-1">Visão geral e acesso rápido aos módulos de gestão.</p>
      </div>

      {/* 🔥 Card de Atestados Pendentes */}
      <Card className="border-amber-200 bg-amber-50/30 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-amber-800">
            <FileWarning className="size-5 text-amber-600" />
            Atestados Pendentes de Aprovação
            {totalPendentes > 0 && (
              <Badge className="bg-amber-600 text-white hover:bg-amber-700 ml-2">
                {totalPendentes}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-amber-600 mr-2"></div>
              Carregando...
            </div>
          ) : atestadosPendentes.length === 0 ? (
            <div className="text-center py-6 text-green-600 flex items-center justify-center gap-2">
              <span className="text-2xl">✅</span>
              Nenhum atestado pendente de aprovação.
            </div>
          ) : (
            <div className="space-y-3">
              {atestadosPendentes.map((atestado) => (
                <div
                  key={atestado.id}
                  className="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-200 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                      <FileWarning className="size-5" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">
                        {atestado.colaborador_nome}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-3">
                        <span>
                          {new Date(atestado.data_atestado + "T00:00:00").toLocaleDateString("pt-BR")}
                        </span>
                        <span>•</span>
                        <span>{atestado.dias_afastamento} dia(s)</span>
                        <span>•</span>
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          Pendente
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Link to={`/admin/documentos/atestados`}>
                    <Button variant="outline" size="sm" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                      Aprovar
                    </Button>
                  </Link>
                </div>
              ))}
              {totalPendentes > 5 && (
                <div className="text-center">
                  <Link to="/admin/documentos/atestados">
                    <Button variant="ghost" size="sm" className="text-amber-600">
                      Ver todos os {totalPendentes} pendentes →
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {Object.entries(groupedModules).map(([category, modules]) => (
        <div key={category} className="space-y-4">
          <h2 className="text-xl font-semibold border-b border-yellow-500 pb-1 text-red-600">
            {category}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((module) => (
              <Link key={module.to} to={module.to} className="block h-full">
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-lg hover:border-primary/50 border-2 transition-all duration-200 h-full">
                  <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="text-lg font-semibold text-primary">{module.title}</div>
                    <module.icon className="size-6 text-yellow-500" />
                  </div>
                  <p className="text-sm text-muted-foreground">{module.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}