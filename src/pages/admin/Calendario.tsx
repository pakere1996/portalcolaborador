"use client";

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { FolgaCalendar, type DayOccupant } from "@/components/FolgaCalendar";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Calendar as CalIcon,
  Filter,
  User,
  Trash2,
  Plus,
  Settings2,
  Save,
  Lock,
  Info,
  Unlock,
  AlertTriangle,
  ChevronRight,
  Building,
  Loader2,
  CheckCircle,
  Users,
  ChevronLeft,
} from "lucide-react";
import {
  dayType,
  formatBR,
  monthKey,
  parseYMD,
  ymd,
  autoBlockedDatesForMonth,
  calculateDateStatus,
  getMonthDays,
  isSameWeek,
  getWeekNumber,
} from "@/lib/folga-rules";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tables } from "@/integrations/supabase/types";

type Unidade = Tables<'unidades'>;
type Profile = Tables<'profiles'> & { unidade_id?: string | null };

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);
  return matches;
};

export default function AdminCalendar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month0, setMonth0] = useState(today.getMonth());

  const [folgas, setFolgas] = useState<any[]>([]);
  const [manual, setManual] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [limites, setLimites] = useState<any[]>([]);
  const [pendentes, setPendentes] = useState<any[]>([]);
  const [prios, setPrios] = useState<any[]>([]);

  const [filterUnidade, setFilterUnidade] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const [dlg, setDlg] = useState<{ iso: string; status: string } | null>(null);
  const [assignUser, setAssignUser] = useState<string>("");
  const [editLimit, setEditLimit] = useState<number>(1);
  const [savingLimit, setSavingLimit] = useState(false);
  const [busyAssign, setBusyAssign] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    colaboradorId: string;
    data: string;
    tipo: string;
    mes: string;
    conflitos: { id: string; data: string; tipo: string }[];
  } | null>(null);

  const isMobile = useMediaQuery('(max-width: 768px)');

  const load = async () => {
    const start = `${year}-${String(month0 + 1).padStart(2, "0")}-01`;
    const endDate = new Date(year, month0 + 1, 0);
    const end = ymd(endDate);

    const [fRes, bRes, pRes, limRes, pendRes, uRes, prioRes] = await Promise.all([
      supabase.from("folgas").select("*").gte("data", start).lte("data", end),
      supabase.from("datas_bloqueadas").select("*").gte("data", start).lte("data", end),
      supabase.from("profiles").select("*").eq("ativo", true).order("nome"),
      supabase.from("dia_config").select("*").gte("data", start).lte("data", end),
      supabase.from("solicitacoes_especiais").select("*").eq("status", "pendente").gte("data", start).lte("data", end),
      supabase.from("unidades").select("*").order("nome"),
      supabase.from("prioridade_aniversario").select("*").eq("status", "ativa").gte("data", start).lte("data", end),
    ]);

    setProfiles(pRes.data ?? []);
    setFolgas(fRes.data ?? []);
    setManual(bRes.data ?? []);
    setLimites(limRes.data ?? []);
    setPendentes(pendRes.data ?? []);
    setUnidades(uRes.data ?? []);
    setPrios(prioRes.data ?? []);
  };

  useEffect(() => { load(); }, [year, month0]);

  useEffect(() => {
    const ch = supabase
      .channel("admin-calendar-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "dia_config" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "folgas" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "datas_bloqueadas" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filteredProfiles = useMemo(() => {
    if (filterUnidade === "all") return profiles;
    return profiles.filter(p => p.unidade_id === filterUnidade);
  }, [profiles, filterUnidade]);

  const manualMap = useMemo(() => {
    const m = new Map<string, { reason: string; liberada: boolean }>();
    for (const b of manual) m.set(b.data, { reason: b.motivo, liberada: b.liberada });
    return m;
  }, [manual]);

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
    const nm = new Map(filteredProfiles.map(p => [p.id, p.nome]));
    const validUserIds = new Set(filteredProfiles.map(p => p.id));

    const days = getMonthDays(year, month0);
    for (const d of days) {
      const iso = ymd(d);
      const wd = d.getDay();
      const fixedOnes = filteredProfiles.filter(p => p.folga_fixa_semana === wd);
      fixedOnes.forEach(p => {
        if (filterUser !== "all" && p.id !== filterUser) return;
        if (filterType !== "all" && filterType !== "fixed") return;
        const arr = m.get(iso) ?? [];
        arr.push({ userId: p.id, userName: p.nome, type: "fixed", origin: "Folga Semanal" });
        m.set(iso, arr);
      });
    }

    folgas.forEach(f => {
      if (!validUserIds.has(f.user_id)) return;
      if (filterUser !== "all" && f.user_id !== filterUser) return;
      if (filterType !== "all" && filterType !== "monthly") return;
      const iso = f.data;
      const arr = m.get(iso) ?? [];
      const origin = f.extra ? "Extra (Admin)" : (f.criado_por ? "Atribuição Manual" : "Sorteio Automático");
      arr.push({
        userId: f.user_id,
        userName: nm.get(f.user_id) || "Desconhecido",
        type: "monthly",
        origin,
      });
      m.set(iso, arr);
    });

    pendentes.forEach(p => {
      if (!validUserIds.has(p.user_id)) return;
      if (filterUser !== "all" && p.user_id !== filterUser) return;
      if (filterType !== "all" && filterType !== "pending") return;
      const iso = p.data;
      const arr = m.get(iso) ?? [];
      arr.push({
        userId: p.user_id,
        userName: nm.get(p.user_id) || "Desconhecido",
        type: "pending",
        origin: "Solicitação Pendente",
        requestId: p.id,
      });
      m.set(iso, arr);
    });

    return m;
  }, [filteredProfiles, folgas, pendentes, year, month0, filterUser, filterType]);

  const stats = useMemo(() => {
    const days = getMonthDays(year, month0);
    let totalFolgas = 0;
    let totalVagas = 0;
    let diasLotados = 0;

    days.forEach(d => {
      const iso = ymd(d);
      const status = calculateDateStatus({
        date: d,
        myUserId: null,
        allFolgas: folgas,
        allProfiles: filteredProfiles,
        manualBlocked: manualMap,
        dayLimits,
        birthdayByDate: birthdayByDate as any,
        isAdmin: true,
      });
      if (dayType(d)) {
        totalFolgas += status.occupancy || 0;
        totalVagas += status.limit || 1;
        if ((status.occupancy || 0) >= (status.limit || 1)) diasLotados++;
      }
    });

    return { totalFolgas, totalVagas, diasLotados, vagasRestantes: totalVagas - totalFolgas };
  }, [year, month0, folgas, filteredProfiles, manualMap, dayLimits, birthdayByDate]);

  const onSelect = (iso: string) => {
    setDlg({ iso, status: "" });
    setAssignUser("");
    setEditLimit(dayLimits.get(iso) ?? 1);
  };

  const handleAssignFolga = async (
    iso: string,
    modo: 'force' | 'extra' | 'substituir',
    conflitoIds?: string[]
  ) => {
    if (!assignUser) return toast.error("Escolha um funcionário");
    const d = parseYMD(iso);
    const tipo = dayType(d) || "outro";
    const mes = monthKey(d);

    setBusyAssign(true);
    try {
      if (modo === 'substituir' && conflitoIds && conflitoIds.length > 0) {
        const { error: delError } = await supabase
          .from('folgas')
          .delete()
          .in('id', conflitoIds);
        if (delError) throw delError;
      }

      const extra = modo === 'extra';
      const { error: insertError } = await supabase
        .from('folgas')
        .insert({
          user_id: assignUser,
          data: iso,
          mes: mes,
          tipo: tipo,
          criado_por: user?.id,
          extra: extra,
        });

      if (insertError) throw insertError;

      toast.success(modo === 'extra' ? "Folga extra atribuída!" : "Folga atribuída com sucesso!");
      setDlg(null);
      setConfirmDialog(null);
      load();
    } catch (e) {
      toast.error("Erro ao atribuir folga", { description: (e as Error).message });
    } finally {
      setBusyAssign(false);
    }
  };

  const prepararAtribuicao = async (iso: string) => {
    if (!assignUser) return toast.error("Escolha um funcionário");

    const d = parseYMD(iso);
    const mes = monthKey(d);
    const isWknd = !!dayType(d);

    const { data: existingFolgas, error } = await supabase
      .from('folgas')
      .select('id, data, tipo')
      .eq('user_id', assignUser);

    if (error) {
      toast.error("Erro ao verificar conflitos");
      return;
    }

    const conflitos = (existingFolgas || []).filter(f => {
      const fData = parseYMD(f.data);
      if (f.data === iso) return true;
      if (isWknd && monthKey(fData) === mes) return true;
      if (!isWknd && isSameWeek(d, fData)) return true;
      return false;
    });

    if (conflitos.length === 0) {
      await handleAssignFolga(iso, 'force');
      return;
    }

    setConfirmDialog({
      open: true,
      colaboradorId: assignUser,
      data: iso,
      tipo: dayType(d) || "outro",
      mes: mes,
      conflitos: conflitos.map(f => ({ id: f.id, data: f.data, tipo: f.tipo || 'fixa' })),
    });
  };

  const saveDayLimit = async () => {
    if (!dlg) return;
    setSavingLimit(true);
    const { error } = await supabase.from("dia_config").upsert({
      data: dlg.iso,
      limite_colaboradores: editLimit,
      updated_at: new Date().toISOString(),
    }, { onConflict: "data" });

    setSavingLimit(false);
    if (error) return toast.error(error.message);
    toast.success("Limite atualizado");
    load();
  };

  const removeFolga = async (iso: string, userId: string) => {
    const f = folgas.find((x) => x.data === iso && x.user_id === userId);
    if (!f) return;
    const { error } = await supabase.from("folgas").delete().eq("id", f.id);
    if (error) return toast.error(error.message);
    toast.success("Folga removida");
    setDlg(null);
    load();
  };

  const unlockDay = async (iso: string) => {
    const block = manual.find(m => m.data === iso);
    if (!block) {
      const { error } = await supabase.from("datas_bloqueadas").upsert({
        data: iso,
        motivo: "Liberado manualmente",
        liberada: true,
        auto: false,
      }, { onConflict: 'data' });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("datas_bloqueadas").update({ liberada: true }).eq("id", block.id);
      if (error) return toast.error(error.message);
    }
    toast.success("Data liberada com sucesso");
    setDlg(null);
    load();
  };

  const goPrev = () => { const d = new Date(year, month0 - 1, 1); setYear(d.getFullYear()); setMonth0(d.getMonth()); };
  const goNext = () => { const d = new Date(year, month0 + 1, 1); setYear(d.getFullYear()); setMonth0(d.getMonth()); };

  const isWeekend = dlg ? !!dayType(parseYMD(dlg.iso)) : false;

  const currentBlock = useMemo(() => {
    if (!dlg) return null;
    const m = manual.find(x => x.data === dlg.iso && !x.liberada);
    if (m) return { motivo: m.motivo, auto: m.auto, created_at: m.created_at, id: m.id };
    const auto = autoBlockedDatesForMonth(year, month0).find(b => b.date === dlg.iso);
    if (auto) return { motivo: auto.reason, auto: true, created_at: null, id: null };
    return null;
  }, [dlg, manual, year, month0]);

  const renderMobileCalendar = () => {
    const days = getMonthDays(year, month0);
    const monthName = new Date(year, month0).toLocaleString('pt-BR', { month: 'long' });
    const yearStr = year;

    return (
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={goPrev}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="font-bold text-sm capitalize">
              {monthName} {yearStr}
            </span>
            <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={goNext}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {days.filter(d => dayType(d)).length} dias úteis
          </span>
        </div>

        <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
          {days.map((d) => {
            const iso = ymd(d);
            const occupants = occupantsByDate.get(iso) || [];
            const isWeekendDay = !!dayType(d);
            const limit = dayLimits.get(iso) || 1;
            const isBlocked = manualMap.get(iso)?.liberada === false || autoBlockedDatesForMonth(year, month0).some(b => b.date === iso);

            return (
              <div
                key={iso}
                className="px-4 py-3 hover:bg-slate-50/50 transition-colors cursor-pointer"
                onClick={() => onSelect(iso)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn(
                        "text-sm font-bold",
                        isWeekendDay ? "text-slate-900" : "text-slate-400"
                      )}>
                        {d.getDate()}
                      </span>
                      {isBlocked && (
                        <Badge variant="outline" className="text-[9px] bg-rose-50 text-rose-600 border-rose-200 px-1.5 py-0 h-5">
                          Bloqueado
                        </Badge>
                      )}
                      {occupants.length > 0 && (
                        <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20 px-1.5 py-0 h-5">
                          {occupants.length}/{limit}
                        </Badge>
                      )}
                      {isWeekendDay && !isBlocked && occupants.length === 0 && (
                        <span className="text-[9px] text-slate-400">Vago</span>
                      )}
                    </div>
                    {occupants.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {occupants.map((occ, idx) => {
                          const primeiroNome = (occ.userName || "Colaborador").split(' ')[0];
                          return (
                            <span
                              key={idx}
                              className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded font-medium truncate max-w-[120px]",
                                occ.type === 'fixed' ? "bg-blue-50 text-blue-600" :
                                occ.type === 'monthly' ? "bg-amber-50 text-amber-600" :
                                "bg-orange-50 text-orange-600"
                              )}
                              title={occ.userName || "Colaborador"}
                            >
                              {primeiroNome}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400">Nenhum colaborador</span>
                    )}
                  </div>
                  <ChevronRight className="size-4 text-slate-300 shrink-0 mt-0.5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 flex items-center gap-4 tracking-tight">
            <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <CalIcon className="size-7 text-primary" />
            </div>
            Calendário Geral
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Gestão centralizada de escalas e folgas da equipe.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Folgas Marcadas</div>
          <div className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <CheckCircle className="size-5 text-emerald-500" /> {stats.totalFolgas}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Vagas Restantes</div>
          <div className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Users className="size-5 text-blue-500" /> {stats.vagasRestantes}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Dias Lotados</div>
          <div className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <AlertTriangle className="size-5 text-rose-500" /> {stats.diasLotados}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Capacidade Total</div>
          <div className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <CalIcon className="size-5 text-slate-400" /> {stats.totalVagas}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-wrap gap-8 items-end shadow-sm">
        <div className="space-y-2.5">
          <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 flex items-center gap-2">
            <Building className="size-3.5" /> Unidade
          </Label>
          <Select value={filterUnidade} onValueChange={(value) => { setFilterUnidade(value); setFilterUser("all"); }}>
            <SelectTrigger className="w-[260px] bg-slate-50/50 border-slate-200 rounded-2xl h-12 font-semibold">
              <SelectValue placeholder="Todas as Unidades" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all">Todas as Unidades</SelectItem>
              {unidades.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2.5">
          <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 flex items-center gap-2">
            <User className="size-3.5" /> Colaborador
          </Label>
          <Select value={filterUser} onValueChange={setFilterUser} disabled={filteredProfiles.length === 0 && filterUnidade !== 'all'}>
            <SelectTrigger className="w-[260px] bg-slate-50/50 border-slate-200 rounded-2xl h-12 font-semibold">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all">Todos os colaboradores</SelectItem>
              {filteredProfiles.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2.5">
          <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 flex items-center gap-2">
            <Filter className="size-3.5" /> Tipo de Folga
          </Label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[220px] bg-slate-50/50 border-slate-200 rounded-2xl h-12 font-semibold">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="fixed">Semanal</SelectItem>
              <SelectItem value="monthly">Mensal (FDS)</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-900 font-bold uppercase tracking-widest text-[10px] h-12 px-6" onClick={() => { setFilterUser("all"); setFilterType("all"); setFilterUnidade("all"); }}>
          Limpar Filtros
        </Button>
      </div>

      {isMobile ? renderMobileCalendar() : (
        <FolgaCalendar
          year={year} month0={month0}
          occupantsByDate={occupantsByDate} manualBlocked={manualMap}
          dayLimits={dayLimits}
          birthdayByDate={birthdayByDate as any}
          myUserId={user?.id ?? null}
          allFolgas={folgas}
          allProfiles={filteredProfiles}
          pendingRequests={pendentes}
          isAdmin={true}
          onPrev={goPrev} onNext={goNext}
          onSelectDay={onSelect}
        />
      )}

      <Dialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="max-w-lg rounded-[2.5rem] border-none shadow-2xl p-8">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black text-slate-900 flex items-center gap-4 tracking-tight">
              <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <CalIcon className="size-6 text-primary" />
              </div>
              {dlg && formatBR(parseYMD(dlg.iso))}
            </DialogTitle>
          </DialogHeader>

          {dlg && (
            <div className="space-y-8 py-6">
              {currentBlock && (
                <div className="bg-rose-50/80 p-6 rounded-[2rem] border border-rose-100 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-rose-400 flex items-center gap-2">
                      <Lock className="size-3.5" /> Data Bloqueada
                    </h3>
                    <Badge variant="outline" className="bg-rose-100 text-rose-600 border-rose-200 text-[9px] uppercase font-black">
                      {currentBlock.auto ? "Automático" : "Manual"}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="text-lg font-black text-rose-900 leading-tight flex items-start gap-2">
                      <AlertTriangle className="size-5 text-rose-500 shrink-0 mt-0.5" />
                      {currentBlock.motivo}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full h-12 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-100 hover:text-rose-700 font-bold"
                    onClick={() => unlockDay(dlg.iso)}
                  >
                    <Unlock className="size-4 mr-2" /> Liberar Data
                  </Button>
                </div>
              )}

              {isWeekend && (
                <div className="bg-slate-50/80 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                      <Settings2 className="size-3.5" /> Configuração do Dia
                    </h3>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <Label className="text-[10px] font-bold text-slate-500 mb-1.5 block">Limite de Colaboradores</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={editLimit}
                        onChange={(e) => setEditLimit(Number(e.target.value))}
                        className="bg-white border-slate-200 rounded-xl h-12 font-bold"
                      />
                    </div>
                    <Button
                      onClick={saveDayLimit}
                      disabled={savingLimit}
                      className="h-12 px-6 rounded-xl mt-auto"
                    >
                      <Save className="size-4 mr-2" /> {savingLimit ? "..." : "Salvar"}
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-5">
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Escala do Dia</h3>
                <div className="grid gap-4">
                  {occupantsByDate.get(dlg.iso)?.map((occ, idx) => (
                    <div key={idx} className="group p-5 rounded-3xl border bg-slate-50/50 border-slate-100 hover:bg-white hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-between">
                      <div className="flex items-center gap-5">
                        <div className={cn(
                          "size-3 rounded-full shadow-sm",
                          occ.type === 'fixed' ? "bg-blue-400" :
                          occ.type === 'monthly' ? "bg-amber-400" :
                          "bg-orange-400"
                        )} />
                        <div>
                          <div className="font-black text-slate-900 text-lg tracking-tight">{occ.userName || "Colaborador"}</div>
                          <div className="text-[11px] font-bold uppercase tracking-widest mt-0.5 text-slate-400">{occ.origin}</div>
                        </div>
                      </div>
                      {occ.type === 'monthly' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-10 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-all"
                          onClick={() => removeFolga(dlg.iso, occ.userId)}
                        >
                          <Trash2 className="size-5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {!occupantsByDate.get(dlg.iso)?.length && (
                    <div className="text-sm font-medium text-slate-400 text-center py-12 bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
                      Ninguém escalado para este dia.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-5 pt-6 border-t border-slate-100">
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Atribuir Folga Manual</h3>
                <div className="flex gap-4">
                  <Select value={assignUser} onValueChange={setAssignUser}>
                    <SelectTrigger className="flex-1 bg-slate-50/50 border-slate-200 rounded-2xl h-14 font-semibold">
                      <SelectValue placeholder="Escolher colaborador..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {filteredProfiles.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button
                    className="h-14 px-8 rounded-2xl shadow-xl shadow-primary/20 font-black uppercase tracking-widest text-xs"
                    onClick={() => prepararAtribuicao(dlg.iso)}
                    disabled={busyAssign}
                  >
                    {busyAssign ? <Loader2 className="size-5 animate-spin" /> : <><Plus className="size-5 mr-2" /> Atribuir</>}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-center pt-4">
            <Button variant="ghost" className="text-slate-400 font-black uppercase tracking-[0.2em] text-[11px] hover:text-slate-900" onClick={() => setDlg(null)}>Fechar Detalhes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="size-6" /> Conflito de Folga
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Este colaborador já possui folga(s) que conflitam com esta nova atribuição:
              <ul className="list-disc list-inside mt-2 text-sm text-slate-700">
                {confirmDialog?.conflitos?.map(f => (
                  <li key={f.id}>{formatBR(parseYMD(f.data))} - {f.tipo || 'Fixa'}</li>
                ))}
              </ul>
              <br />
              <span className="font-semibold">Como deseja proceder?</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
              onClick={() => {
                if (confirmDialog) {
                  const ids = confirmDialog.conflitos.map(f => f.id);
                  handleAssignFolga(confirmDialog.data, 'substituir', ids);
                }
              }}
            >
              Substituir (remove as antigas)
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl"
              onClick={() => {
                if (confirmDialog) {
                  handleAssignFolga(confirmDialog.data, 'extra');
                }
              }}
            >
              Manter como Extra
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}