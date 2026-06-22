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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Calendar as CalIcon,
  AlertCircle,
  CalendarCheck,
  ArrowLeftRight,
  User,
  Send,
} from "lucide-react";
import {
  dayType,
  formatBR,
  monthKey,
  parseYMD,
  ymd,
  getMonthDays,
  getWeekStart,
} from "@/lib/folga-rules";
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
  const [excecaoDialogOpen, setExcecaoDialogOpen] = useState(false);
  const [excecaoData, setExcecaoData] = useState<string>("");
  const [excecaoMotivo, setExcecaoMotivo] = useState("");
  const [enviandoExcecao, setEnviandoExcecao] = useState(false);

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
      console.error(error);
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

  const occupantsByDate = useMemo(() => {
    const m = new Map<string, DayOccupant[]>();
    const myProfile = profiles.find(p => p.id === user?.id);
    const userUnidade = myProfile?.unidade_id;
    const filteredProfiles = userUnidade
      ? profiles.filter(p => p.unidade_id === userUnidade)
      : profiles;

    const nm = new Map(filteredProfiles.map(p => [p.id, p.nome]));

    const days = getMonthDays(year, month0);
    for (const d of days) {
      const iso = ymd(d);
      const wd = d.getDay();
      const fixedOnes = filteredProfiles.filter(p => p.folga_fixa_semana === wd);

      fixedOnes.forEach(p => {
        const arr = m.get(iso) ?? [];
        arr.push({ userId: p.id, userName: p.nome, type: "fixed", origin: "Folga Semanal" });
        m.set(iso, arr);
      });
    }

    folgas.forEach(f => {
      const profile = profiles.find(p => p.id === f.user_id);
      if (profile && (userUnidade ? profile.unidade_id === userUnidade : true)) {
        const iso = f.data;
        const arr = m.get(iso) ?? [];
        arr.push({
          userId: f.user_id,
          userName: nm.get(f.user_id) || "Colaborador",
          type: 'monthly',
          origin: f.extra ? "Extra" : "Mensal",
        });
        m.set(iso, arr);
      }
    });

    pendentes.forEach(p => {
      const profile = profiles.find(prof => prof.id === p.user_id);
      if (profile && (userUnidade ? profile.unidade_id === userUnidade : true)) {
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
      }
    });

    return m;
  }, [profiles, folgas, pendentes, year, month0, user?.id]);

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

  const solicitarTroca = async (iso: string, destinatarioId: string) => {
    if (!user) return;
    if (destinatarioId === user.id) {
      toast.error("Você não pode trocar com você mesmo");
      return;
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    const isAdmin = !!roleData;

    if (!isAdmin) {
      const myProfile = profiles.find(p => p.id === user.id);
      const destProfile = profiles.find(p => p.id === destinatarioId);
      if (!myProfile || !destProfile) {
        toast.error("Perfil não encontrado");
        return;
      }
      if (myProfile.unidade_id !== destProfile.unidade_id) {
        toast.error("Você só pode trocar com colaboradores da sua unidade.");
        return;
      }
    }

    const { data: existing, error: checkError } = await supabase
      .from('trocas_folga')
      .select('id')
      .eq('solicitante_id', user.id)
      .eq('destinatario_id', destinatarioId)
      .eq('data_destinatario', iso)
      .eq('status', 'pendente')
      .maybeSingle();

    if (checkError) {
      toast.error("Erro ao verificar trocas existentes");
      return;
    }
    if (existing) {
      toast.info("Você já possui uma solicitação de troca pendente para este dia com este colaborador.");
      return;
    }

    setBusy(true);
    try {
      const { error: insertError } = await supabase
        .from('trocas_folga')
        .insert({
          solicitante_id: user.id,
          destinatario_id: destinatarioId,
          data_destinatario: iso,
          status: 'pendente',
          mensagem: 'Solicitação de troca via calendário',
        });

      if (insertError) throw insertError;

      toast.success("Solicitação de troca enviada para o colaborador!");
      setSelectedDay(null);
      load();
    } catch (e) {
      toast.error("Erro ao solicitar troca", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const abrirExcecao = (iso: string) => {
    setExcecaoData(iso);
    setExcecaoMotivo("");
    setExcecaoDialogOpen(true);
  };

  const enviarExcecao = async () => {
    if (!user) return;
    setEnviandoExcecao(true);
    try {
      const { error } = await supabase
        .from('solicitacoes_especiais')
        .insert({
          user_id: user.id,
          data: excecaoData,
          motivo: excecaoMotivo.trim() || "Solicitação de exceção (sem motivo informado)",
          status: 'pendente',
        });

      if (error) throw error;

      toast.success("Solicitação de exceção enviada para o administrador!");
      setExcecaoDialogOpen(false);
      setSelectedDay(null);
      load();
    } catch (e) {
      toast.error("Erro ao enviar solicitação", { description: (e as Error).message });
    } finally {
      setEnviandoExcecao(false);
    }
  };

  const currentMonthKey = monthKey(new Date(year, month0, 1));

  const dayInfo = useMemo(() => {
    if (!selectedDay) return null;
    const iso = selectedDay.iso;
    const date = parseYMD(iso);
    const isWeekend = !!dayType(date);
    const occupants = occupantsByDate.get(iso) || [];
    const isMine = occupants.some(occ => occ.userId === user?.id);

    const myProfile = profiles.find(p => p.id === user?.id);
    const fixedDay = myProfile?.folga_fixa_semana ?? null;

    let fixedDateInWeek: Date | null = null;
    if (fixedDay !== null && fixedDay >= 1 && fixedDay <= 5) {
      const weekStart = getWeekStart(date);
      const fixedDate = new Date(weekStart);
      fixedDate.setDate(weekStart.getDate() + (fixedDay - 1));
      fixedDateInWeek = fixedDate;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const fixedFolgaFutura = fixedDateInWeek ? fixedDateInWeek >= hoje : false;

    const canTradeWeekday = !isWeekend &&
      fixedDay !== null &&
      fixedDateInWeek !== null &&
      fixedFolgaFutura;

    const hasMonthlyFolga = folgas.some(f =>
      f.user_id === user?.id &&
      monthKey(parseYMD(f.data)) === monthKey(date) &&
      (f.tipo === 'sabado' || f.tipo === 'domingo') &&
      f.extra !== true
    );
    const canTradeWeekend = isWeekend && !hasMonthlyFolga;

    const canTrade = canTradeWeekday || canTradeWeekend;

    return {
      occupants,
      isMine,
      isOccupied: occupants.length > 0,
      canTrade,
      isWeekend,
      date,
    };
  }, [selectedDay, occupantsByDate, user, profiles, folgas]);

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

      <Dialog open={!!selectedDay} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-3">
              <CalIcon className="size-6 text-primary" />
              {selectedDay && formatBR(parseYMD(selectedDay.iso))}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Detalhes do dia {selectedDay && formatBR(parseYMD(selectedDay.iso))}
            </DialogDescription>
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
                    selectedDay.status === 'pending' && "bg-violet-50 text-violet-700 border-violet-200",
                    selectedDay.status === 'birthday' && "bg-amber-50 text-amber-700 border-amber-200",
                    selectedDay.status === 'swapped' && "bg-amber-50 text-amber-700 border-amber-200",
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

              {dayInfo.isOccupied && !dayInfo.isMine && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-600">Colaboradores neste dia:</h4>
                  {dayInfo.occupants.map((occ, idx) => {
                    const isMe = occ.userId === user?.id;
                    const showTrade = !isMe &&
                      dayInfo.canTrade &&
                      selectedDay.status !== 'blocked' &&
                      selectedDay.status !== 'past' &&
                      selectedDay.status !== 'mine' &&
                      selectedDay.status !== 'fixed';

                    return (
                      <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                        <div className="flex items-center gap-3">
                          <User className="size-4 text-slate-400" />
                          <span className="font-medium">{occ.userName || "Colaborador"}</span>
                          {isMe && <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700">Você</Badge>}
                        </div>
                        {showTrade && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                            onClick={() => solicitarTroca(selectedDay.iso, occ.userId)}
                            disabled={busy}
                          >
                            <ArrowLeftRight className="size-3 mr-1" /> Trocar
                          </Button>
                        )}
                      </div>
                    );
                  })}
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
                  <div className="text-sm text-slate-500">
                    Sua folga fixa semanal. 
                    {dayInfo.canTrade 
                      ? " Para trocar, selecione o dia desejado e use o botão 'Trocar' ao lado do colaborador." 
                      : " A data para troca já passou ou você não possui folga fixa nesta semana."}
                  </div>
                )}
                {selectedDay.status === 'blocked' && (
                  <div className="text-sm text-slate-500">Esta data está bloqueada administrativamente.</div>
                )}
                {selectedDay.status === 'taken' && (
                  <div className="text-sm text-slate-500">
                    {dayInfo.isWeekend 
                      ? "Limite de colaboradores atingido." 
                      : "Este dia está ocupado por outro colaborador."}
                  </div>
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

                {selectedDay.status !== 'past' &&
                 selectedDay.status !== 'mine' &&
                 selectedDay.status !== 'fixed' &&
                 selectedDay.status !== 'pending' &&
                 selectedDay.status !== 'swapped' && (
                  <Button
                    variant="outline"
                    className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
                    onClick={() => abrirExcecao(selectedDay.iso)}
                    disabled={busy}
                  >
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

      <Dialog open={excecaoDialogOpen} onOpenChange={(o) => !o && setExcecaoDialogOpen(false)}>
        <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-3">
              <AlertCircle className="size-6 text-amber-500" />
              Solicitar exceção
            </DialogTitle>
            <DialogDescription className="sr-only">
              Preencha a justificativa para solicitar uma exceção.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-semibold text-slate-700">Data</Label>
              <div className="mt-1 text-lg font-bold text-slate-900">
                {excecaoData && formatBR(parseYMD(excecaoData))}
              </div>
            </div>
            <div>
              <Label htmlFor="motivo" className="text-sm font-semibold text-slate-700">
                Justificativa <span className="text-slate-400 text-xs font-normal">(opcional)</span>
              </Label>
              <Textarea
                id="motivo"
                placeholder="Descreva o motivo da solicitação (ex: compromisso pessoal, urgência, etc.)"
                value={excecaoMotivo}
                onChange={(e) => setExcecaoMotivo(e.target.value)}
                rows={4}
                className="mt-1 resize-none rounded-xl border-slate-200 focus:border-primary focus:ring-primary"
              />
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="ghost" onClick={() => setExcecaoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={enviarExcecao} disabled={enviandoExcecao}>
              {enviandoExcecao ? "Enviando..." : <><Send className="size-4 mr-2" /> Enviar solicitação</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}