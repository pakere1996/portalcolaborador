"use client";

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { FolgaCalendar, type DayOccupant } from "@/components/FolgaCalendar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Calendar as CalIcon,
  AlertCircle,
  CalendarCheck,
  ArrowLeftRight,
  User,
} from "lucide-react";
import { dayType, formatBR, monthKey, parseYMD, ymd, getMonthDays } from "@/lib/folga-rules";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tables } from "@/integrations/supabase/types";

type Profile = Tables<'profiles'>;
type Folga = Tables<'folgas'> & { extra?: boolean };

export default function CalendarioPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month0, setMonth0] = useState(today.getMonth());

  const [folgas, setFolgas] = useState<Folga[]>([]);
  const [manualBlocked, setManualBlocked] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [limites, setLimites] = useState<any[]>([]);
  const [pendentes, setPendentes] = useState<any[]>([]);
  const [prios, setPrios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [selectedDay, setSelectedDay] = useState<{ iso: string; status: string } | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const start = `${year}-${String(month0 + 1).padStart(2, "0")}-01`;
    const endDate = new Date(year, month0 + 1, 0);
    const end = ymd(endDate);

    try {
      const [fRes, bRes, pRes, limRes, pendRes, prioRes] = await Promise.all([
        supabase.from("folgas").select("*").gte("data", start).lte("data", end),
        supabase.from("datas_bloqueadas").select("*").gte("data", start).lte("data", end),
        supabase.from("profiles").select("*").eq("ativo", true),
        supabase.from("dia_config").select("*").gte("data", start).lte("data", end),
        supabase.from("solicitacoes_especiais").select("*").eq("status", "pendente").gte("data", start).lte("data", end),
        supabase.from("prioridade_aniversario").select("*").eq("status", "ativa").gte("data", start).lte("data", end),
      ]);

      setFolgas(fRes.data ?? []);
      setManualBlocked(bRes.data ?? []);
      setProfiles(pRes.data ?? []);
      setLimites(limRes.data ?? []);
      setPendentes(pendRes.data ?? []);
      setPrios(prioRes.data ?? []);
    } catch (error) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("calendario-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "folgas" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "datas_bloqueadas" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "dia_config" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "solicitacoes_especiais" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [year, month0]);

  const manualMap = useMemo(() => {
    const m = new Map<string, { reason: string; liberada: boolean }>();
    for (const b of manualBlocked) m.set(b.data, { reason: b.motivo, liberada: b.liberada });
    return m;
  }, [manualBlocked]);

  const dayLimits = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of limites) m.set(l.data, l.limite_colaboradores);
    return m;
  }, [limites]);

  const birthdayByDate = useMemo(() => {
    const m = new Map<string, { userId: string; status: string }>();
    for (const p of prios) m.set(p.data, { userId: p.user_id, status: p.status });
    return m;
  }, [prios]);

  // Ocupantes – usados apenas para verificar se o dia está ocupado (para o usuário comum)
  const occupantsByDate = useMemo(() => {
    const m = new Map<string, DayOccupant[]>();
    const nm = new Map(profiles.map(p => [p.id, p.nome]));

    const days = getMonthDays(year, month0);
    for (const d of days) {
      const iso = ymd(d);
      const wd = d.getDay();
      const fixedOnes = profiles.filter(p => p.folga_fixa_semana === wd);
      fixedOnes.forEach(p => {
        const arr = m.get(iso) ?? [];
        arr.push({ userId: p.id, userName: p.nome, type: "fixed", origin: "Folga Semanal" });
        m.set(iso, arr);
      });
    }

    folgas.forEach(f => {
      const iso = f.data;
      const arr = m.get(iso) ?? [];
      arr.push({
        userId: f.user_id,
        userName: nm.get(f.user_id) || "Colaborador",
        type: 'monthly',
        origin: f.extra ? "Extra" : "Mensal",
      });
      m.set(iso, arr);
    });

    pendentes.forEach(p => {
      const iso = p.data;
      const arr = m.get(iso) ?? [];
      arr.push({
        userId: p.user_id,
        userName: nm.get(p.user_id) || "Colaborador",
        type: "pending",
        origin: "Solicitação Pendente",
        requestId: p.id,
      });
      m.set(iso, arr);
    });

    return m;
  }, [profiles, folgas, pendentes, year, month0]);

  const goPrev = () => { const d = new Date(year, month0 - 1, 1); setYear(d.getFullYear()); setMonth0(d.getMonth()); };
  const goNext = () => { const d = new Date(year, month0 + 1, 1); setYear(d.getFullYear()); setMonth0(d.getMonth()); };

  const handleSelectDay = (iso: string, info?: { status: string; reason?: string }) => {
    setSelectedDay({ iso, status: info?.status || "" });
  };

  const marcarFolga = async (iso: string) => {
    if (!user) return;
    const d = parseYMD(iso);
    const tipo = dayType(d);
    if (!tipo) return toast.error("Esta data não é fim de semana");
    const mes = monthKey(d);

    const existing = folgas.some(f =>
      f.user_id === user.id &&
      monthKey(parseYMD(f.data)) === mes &&
      (f.tipo === 'sabado' || f.tipo === 'domingo') &&
      f.extra !== true
    );
    if (existing) {
      toast.warning("Você já possui uma folga de fim de semana neste mês.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.from("folgas").insert({
        user_id: user.id,
        data: iso,
        mes: mes,
        tipo: tipo,
        extra: false,
      });
      if (error) throw error;
      toast.success("Folga marcada com sucesso!");
      setSelectedDay(null);
      load();
    } catch (e) {
      toast.error("Erro ao marcar folga", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const removerFolga = async (iso: string) => {
    if (!user) return;
    const folga = folgas.find(f => f.user_id === user.id && f.data === iso);
    if (!folga) return toast.error("Folga não encontrada");

    const d = parseYMD(iso);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (d < hoje) return toast.error("Não é possível remover uma folga que já passou");

    setBusy(true);
    try {
      const { error } = await supabase.from("folgas").delete().eq("id", folga.id);
      if (error) throw error;
      toast.success("Folga removida");
      setSelectedDay(null);
      load();
    } catch (e) {
      toast.error("Erro ao remover folga", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  // Solicitação de troca anônima – cria uma troca com destinatario_id = null
  const solicitarTrocaAnonima = async (iso: string) => {
    if (!user) return;

    // Verifica se já existe uma troca pendente para esta data (do usuário)
    const { data: existing, error: checkError } = await supabase
      .from('trocas_folga')
      .select('id')
      .eq('solicitante_id', user.id)
      .eq('data_destinatario', iso)
      .eq('status', 'pendente')
      .maybeSingle();

    if (checkError) {
      toast.error("Erro ao verificar trocas existentes");
      return;
    }

    if (existing) {
      toast.info("Você já possui uma solicitação de troca pendente para este dia.");
      return;
    }

    setBusy(true);
    try {
      const { error: insertError } = await supabase
        .from('trocas_folga')
        .insert({
          solicitante_id: user.id,
          destinatario_id: null, // troca anônima
          data_destinatario: iso,
          status: 'pendente',
          mensagem: 'Solicitação de troca via calendário',
        });

      if (insertError) throw insertError;

      toast.success("Solicitação de troca enviada! Aguarde a aprovação.");
      setSelectedDay(null);
      load();
    } catch (e) {
      toast.error("Erro ao solicitar troca", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const solicitacaoExtra = async (iso: string) => {
    if (!user) return;
    const hasFolgaNoDia = folgas.some(f => f.user_id === user.id && f.data === iso);
    if (hasFolgaNoDia) {
      toast.info("Você já tem uma folga neste dia. Use a opção de troca ou solicitação especial.");
      return;
    }
    navigate(`/solicitar?data=${iso}`);
  };

  const currentMonthKey = monthKey(new Date(year, month0, 1));

  // Informações do dia selecionado
  const dayInfo = useMemo(() => {
    if (!selectedDay) return null;
    const occupants = occupantsByDate.get(selectedDay.iso) || [];
    const isMine = occupants.some(occ => occ.userId === user?.id);
    const hasOthers = occupants.some(occ => occ.userId !== user?.id);
    return { occupants, isMine, hasOthers, isOccupied: occupants.length > 0 };
  }, [selectedDay, occupantsByDate, user?.id]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 flex items-center gap-4 tracking-tight">
            <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <CalIcon className="size-7 text-primary" />
            </div>
            Meu Calendário
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Escolha suas folgas de fim de semana.</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/trocas")} className="rounded-full">
          <CalendarCheck className="size-4 mr-2" /> Minhas Trocas
        </Button>
      </div>

      <FolgaCalendar
        year={year}
        month0={month0}
        occupantsByDate={occupantsByDate}
        manualBlocked={manualMap}
        dayLimits={dayLimits}
        birthdayByDate={birthdayByDate as any}
        myUserId={user?.id ?? null}
        allFolgas={folgas}
        allProfiles={profiles}
        pendingRequests={pendentes}
        isAdmin={false}
        onPrev={goPrev}
        onNext={goNext}
        onSelectDay={handleSelectDay}
        locked={null}
        currentMonthKey={currentMonthKey}
      />

      {/* Dialog de detalhes do dia */}
      <Dialog open={!!selectedDay} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-3">
              <CalIcon className="size-6 text-primary" />
              {selectedDay && formatBR(parseYMD(selectedDay.iso))}
            </DialogTitle>
          </DialogHeader>

          {selectedDay && dayInfo && (
            <div className="space-y-6 py-4">
              <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">Status</span>
                  <Badge variant="outline" className={cn(
                    "text-xs",
                    selectedDay.status === 'available' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                    selectedDay.status === 'mine' && "bg-amber-50 text-amber-700 border-amber-200",
                    selectedDay.status === 'fixed' && "bg-blue-50 text-blue-700 border-blue-200",
                    selectedDay.status === 'blocked' && "bg-rose-50 text-rose-700 border-rose-200",
                    selectedDay.status === 'taken' && "bg-rose-50 text-rose-700 border-rose-200",
                    selectedDay.status === 'past' && "bg-slate-100 text-slate-500 border-slate-200",
                  )}>
                    {selectedDay.status === 'available' && 'Disponível'}
                    {selectedDay.status === 'mine' && 'Sua folga'}
                    {selectedDay.status === 'fixed' && 'Folga semanal'}
                    {selectedDay.status === 'blocked' && 'Bloqueado'}
                    {selectedDay.status === 'taken' && 'Ocupado'}
                    {selectedDay.status === 'past' && 'Passado'}
                    {selectedDay.status === 'pending' && 'Pendente'}
                    {selectedDay.status === 'birthday' && 'Aniversariante'}
                    {selectedDay.status === 'swapped' && 'Troca'}
                  </Badge>
                </div>
              </div>

              {/* Informações de ocupação (sem nomes) e botão de troca */}
              {dayInfo.isOccupied && (
                <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                  <p className="text-sm text-slate-600">
                    {dayInfo.isMine
                      ? "Você está ocupando este dia."
                      : "Este dia está ocupado por outro colaborador."
                    }
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3">
                {selectedDay.status === 'available' && (
                  <Button onClick={() => marcarFolga(selectedDay.iso)} disabled={busy} className="w-full">
                    {busy ? "..." : "Marcar folga"}
                  </Button>
                )}
                {selectedDay.status === 'mine' && (
                  <Button variant="destructive" onClick={() => removerFolga(selectedDay.iso)} disabled={busy} className="w-full">
                    {busy ? "..." : "Remover folga"}
                  </Button>
                )}
                {selectedDay.status === 'fixed' && (
                  <div className="text-sm text-slate-500">Sua folga fixa semanal. Para trocar, use a opção abaixo.</div>
                )}
                {selectedDay.status === 'blocked' && (
                  <div className="text-sm text-slate-500">Esta data está bloqueada administrativamente.</div>
                )}
                {selectedDay.status === 'taken' && (
                  <div className="text-sm text-slate-500">Limite de colaboradores atingido.</div>
                )}
                {selectedDay.status === 'past' && (
                  <div className="text-sm text-slate-500">Data já passou.</div>
                )}
                {selectedDay.status === 'pending' && (
                  <div className="text-sm text-slate-500">Solicitação pendente de aprovação.</div>
                )}
                {selectedDay.status === 'birthday' && (
                  <div className="text-sm text-slate-500">Data reservada para aniversariante.</div>
                )}
                {selectedDay.status === 'swapped' && (
                  <div className="text-sm text-slate-500">Troca aprovada para esta data.</div>
                )}

                {/* Botão de solicitar troca anônima – aparece se o dia está ocupado por outro (ou se for fixed e não for o próprio) */}
                {!dayInfo.isMine && dayInfo.isOccupied && selectedDay.status !== 'blocked' && selectedDay.status !== 'past' && (
                  <Button
                    variant="outline"
                    className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
                    onClick={() => solicitarTrocaAnonima(selectedDay.iso)}
                    disabled={busy}
                  >
                    <ArrowLeftRight className="size-4 mr-2" /> Solicitar troca
                  </Button>
                )}

                {/* Botão de solicitar exceção (sempre disponível, exceto bloqueado/passado) */}
                {selectedDay.status !== 'blocked' && selectedDay.status !== 'past' && (
                  <Button variant="ghost" onClick={() => solicitacaoExtra(selectedDay.iso)} className="w-full">
                    <AlertCircle className="size-4 mr-2" /> Solicitar exceção
                  </Button>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-center">
            <Button variant="ghost" className="text-slate-400 font-black uppercase tracking-[0.2em] text-[11px] hover:text-slate-900" onClick={() => setSelectedDay(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}