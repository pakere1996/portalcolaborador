import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Users, Calendar, CalendarCheck, ClipboardList, ArrowLeftRight, Ban, Sparkles, Cake, AlertTriangle, ChevronRight } from "lucide-react";
import { formatBR, parseYMD } from "@/lib/folga-rules";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/admin-api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    funcionarios: 0,
    folgasMes: 0,
    pendentes: 0,
    bloqueadas: 0,
    trocasPendentes: 0,
    ocupacaoHoje: "0/1",
  });
  const [proximasFolgas, setProximasFolgas] = useState<{ data: string; ocupacao: number; limite: number; temAniversario?: boolean; status: string; percentual: number }[]>([]);
  const [aniversariantes, setAniversariantes] = useState<{ id: string; nome: string; data_nascimento: string; idade: number }[]>([]);
  const [busySorteio, setBusySorteio] = useState(false);
  const [alertas, setAlertas] = useState<{ tipo: string; mensagem: string; data?: string }[]>([]);

  const load = async () => {
    const now = new Date();
    const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const [
      funcs,
      folgasC,
      pend,
      blocC,
      trocasP,
      configRes,
      priosRes,
      folgasDataRes,
      profilesRes
    ] = await Promise.all([
      supabase.from("profiles").select("id, nome, data_nascimento, folga_fixa_semana, ativo").eq("ativo", true),
      supabase.from("folgas").select("*", { count: "exact", head: true }).gte("data", start).lte("data", end),
      supabase.from("solicitacoes_especiais").select("*", { count: "exact", head: true }).eq("status", "pendente"),
      supabase.from("datas_bloqueadas").select("*", { count: "exact", head: true }).eq("liberada", false),
      supabase.from("trocas_folga").select("*", { count: "exact", head: true }).eq("status", "pendente"),
      supabase.from("dia_config").select("data, limite_colaboradores").gte("data", start).lte("data", end),
      supabase.from("prioridade_aniversario").select("data").eq("status", "ativa").gte("data", start).lte("data", end),
      supabase.from("folgas").select("data").gte("data", start).lte("data", end),
      supabase.from("profiles").select("id, nome, data_nascimento, folga_fixa_semana").eq("ativo", true),
    ]);

    const profilesAtivos = profilesRes.data ?? [];
    const todayLimit = (configRes.data ?? []).find((c) => c.data === todayIso)?.limite_colaboradores ?? 1;
    const todayMonthly = (folgasDataRes.data ?? []).filter((f) => f.data === todayIso).length;
    const todayFixed = profilesAtivos.filter((p) => p.folga_fixa_semana === now.getDay()).length;

    setStats({
      funcionarios: (funcs.data ?? []).length,
      folgasMes: folgasC.count ?? 0,
      pendentes: pend.count ?? 0,
      bloqueadas: blocC.count ?? 0,
      trocasPendentes: trocasP.count ?? 0,
      ocupacaoHoje: `${todayMonthly + todayFixed}/${todayLimit}`,
    });

    const currentMonth = now.getMonth() + 1;
    const bdays = profilesAtivos
      .filter((p) => p.data_nascimento && new Date(p.data_nascimento + "T00:00:00").getMonth() + 1 === currentMonth)
      .map((p) => {
        const bdate = new Date(p.data_nascimento + "T00:00:00");
        return {
          id: p.id,
          nome: p.nome,
          data_nascimento: p.data_nascimento,
          idade: now.getFullYear() - bdate.getFullYear()
        };
      })
      .sort((a, b) => new Date(a.data_nascimento + "T00:00:00").getDate() - new Date(b.data_nascimento + "T00:00:00").getDate());

    setAniversariantes(bdays);

    const { data: folgasData } = folgasDataRes;
    const counts = new Map<string, number>();
    folgasData?.forEach((f) => counts.set(f.data, (counts.get(f.data) || 0) + 1));

    const limits = new Map<string, number>();
    configRes.data?.forEach((c) => limits.set(c.data, c.limite_colaboradores));

    const prioDates = new Set(priosRes.data?.map((p) => p.data));

    const proximos: any[] = [];
    let d = new Date();
    while (proximos.length < 5 && proximos.length < 30) {
      const iso = d.toISOString().split("T")[0];
      const w = d.getDay();
      if (w === 0 || w === 6) {
        const ocupacao = counts.get(iso) || 0;
        const limite = limits.get(iso) || 1;
        proximos.push({
          data: iso,
          ocupacao,
          limite,
          temAniversario: prioDates.has(iso),
          percentual: Math.round((ocupacao / limite) * 100),
          status: ocupacao >= limite ? "lotado" : ocupacao >= limite * 0.7 ? "quase_lotado" : "disponivel"
        });
      }
      d.setDate(d.getDate() + 1);
    }
    setProximasFolgas(proximos);

    const novosAlertas: any[] = [];

    proximos.filter((p) => p.status === "quase_lotado").forEach((p) => {
      novosAlertas.push({
        tipo: "quase_lotado",
        mensagem: `${formatBR(parseYMD(p.data))} está com ${p.ocupacao}/${p.limite} vagas ocupadas (${p.percentual}%)`,
        data: p.data
      });
    });

    proximos.filter((p) => p.status === "lotado").forEach((p) => {
      novosAlertas.push({
        tipo: "lotado",
        mensagem: `${formatBR(parseYMD(p.data))} atingiu o limite máximo (${p.ocupacao}/${p.limite})`,
        data: p.data
      });
    });

    proximos.filter((p) => p.temAniversario).forEach((p) => {
      novosAlertas.push({
        tipo: "aniversario",
        mensagem: `${formatBR(parseYMD(p.data))} tem aniversariante com prioridade`,
        data: p.data
      });
    });

    setAlertas(novosAlertas);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "folgas" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "solicitacoes_especiais" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "trocas_folga" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "datas_bloqueadas" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "dia_config" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "prioridade_aniversario" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const handleSorteio = async () => {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    const mes = next.getMonth() + 1;
    const ano = next.getFullYear();

    if (!confirm(`Deseja realizar o sorteio automático de folgas para ${mes}/${ano}?`)) return;

    setBusySorteio(true);
    try {
      await adminApi.runSorteio(ano, mes);
      toast.success("Sorteio realizado com sucesso!");
      load();
    } catch (e) {
      toast.error("Erro ao realizar sorteio", { description: (e as Error).message });
    } finally {
      setBusySorteio(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "lotado": return "bg-red-100 text-red-700 border-red-200";
      case "quase_lotado": return "bg-yellow-100 text-yellow-700 border-yellow-200";
      default: return "bg-green-100 text-green-700 border-green-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "lotado": return "Lotado";
      case "quase_lotado": return "Quase lotado";
      default: return "Disponível";
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Shield className="size-6 text-primary" /> Painel Administrativo
          </h1>
          <p className="text-muted-foreground mt-1">Visão geral das escalas e solicitações.</p>
        </div>
        <Button
          onClick={handleSorteio}
          disabled={busySorteio}
          className="rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg"
        >
          <Sparkles className="size-4 mr-2" />
          {busySorteio ? "Sorteando..." : "Realizar Sorteio Próximo Mês"}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={Users} label="Equipe Ativa" value={stats.funcionarios} accent="text-blue-600" iconBg="bg-blue-100" />
        <StatCard icon={CalendarCheck} label="Ocupação Hoje" value={stats.ocupacaoHoje} accent="text-violet-600" iconBg="bg-violet-100" />
        <StatCard icon={Calendar} label="Folgas no Mês" value={stats.folgasMes} accent="text-emerald-600" iconBg="bg-emerald-100" />
        <StatCard icon={ClipboardList} label="Pedidos Especiais" value={stats.pendentes} accent="text-orange-600" iconBg="bg-orange-100" />
        <StatCard icon={ArrowLeftRight} label="Trocas Pendentes" value={stats.trocasPendentes} accent="text-purple-600" iconBg="bg-purple-100" />
        <StatCard icon={Ban} label="Dias Bloqueados" value={stats.bloqueadas} accent="text-red-600" iconBg="bg-red-100" />
      </div>

      {alertas.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-5 text-amber-600" />
            <h3 className="font-semibold text-amber-900">Alertas de Ocupação</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {alertas.map((alerta, idx) => (
              <div key={idx} className={`
                p-3 rounded-xl text-sm border-l-4 ${
                  alerta.tipo === "lotado" ? "bg-red-50 border-red-400 text-red-800" :
                  alerta.tipo === "quase_lotado" ? "bg-yellow-50 border-yellow-400 text-yellow-800" :
                  "bg-blue-50 border-blue-400 text-blue-800"
                }
              `}>
                <div className="flex items-center gap-2">
                  {alerta.tipo === "lotado" && <span className="text-red-500">●</span>}
                  {alerta.tipo === "quase_lotado" && <span className="text-yellow-500">●</span>}
                  {alerta.tipo === "aniversario" && <Cake className="size-3.5 text-amber-500" />}
                  <span className="font-medium">{alerta.mensagem}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="size-4 text-primary" /> Ocupação dos Próximos Fins de Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {proximasFolgas.map((p) => (
                <div key={p.data} className="p-3 rounded-xl bg-muted/30 border border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{formatBR(parseYMD(p.data))}</span>
                      {p.temAniversario && (
                        <span title="Aniversariante com prioridade">
                          <Cake className="size-4 text-amber-500" />
                        </span>
                      )}
                    </div>
                    <Badge className={getStatusColor(p.status)}>{getStatusLabel(p.status)}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          p.status === "lotado" ? "bg-red-500" :
                          p.status === "quase_lotado" ? "bg-yellow-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, p.percentual)}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-slate-600 w-16 text-right">{p.ocupacao}/{p.limite}</span>
                    <span className="text-xs text-muted-foreground w-16 text-right">{p.percentual}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Cake className="size-4 text-primary" /> Aniversariantes de {new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date())}
            </CardTitle>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">{aniversariantes.length}</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {aniversariantes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Nenhum aniversariante este mês.</div>
              ) : (
                aniversariantes.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-xl bg-amber-50/30 border border-amber-100/50">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold">
                        {new Date(a.data_nascimento + "T00:00:00").getDate()}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{a.nome}</div>
                        <div className="text-xs text-muted-foreground">Completa {a.idade} anos</div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-amber-600 hover:bg-amber-100" onClick={() => window.location.href = "/admin/calendario"}>
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, accent, iconBg,
}: { icon: any; label: string; value: number | string; accent: string; iconBg: string }) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow border-border">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
            <div className="text-3xl font-bold mt-1">{value}</div>
          </div>
          <div className={`${iconBg} ${accent} size-12 rounded-xl flex items-center justify-center`}>
            <Icon className="size-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}