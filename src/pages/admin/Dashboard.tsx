import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Users, Calendar, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [stats, setStats] = useState({
    funcionarios: 0,
    folgasMes: 0,
    pendentes: 0,
    bloqueadas: 0,
  });

  useEffect(() => {
    (async () => {
      const now = new Date();
      const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

      const [funcs, folgasC, pend, blocC] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("folgas").select("*", { count: "exact", head: true }).gte("data", start).lte("data", end),
        supabase.from("solicitacoes_especiais").select("*", { count: "exact", head: true }).eq("status", "pendente"),
        supabase.from("datas_bloqueadas").select("*", { count: "exact", head: true }).eq("liberada", false),
      ]);
      setStats({
        funcionarios: funcs.count ?? 0,
        folgasMes: folgasC.count ?? 0,
        pendentes: pend.count ?? 0,
        bloqueadas: blocC.count ?? 0,
      });
    })();
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Shield className="size-6 text-primary" /> Painel Administrativo
        </h1>
        <p className="text-muted-foreground mt-1">Visão geral das escalas e solicitações.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Funcionários ativos" value={stats.funcionarios} accent="text-primary" />
        <StatCard icon={Calendar} label="Folgas do mês" value={stats.folgasMes} accent="text-mine" />
        <StatCard icon={ClipboardList} label="Solicitações pendentes" value={stats.pendentes} accent="text-pending" />
        <StatCard icon={Shield} label="Datas bloqueadas" value={stats.bloqueadas} accent="text-unavailable" />
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-semibold mb-2">Como funciona</h2>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
          <li>Funcionários escolhem 1 sábado OU 1 domingo por mês.</li>
          <li>Folgas do mês seguinte são liberadas no dia 15 do mês atual.</li>
          <li>1º fim de semana após o dia 5 e datas comemorativas são bloqueados automaticamente.</li>
          <li>Funcionários podem solicitar exceção em datas bloqueadas — você aprova ou recusa.</li>
        </ul>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, accent,
}: { icon: typeof Shield; label: string; value: number; accent: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className={`size-9 rounded-lg bg-accent/40 flex items-center justify-center ${accent} mb-3`}>
        <Icon className="size-5" />
      </div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
