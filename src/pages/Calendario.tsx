"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { FolgaCalendar } from "@/components/FolgaCalendar";
import {
  autoBlockedDatesForMonth,
  dayType,
  formatBR,
  isMonthUnlocked,
  monthKey,
  parseYMD,
  unlockDateForMonth,
  ymd,
  calculateDateStatus,
} from "@/lib/folga-rules";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calendar as CalIcon, Clock, AlertCircle, ArrowLeftRight, ShieldAlert, Info, RefreshCw, Send, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Solic {
  id: string;
  data: string;
  motivo: string;
  status: string;
  created_at: string;
  user_id: string;
}

// Hook para detectar mobile
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

export default function CalendarioPage() {
  const { user, profile: rawProfile } = useAuth();
  const profile = rawProfile as (Exclude<typeof rawProfile, null> & { unidade_id?: string | null }) | null;

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month0, setMonth0] = useState(today.getMonth());
  
  const [folgas, setFolgas] = useState<any[]>([]);
  const [manual, setManual] = useState<any[]>([]);
  const [limites, setLimites] = useState<any[]>([]);
  const [prios, setPrios] = useState<any[]>([]);
  const [pendingSolics, setPendingSolics] = useState<Solic[]>([]);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [canceledFolgas, setCanceledFolgas] = useState<any[]>([]);
  
  const [smartSwap, setSmartSwap] = useState<{ iso: string } | null>(null);
  const [changeFolgaDialog, setChangeFolgaDialog] = useState<{ newIso: string; oldFolga: any } | null>(null);
  const [reqDialog, setReqDialog] = useState<{ iso: string; type: 'swap' | 'exception' } | null>(null);
  const [viewDialog, setViewDialog] = useState<Solic | null>(null);
  const [reqMotivo, setReqMotivo] = useState("");
  const [busy, setBusy] = useState(false);

  const isMobile = useMediaQuery('(max-width: 768px)');

  const load = async () => {
    if (!user || !profile?.unidade_id) return;
    
    const unidadeId = profile.unidade_id;
    const start = `${year}-${String(month0 + 1).padStart(2, "0")}-01`;
    const endDate = new Date(year, month0 + 1, 0);
    const end = ymd(endDate);

    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, nome, folga_fixa_semana, data_nascimento, unidade_id")
      .eq("ativo", true)
      .eq("unidade_id", unidadeId);
      
    if (profilesError) {
      toast.error("Erro ao carregar perfis da unidade", { description: profilesError.message });
      return;
    }
    
    const profileIds = profilesData.map(p => p.id);
    setAllProfiles(profilesData);

    const [allFolgasRes, blockRes, limRes, prioRes, pendingRes, canceledRes] = await Promise.all([
      supabase.from("folgas").select("*").in("user_id", profileIds).gte("data", start).lte("data", end),
      supabase.from("datas_bloqueadas").select("*").gte("data", start).lte("data", end),
      supabase.from("dia_config").select("*").gte("data", start).lte("data", end),
      supabase.from("prioridade_aniversario").select("*").in("user_id", profileIds).eq("status", "ativa").gte("data", start).lte("data", end),
      supabase.from("solicitacoes_especiais").select("*").in("user_id", profileIds).eq("status", "pendente").gte("data", start).lte("data", end),
      supabase.from("folgas_canceladas").select("*").in("user_id", profileIds).gte("data", start).lte("data", end),
    ]);

    setFolgas(allFolgasRes.data ?? []);
    setManual(blockRes.data ?? []);
    setLimites(limRes.data ?? []);
    setPrios(prioRes.data ?? []);
    setPendingSolics(pendingRes.data ?? []);
    setCanceledFolgas(canceledRes.data ?? []);
  };

  useEffect(() => { load(); }, [year, month0, user, profile?.unidade_id]);

  useEffect(() => {
    const ch = supabase.channel("calendario-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "folgas" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "trocas_folga" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "solicitacoes_especiais" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "folgas_canceladas" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [year, month0, user?.id, profile?.unidade_id]);

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
    const m = new Map<string, { userId: string }>();
    for (const p of prios) m.set(p.data, { userId: p.user_id });
    return m;
  }, [prios]);

  const unlocked = isMonthUnlocked(year, month0);
  const unlock = unlockDateForMonth(year, month0);
  const mk = monthKey(new Date(year, month0, 1));

  const getDayStatus = (iso: string) => {
    return calculateDateStatus({
      date: parseYMD(iso),
      myUserId: user?.id || '',
      allFolgas: folgas,
      allProfiles,
      manualBlocked: manualMap,
      dayLimits,
      birthdayByDate: birthdayByDate as any,
      pendingRequests: pendingSolics,
      canceledFolgas,
      isAdmin: false,
      locked: unlocked ? null : { unlockDateBR: formatBR(unlock) }
    });
  };

  const onSelectDay = async (iso: string) => {
    if (!user) return;
    
    const statusInfo = getDayStatus(iso);

    if (statusInfo.status === "available") {
      const myFolgaThisMonth = folgas.find((f) => 
        f.user_id === user.id && 
        monthKey(parseYMD(f.data)) === mk && 
        (f.tipo === 'sabado' || f.tipo === 'domingo')
      );

      if (myFolgaThisMonth) {
        setChangeFolgaDialog({ newIso: iso, oldFolga: myFolgaThisMonth });
        return;
      }
      
      const d = parseYMD(iso);
      const type = dayType(d);
      if (!type) return;
      
      const { error } = await supabase.from("folgas").insert({
        user_id: user.id, data: iso, mes: mk, tipo: type, criado_por: user.id,
      });
      
      if (error) return toast.error("Erro ao registrar folga", { description: error.message });
      toast.success(`Folga registrada para ${formatBR(d)}`);
      load();
    } else if (statusInfo.status === "mine" || statusInfo.status === "swapped") {
      if (!confirm("Deseja cancelar sua folga nesta data?")) return;
      const { error } = await supabase.from("folgas").delete().eq("user_id", user.id).eq("data", iso);
      if (error) return toast.error(error.message);
      toast.success("Folga cancelada");
      load();
    } else if (statusInfo.status === "pending") {
      const solic = pendingSolics.find(s => s.data === iso && s.user_id === user.id);
      if (solic) setViewDialog(solic);
    } else if (statusInfo.status === "taken" || statusInfo.status === "birthday" || statusInfo.status === "blocked" || !dayType(parseYMD(iso))) {
      setSmartSwap({ iso });
    }
  };

  const doChangeFolga = async () => {
    if (!user || !changeFolgaDialog) return;
    setBusy(true);
    try {
      const { error: delErr } = await supabase.from("folgas").delete().eq("id", changeFolgaDialog.oldFolga.id);
      if (delErr) throw delErr;
      const d = parseYMD(changeFolgaDialog.newIso);
      const type = dayType(d);
      const { error: insErr } = await supabase.from("folgas").insert({
        user_id: user.id, data: changeFolgaDialog.newIso, mes: mk, tipo: type!, criado_por: user.id,
      });
      if (insErr) throw insErr;
      toast.success("Folga alterada com sucesso!");
      setChangeFolgaDialog(null);
      load();
    } catch (e) {
      toast.error("Erro ao alterar folga", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const submitRequest = async () => {
    if (!user || !reqDialog) return;
    setBusy(true);
    
    try {
      if (reqDialog.type === 'swap') {
        const { error } = await supabase.from("trocas_folga").insert({
          solicitante_id: user.id,
          destinatario_id: null,
          data_destinatario: reqDialog.iso,
          mensagem: reqMotivo.trim() || null,
        });
        if (error) throw error;
        toast.success("Solicitação de troca enviada!");
      } else {
        const { error } = await supabase.from("solicitacoes_especiais").insert({
          user_id: user.id, 
          data: reqDialog.iso, 
          motivo: reqMotivo.trim() || "Sem motivo informado",
        });
        if (error) throw error;
        toast.success("Solicitação de exceção enviada!");
      }
      
      setReqDialog(null); 
      setReqMotivo(""); 
      setSmartSwap(null);
      load();
    } catch (e) {
      toast.error("Erro ao enviar solicitação", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  // 🔥 Função para renderizar calendário mobile com dia da semana abreviado
  const renderMobileCalendar = () => {
    const daysInMonth = [];
    const daysInWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const date = new Date(year, month0, 1);
    const monthName = date.toLocaleString('pt-BR', { month: 'long' });

    // Determinar o primeiro dia da semana (0=Dom, 1=Seg...)
    const firstDay = date.getDay();
    
    // Preencher dias do mês
    const totalDays = new Date(year, month0 + 1, 0).getDate();
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(year, month0, i + 1);
      const iso = ymd(d);
      const isWeekend = dayType(d);
      const statusInfo = getDayStatus(iso);
      const isBlocked = manualMap.get(iso)?.liberada === false || autoBlockedDatesForMonth(year, month0).some(b => b.date === iso);
      
      let occupantNames: string[] = [];
      // Buscar ocupantes do dia (folgas)
      const dayFolgas = folgas.filter(f => f.data === iso);
      const profileMap = new Map(allProfiles.map(p => [p.id, p.nome]));
      dayFolgas.forEach(f => {
        const nome = profileMap.get(f.user_id);
        if (nome) occupantNames.push(nome);
      });
      // Incluir folgas fixas
      const fixedProfiles = allProfiles.filter(p => p.folga_fixa_semana === d.getDay());
      fixedProfiles.forEach(p => {
        if (!occupantNames.includes(p.nome)) occupantNames.push(p.nome);
      });

      // Limitar exibição a 3 nomes + contador
      const displayNames = occupantNames.slice(0, 3);
      const remaining = occupantNames.length - 3;

      daysInMonth.push({
        day: i + 1,
        iso,
        weekday: daysInWeek[d.getDay()],
        isWeekend: !!isWeekend,
        isBlocked,
        occupants: occupantNames,
        displayNames,
        remaining,
        limit: dayLimits.get(iso) || 1,
        status: statusInfo.status,
        isMine: statusInfo.status === 'mine' || statusInfo.status === 'swapped',
        isPending: statusInfo.status === 'pending',
        isAvailable: statusInfo.status === 'available',
      });
    }

    return (
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        {/* Cabeçalho */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={() => { const d = new Date(year, month0 - 1, 1); setYear(d.getFullYear()); setMonth0(d.getMonth()); }}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="font-bold text-sm capitalize">{monthName} {year}</span>
            <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={() => { const d = new Date(year, month0 + 1, 1); setYear(d.getFullYear()); setMonth0(d.getMonth()); }}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {daysInMonth.filter(d => d.isWeekend).length} dias úteis
          </span>
        </div>

        {/* Lista de dias */}
        <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
          {daysInMonth.map((item) => {
            const hasFolga = item.occupants.length > 0;
            const isOccupied = hasFolga || item.isBlocked;
            // Determinar cor de fundo baseado no status
            let bgClass = 'hover:bg-slate-50/50';
            if (item.isMine) bgClass = 'bg-green-50/50 hover:bg-green-50';
            else if (item.isPending) bgClass = 'bg-amber-50/50 hover:bg-amber-50';
            else if (item.isBlocked) bgClass = 'bg-rose-50/50 hover:bg-rose-50';

            return (
              <div
                key={item.day}
                className={`px-4 py-3 transition-colors cursor-pointer ${bgClass}`}
                onClick={() => onSelectDay(item.iso)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {item.day}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {item.weekday}
                      </span>
                      {item.isBlocked && (
                        <Badge variant="outline" className="text-[9px] bg-rose-50 text-rose-600 border-rose-200 px-1.5 py-0 h-5">
                          Bloqueado
                        </Badge>
                      )}
                      {!item.isWeekend && (
                        <Badge variant="outline" className="text-[9px] bg-slate-100 text-slate-500 border-slate-200 px-1.5 py-0 h-5">
                          Dia útil
                        </Badge>
                      )}
                      {item.isMine && (
                        <Badge className="text-[9px] bg-green-100 text-green-700 border-green-200 px-1.5 py-0 h-5">
                          Minha folga
                        </Badge>
                      )}
                      {item.isPending && (
                        <Badge className="text-[9px] bg-amber-100 text-amber-700 border-amber-200 px-1.5 py-0 h-5">
                          Pendente
                        </Badge>
                      )}
                      {hasFolga && !item.isMine && !item.isPending && (
                        <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20 px-1.5 py-0 h-5">
                          {item.occupants.length}/{item.limit}
                        </Badge>
                      )}
                    </div>
                    {/* 🔥 Exibe nomes dos ocupantes (apenas primeiro nome) */}
                    {hasFolga ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.displayNames.map((nome, idx) => {
                          const primeiroNome = nome.split(' ')[0];
                          return (
                            <span
                              key={idx}
                              className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-primary/10 text-primary truncate max-w-[100px]"
                              title={nome}
                            >
                              {primeiroNome}
                            </span>
                          );
                        })}
                        {item.remaining > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{item.remaining}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400">
                        {item.isWeekend && !item.isBlocked ? 'Disponível' : 'Nenhum colaborador'}
                      </span>
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <CalIcon className="size-6 text-primary" /> Calendário de Folgas
        </h1>
        <p className="text-muted-foreground mt-1">Escolha sua folga ou solicite uma troca.</p>
      </div>

      {/* 🔥 Renderização condicional: mobile vs desktop */}
      {isMobile ? (
        renderMobileCalendar()
      ) : (
        <FolgaCalendar
          year={year} month0={month0}
          manualBlocked={manualMap} dayLimits={dayLimits}
          birthdayByDate={birthdayByDate as any}
          myUserId={user?.id ?? null}
          allFolgas={folgas} allProfiles={allProfiles}
          pendingRequests={pendingSolics}
          onPrev={() => { const d = new Date(year, month0 - 1, 1); setYear(d.getFullYear()); setMonth0(d.getMonth()); }}
          onNext={() => { const d = new Date(year, month0 + 1, 1); setYear(d.getFullYear()); setMonth0(d.getMonth()); }}
          onSelectDay={onSelectDay}
          locked={unlocked ? null : { unlockDateBR: formatBR(unlock) }}
        />
      )}

      {/* Diálogo de Mudança de Folga */}
      <Dialog open={!!changeFolgaDialog} onOpenChange={(o) => !o && setChangeFolgaDialog(null)}>
        <DialogContent className="rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <RefreshCw className="size-5 text-primary" /> Alterar Folga Mensal
            </DialogTitle>
            <DialogDescription>Deseja trocar sua folga atual por esta nova data disponível?</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-2xl border border-border text-center">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Folga Atual</Label>
                <div className="text-lg font-bold mt-1 text-muted-foreground line-through">{changeFolgaDialog && formatBR(parseYMD(changeFolgaDialog.oldFolga.data))}</div>
              </div>
              <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 text-center">
                <Label className="text-[10px] font-black uppercase text-primary">Nova Folga</Label>
                <div className="text-lg font-bold mt-1 text-primary">{changeFolgaDialog && formatBR(parseYMD(changeFolgaDialog.newIso))}</div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setChangeFolgaDialog(null)} disabled={busy}>Cancelar</Button>
            <Button onClick={doChangeFolga} disabled={busy} className="px-8">{busy ? "Alterando..." : "Confirmar Troca"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Opções (Troca ou Exceção) */}
      <Dialog open={!!smartSwap} onOpenChange={(o) => !o && setSmartSwap(null)}>
        <DialogContent className="rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ArrowLeftRight className="size-5 text-primary" /> Opções para {smartSwap && formatBR(parseYMD(smartSwap.iso))}
            </DialogTitle>
            <DialogDescription>Este dia já atingiu o limite de folgas ou possui restrições.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-sm text-amber-800 flex items-start gap-3">
              <AlertCircle className="size-5 shrink-0" />
              <p>Você pode solicitar uma troca anônima com os colaboradores que folgam neste dia ou pedir uma exceção ao administrador.</p>
            </div>
            <div className="grid gap-3">
              <Button className="w-full h-12 rounded-xl font-bold" onClick={() => setReqDialog({ iso: smartSwap!.iso, type: 'swap' })}>
                <ArrowLeftRight className="size-4 mr-2" /> Solicitar troca de folga
              </Button>
              <Button variant="outline" className="w-full h-12 rounded-xl border-primary/20 text-primary hover:bg-primary/5" onClick={() => setReqDialog({ iso: smartSwap!.iso, type: 'exception' })}>
                <ShieldAlert className="size-4 mr-2" /> Solicitar exceção administrativa
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo Unificado de Motivo */}
      <Dialog open={!!reqDialog} onOpenChange={(o) => !o && setReqDialog(null)}>
        <DialogContent className="rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {reqDialog?.type === 'swap' ? <ArrowLeftRight className="size-5 text-primary" /> : <ShieldAlert className="size-5 text-primary" />}
              {reqDialog?.type === 'swap' ? "Solicitar troca de folga" : "Solicitar exceção administrativa"}
            </DialogTitle>
            <DialogDescription>
              Data: <b>{reqDialog && formatBR(parseYMD(reqDialog.iso))}</b>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="motivo" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Motivo da solicitação (opcional)
              </Label>
              <Textarea 
                id="motivo"
                placeholder="Ex: Consulta médica, evento familiar, viagem..." 
                value={reqMotivo} 
                onChange={(e) => setReqMotivo(e.target.value)} 
                rows={4} 
                className="rounded-xl resize-none" 
              />
            </div>
            
            <div className="p-3 bg-muted/50 rounded-xl text-[11px] text-muted-foreground flex items-start gap-2">
              <Info className="size-3.5 shrink-0 mt-0.5" />
              <p>
                {reqDialog?.type === 'swap' 
                  ? "Sua solicitação será enviada anonimamente para os colaboradores que folgam neste dia." 
                  : "Sua solicitação será enviada diretamente para a administração."}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setReqDialog(null)} disabled={busy}>Cancelar</Button>
            <Button onClick={submitRequest} disabled={busy} className="px-6">
              {busy ? "Enviando..." : <><Send className="size-4 mr-2" /> Enviar solicitação</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visualização de Pendente */}
      <Dialog open={!!viewDialog} onOpenChange={(o) => !o && setViewDialog(null)}>
        <DialogContent className="rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Clock className="size-5 text-violet-500" /> Solicitação Pendente</DialogTitle>
          </DialogHeader>
          <div className="p-4 bg-violet-50 border border-violet-100 rounded-2xl">
            <Label className="text-[10px] font-black uppercase text-violet-400">Seu Motivo</Label>
            <p className="text-sm text-violet-900 italic mt-1">"{viewDialog?.motivo || "Sem motivo informado"}"</p>
          </div>
          <DialogFooter><Button variant="outline" className="w-full" onClick={() => setViewDialog(null)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}