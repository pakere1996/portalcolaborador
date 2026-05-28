import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Users, Calendar, ClipboardList, ArrowLeftRight, Ban, Sparkles, Cake } from "lucide-react";
import { formatBR, parseYMD } from "@/lib/folga-rules";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/admin-api";
import { toast } from "sonner";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    funcionarios: 0,
    folgasMes: 0,
    pendentes: 0,
    bloqueadas: 0,
    trocasPendentes: 0,
  });
  const [proximasFolgas, setProximasFolgas] = useState<{ data: string; ocupacao: number; limite: number; temAniversario?: boolean }[]>([]);
  const [busySorteio, setBusySorteio] = useState(false);

  const load = async () => {
    const now = new Date();
    const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

    const [funcs, folgasC, pend, blocC, trocasP, config, prios] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("ativo", true),
      supabase.from("folgas").select("*", { count: "exact", head: true }).gte("data", start).lte("data", end),
      supabase.from("solicitacoes_especiais").select("*", { count: "exact", head: true }).eq("status", "pendente"),
      supabase.from("datas_bloqueadas").select("*", { count: "exact", head: true }).eq("liberada", false),
      supabase.from("trocas_folga").select("*", { count: "exact", head: true }).eq("status", "pendente"),
      supabase.from("dia_config").select("data, limite_colaboradores").gte("data", start).lte("data", end),
      supabase.from("prioridade_aniversario").select("data").eq("status", "ativa").gte("data", start).lte("data", end),
    ]);

    setStats({
      funcionarios: funcs.count ?? 0,
      folgasMes: folgasC.count ?? 0,
      pendentes: pend.count ?? 0,
      bloqueadas: blocC.count ?? 0,
      trocasPendentes: trocasP.count ?? 0,
    });

    const { data: folgasData } = await supabase.from("folgas").select("data").gte("data", start).lte("data", end);
    const counts = new Map<string, number>();
    folgasData?.forEach(f => counts.set(f.data, (counts.get(f.data) || 0) + 1));
    
    const limits = new Map<string, number>();
    config?.forEach(c => limits.set(c.data, c.limite_colaboradores));

    const prioDates = new Set(prios?.map(p => p.data));

    const proximos: any[] = [];
    let d = new Date();
    while (proximos.length < 5 && proximos.length < 30) {
      const iso = d.toISOString().split('T')[0];
      const w = d.getDay();
      if (w === 0 || w === 6) {
        proximos.push({
          data: iso,
          ocupacao: counts.get(iso) || 0,
          limite: limits.get(iso) || 1,
          temAniversario: prioDates.has(iso)
        });
      }
      d.setDate(d.getDate() + 1);
    }
    setProximasFolgas(proximos);
  };

  useEffect(() => { load(); }, []);

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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon={Users} label="Equipe Ativa" value={stats.funcionarios} accent="text-blue-600" />
        <StatCard icon={Calendar} label="Folgas no Mês" value={stats.folgasMes} accent="text-emerald-600" />
        <StatCard icon={ClipboardList} label="Pedidos Especiais" value={stats.pendentes} accent="text-orange-600" />
        <StatCard icon={ArrowLeftRight} label="Trocas Pendentes" value={stats.trocasPendentes} accent="text-purple-600" />
        <StatCard icon={Ban} label="Dias Bloqueados" value={stats.bloqueadas} accent="text-red-600" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Calendar className="size-4 text-primary" /> Ocupação dos Próximos Fins de Semana
          </h2>
          <div className="space-y-3">
            {proximasFolgas.map((p) => (
              <div key={p.data} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{formatBR(parseYMD(p.data))}</span>
                  {p.temAniversario && <Cake className="size-3 text-pending" title="Aniversariante com prioridade" />}
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${p.ocupacao >= p.limite ? 'bg-red-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, (p.ocupacao / p.limite) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono">{p.ocupacao}/{p.limite}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Resumo de Regras</h2>
          <ul className="text-sm text-muted-foreground space-y-3">
            <li className="flex gap-2">
              <div className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <span>As folgas do mês seguinte são liberadas automaticamente todo <b>dia 15</b>.</span>
            </li>
            <li className="flex gap-2">
              <div className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <span>O sistema bloqueia o 1º fim de semana após o dia 5 (pagamento).</span>
            </li>
            <li className="flex gap-2">
              <div className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <span>Aniversariantes têm prioridade automática se a data cair no fim de semana.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, accent,
}: { icon: any; label: string; value: number; accent: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className={`size-9 rounded-lg bg-muted/50 flex items-center justify-center ${accent} mb-3`}>
        <Icon className="size-5" />
      </div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}