import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Users,
  Calendar,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle,
  FileWarning,
  ShieldAlert,
  Building2,
  Briefcase,
  UserCheck,
  ArrowLeftRight,
  Ban,
} from "lucide-react";
import { formatBR } from "@/lib/folga-rules";

interface AtestadoPendente {
  id: string;
  colaborador_id: string;
  colaborador_nome: string;
  data_atestado: string;
  dias_afastamento: number;
  created_at: string;
}

export default function HomeAdmin() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalColaboradores: 0,
    totalUnidades: 0,
    totalCargos: 0,
    folgasMes: 0,
    solicitacoesPendentes: 0,
    trocasPendentes: 0,
    diasBloqueados: 0,
  });
  const [atestadosPendentes, setAtestadosPendentes] = useState<AtestadoPendente[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [
        { count: colaboradores },
        { count: unidades },
        { count: cargos },
        { count: folgas },
        { count: solicitacoes },
        { count: trocas },
        { count: bloqueados },
        { data: atestadosData },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("unidades").select("*", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("cargos").select("*", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("folgas").select("*", { count: "exact", head: true }).gte("data", new Date().toISOString().split("T")[0]),
        supabase.from("solicitacoes_especiais").select("*", { count: "exact", head: true }).eq("status", "pendente"),
        supabase.from("trocas_folga").select("*", { count: "exact", head: true }).eq("status", "pendente"),
        supabase.from("datas_bloqueadas").select("*", { count: "exact", head: true }).eq("liberada", false),
        // 🔥 Buscar atestados pendentes com informações do colaborador
        supabase
          .from("atestados")
          .select(`
            id,
            colaborador_id,
            data_atestado,
            dias_afastamento,
            created_at,
            profiles!colaborador_id (nome)
          `)
          .eq("status", "pendente")
          .order("created_at", { ascending: false }),
      ]);

      setStats({
        totalColaboradores: colaboradores || 0,
        totalUnidades: unidades || 0,
        totalCargos: cargos || 0,
        folgasMes: folgas || 0,
        solicitacoesPendentes: solicitacoes || 0,
        trocasPendentes: trocas || 0,
        diasBloqueados: bloqueados || 0,
      });

      // Processar atestados pendentes
      const pendentes = (atestadosData || []).map((item: any) => ({
        id: item.id,
        colaborador_id: item.colaborador_id,
        colaborador_nome: item.profiles?.nome || "Colaborador não encontrado",
        data_atestado: item.data_atestado,
        dias_afastamento: item.dias_afastamento,
        created_at: item.created_at,
      }));
      setAtestadosPendentes(pendentes);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados do painel");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Recarregar a cada 30 segundos (opcional)
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const hasPendentes = atestadosPendentes.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <ShieldAlert className="size-6 text-primary" /> Painel Administrativo
        </h1>
        <p className="text-muted-foreground mt-1">Visão geral da equipe e pendências.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Colaboradores Ativos"
          value={stats.totalColaboradores}
          color="text-blue-600"
          bgColor="bg-blue-100"
        />
        <StatCard
          icon={Building2}
          label="Unidades"
          value={stats.totalUnidades}
          color="text-green-600"
          bgColor="bg-green-100"
        />
        <StatCard
          icon={Briefcase}
          label="Cargos"
          value={stats.totalCargos}
          color="text-purple-600"
          bgColor="bg-purple-100"
        />
        <StatCard
          icon={FileText}
          label="Folgas no Mês"
          value={stats.folgasMes}
          color="text-amber-600"
          bgColor="bg-amber-100"
        />
        <StatCard
          icon={UserCheck}
          label="Solicitações Pendentes"
          value={stats.solicitacoesPendentes}
          color="text-orange-600"
          bgColor="bg-orange-100"
        />
        <StatCard
          icon={ArrowLeftRight}
          label="Trocas Pendentes"
          value={stats.trocasPendentes}
          color="text-violet-600"
          bgColor="bg-violet-100"
        />
        <StatCard
          icon={Ban}
          label="Dias Bloqueados"
          value={stats.diasBloqueados}
          color="text-red-600"
          bgColor="bg-red-100"
        />
        <StatCard
          icon={Clock}
          label="Atestados Pendentes"
          value={atestadosPendentes.length}
          color="text-rose-600"
          bgColor="bg-rose-100"
        />
      </div>

      {/* 🔥 CARD DE ATESTADOS PENDENTES - SÓ EXIBE SE TIVER PENDENTES */}
      {hasPendentes && (
        <Card className="border-rose-200 shadow-md bg-rose-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-rose-700">
              <FileWarning className="size-5" />
              Atestados Pendentes de Aprovação
              <Badge className="ml-2 bg-rose-600 text-white">{atestadosPendentes.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {atestadosPendentes.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-rose-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                      <FileWarning className="size-5" />
                    </div>
                    <div>
                      <div className="font-medium text-rose-900">{a.colaborador_nome}</div>
                      <div className="text-sm text-muted-foreground flex gap-3">
                        <span>📅 {formatBR(new Date(a.data_atestado + "T00:00:00"))}</span>
                        <span>⏳ {a.dias_afastamento} dia(s)</span>
                        <span className="text-rose-500 font-medium">Pendente</span>
                      </div>
                    </div>
                  </div>
                  <Link to="/admin/documentos/atestados">
                    <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white">
                      Aprovar / Rejeitar
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mensagem quando não há pendentes */}
      {!hasPendentes && (
        <Card className="border-green-200 shadow-sm bg-green-50/50">
          <CardContent className="py-6 text-center">
            <div className="flex items-center justify-center gap-3">
              <CheckCircle className="size-6 text-green-600" />
              <span className="text-green-700 font-medium">✅ Nenhum atestado pendente de aprovação</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Links rápidos para páginas admin */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <QuickLink
          to="/admin/colaboradores"
          icon={Users}
          label="Colaboradores"
          description="Gerencie a equipe"
        />
        <QuickLink
          to="/admin/folgas"
          icon={Calendar}
          label="Dashboard de Folgas"
          description="Visão geral das folgas"
        />
        <QuickLink
          to="/admin/documentos/atestados"
          icon={FileWarning}
          label="Atestados"
          description="Gerencie atestados"
        />
        <QuickLink
          to="/admin/documentos/contracheque"
          icon={FileText}
          label="Contracheques"
          description="Importe e gerencie"
        />
        <QuickLink
          to="/admin/documentos/ponto"
          icon={FileText}
          label="Folhas de Ponto"
          description="Importe e gerencie"
        />
        <QuickLink
          to="/admin/bloqueios"
          icon={Ban}
          label="Bloqueios"
          description="Configure bloqueios"
        />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bgColor,
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
  bgColor: string;
}) {
  return (
    <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
            <div className="text-3xl font-bold mt-1">{value}</div>
          </div>
          <div className={`${bgColor} ${color} size-12 rounded-xl flex items-center justify-center`}>
            <Icon className="size-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickLink({
  to,
  icon: Icon,
  label,
  description,
}: {
  to: string;
  icon: any;
  label: string;
  description: string;
}) {
  return (
    <Link to={to} className="block">
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm hover:shadow-lg hover:border-primary/50 transition-all duration-200">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Icon className="size-5" />
          </div>
          <div>
            <div className="font-semibold text-sm">{label}</div>
            <div className="text-xs text-muted-foreground">{description}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}