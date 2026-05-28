import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { FolgaCalendar, type DayOccupant } from "@/components/FolgaCalendar";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar as CalIcon, Filter, User, Trash2, Plus, Settings2, Save, Lock, Info, Unlock, AlertTriangle, ChevronRight } from "lucide-react";
import { dayType, formatBR, monthKey, parseYMD, ymd, autoBlockedDatesForMonth } from "@/lib/folga-rules";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function AdminCalendar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month0, setMonth0] = useState(today.getMonth());
  
  const [folgas, setFolgas] = useState<any[]>([]);
  const [manual, setManual] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [limites, setLimites] = useState<any[]>([]);
  const [pendentes, setPendentes] = useState<any[]>([]);
  
  const [filterUser, setFilterUser] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const [dlg, setDlg] = useState<{ iso: string; status: string } | null>(null);
  const [assignUser, setAssignUser] = useState<string>("");
  const [editLimit, setEditLimit] = useState<number>(1);
  const [savingLimit, setSavingLimit] = useState(false);

  const load = async () => {
    const start = `${year}-${String(month0 + 1).padStart(2, "0")}-01`;
    const endDate = new Date(year, month0 + 1, 0);
    const end = ymd(endDate);

    const [fRes, bRes, pRes, limRes, pendRes] = await Promise.all([
      supabase.from("folgas").select("*").gte("data", start).lte("data", end),
      supabase.from("datas_bloqueadas").select("*").gte("data", start).lte("data", end),
      supabase.from("profiles").select("*").eq("ativo", true).order("nome"),
      supabase.from("dia_config").select("*").gte("data", start).lte("data", end),
      supabase.from("solicitacoes_especiais").select("*").eq("status", "pendente").gte("data", start).lte("data", end),
    ]);

    setProfiles(pRes.data ?? []);
    setFolgas(fRes.data ?? []);
    setManual(bRes.data ?? []);
    setLimites(limRes.data ?? []);
    setPendentes(pendRes.data ?? []);
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

  const occupantsByDate = useMemo(() => {
    const m = new Map<string, DayOccupant[]>();
    const nm = new Map(profiles.map(p => [p.id, p.nome]));

    const days = getMonthDays(year, month0);
    for (const d of days) {
      const iso = ymd(d);
      const wd = d.getDay();
      const fixedOnes = profiles.filter(p => p.folga_fixa_semana === wd);
      
      fixedOnes.forEach(p => {
        if (filterUser !== "all" && p.id !== filterUser) return;
        if (filterType !== "all" && filterType !== "fixed") return;
        
        const arr = m.get(iso) ?? [];
        arr.push({ userId: p.id, userName: p.nome, type: "fixed", origin: "Folga Semanal" });
        m.set(iso, arr);
      });
    }

    folgas.forEach(f => {
      if (filterUser !== "all" && f.user_id !== filterUser) return;
      if (filterType !== "all" && filterType !== "monthly") return;
      
      const iso = f.data;
      const arr = m.get(iso) ?? [];
      arr.push({ 
        userId: f.user_id, 
        userName: nm.get(f.user_id) || "Desconhecido", 
        type: "monthly", 
        origin: f.criado_por ? "Atribuição Manual" : "Sorteio Automático" 
      });
      m.set(iso, arr);
    });

    pendentes.forEach(p => {
      if (filterUser !== "all" && p.user_id !== filterUser) return;
      if (filterType !== "all" && filterType !== "pending") return;
      
      const iso = p.data;
      const arr = m.get(iso) ?? [];
      arr.push({ 
        userId: p.user_id, 
        userName: nm.get(p.user_id) || "Desconhecido", 
        type: "pending", 
        origin: "Solicitação Pendente",
        requestId: p.id
      });
      m.set(iso, arr);
    });

    return m;
  }, [profiles, folgas, pendentes, year, month0, filterUser, filterType]);

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

  const onSelect = (iso: string) => {
    setDlg({ iso, status: "" });
    setAssignUser("");
    setEditLimit(dayLimits.get(iso) ?? 1);
  };

  const assignFolga = async (iso: string) => {
    if (!assignUser) return toast.error("Escolha um funcionário");
    const d = parseYMD(iso);
    const tipo = dayType(d);
    if (!tipo) return toast.error("Apenas sábado ou domingo");
    const { error } = await supabase.from("folgas").insert({
      user_id: assignUser, data: iso, mes: monthKey(d), tipo, criado_por: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Folga atribuída");
    setDlg(null); load();
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
    setDlg(null); load();
  };

  const unlockDay = async (iso: string) => {
    const block = manual.find(m => m.data === iso);
    if (!block) {
      // Se for um bloqueio automático não materializado, criamos uma entrada liberada
      const { error } = await supabase.from("datas_bloqueadas").upsert({
        data: iso,
        motivo: "Liberado manualmente",
        liberada: true,
        auto: false
      }, { onConflict: 'data' });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("datas_bloqueadas").update({ liberada: true }).eq("id", block.id);
      if (error) return toast.error(error.message);
    }
    toast.success("Data liberada com sucesso");
    setDlg(null); load();
  };

  const goPrev = () => { const d = new Date(year, month0 - 1, 1); setYear(d.getFullYear()); setMonth0(d.getMonth()); };
  const goNext = () => { const d = new Date(year, month0 + 1, 1); setYear(d.getFullYear()); setMonth0(d.getMonth()); };

  const isWeekend = dlg ? !!dayType(parseYMD(dlg.iso)) : false;
  
  const currentBlock = useMemo(() => {
    if (!dlg) return null;
    const m = manual.find(x => x.data === dlg.iso && !x.liberada);
    if (m) return { motivo: m.motivo, auto: m.auto, created_at: m.created_at, id: m.id };
    
    // Se não achou no banco, verifica se é um bloqueio automático da regra
    const auto = autoBlockedDatesForMonth(year, month0).find(b => b.date === dlg.iso);
    if (auto) return { motivo: auto.reason, auto: true, created_at: null, id: null };
    
    return null;
  }, [dlg, manual, year, month0]);

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

      <div className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-wrap gap-8 items-end shadow-sm">
        <div className="space-y-2.5">
          <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 flex items-center gap-2">
            <User className="size-3.5" /> Colaborador
          </Label>
          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger className="w-[260px] bg-slate-50/50 border-slate-200 rounded-2xl h-12 font-semibold">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all">Todos os colaboradores</SelectItem>
              {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
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
        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-900 font-bold uppercase tracking-widest text-[10px] h-12 px-6" onClick={() => { setFilterUser("all"); setFilterType("all"); }}>
          Limpar Filtros
        </Button>
      </div>

      <FolgaCalendar
        year={year} month0={month0}
        occupantsByDate={occupantsByDate} manualBlocked={manualMap}
        dayLimits={dayLimits}
        myUserId={user?.id ?? null}
        allFolgas={folgas}
        allProfiles={profiles}
        pendingRequests={pendentes}
        isAdmin={true}
        onPrev={goPrev} onNext={goNext}
        onSelectDay={onSelect}
      />

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
              {/* Informações de Bloqueio */}
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
                    {currentBlock.created_at && (
                      <div className="text-[10px] text-rose-400 font-bold uppercase tracking-widest">
                        Criado em: {new Date(currentBlock.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    )}
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

              {/* Configuração de Limite (Apenas FDS) */}
              {isWeekend && (
                <div className="bg-slate-50/80 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                      <Settings2 className="size-3.5" /> Configuração do Dia
                    </h3>
                    <div className="text-[10px] font-bold text-slate-400">
                      Ocupação: {occupantsByDate.get(dlg.iso)?.filter(o => o.type === 'monthly').length ?? 0}/{dayLimits.get(dlg.iso) ?? 1}
                    </div>
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
                  {occupantsByDate.get(dlg.iso)?.map((occ, idx) => {
                    const isPending = occ.type === 'pending';
                    
                    const content = (
                      <div className={cn(
                        "group p-5 rounded-3xl border flex items-center justify-between transition-all",
                        isPending 
                          ? "bg-violet-50/50 border-violet-100 hover:bg-white hover:shadow-xl hover:scale-[1.02] cursor-pointer" 
                          : "bg-slate-50/50 border-slate-100 hover:bg-white hover:shadow-xl hover:scale-[1.02]"
                      )}>
                        <div className="flex items-center gap-5">
                          <div className={cn(
                            "size-3 rounded-full shadow-sm",
                            occ.type === 'fixed' ? "bg-blue-400" :
                            occ.type === 'monthly' ? "bg-amber-400" :
                            "bg-orange-400"
                          )} />
                          <div>
                            <div className="font-black text-slate-900 text-lg tracking-tight">{occ.userName}</div>
                            <div className={cn(
                              "text-[11px] font-bold uppercase tracking-widest mt-0.5",
                              isPending ? "text-violet-500" : "text-slate-400"
                            )}>{occ.origin}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isPending && <ChevronRight className="size-5 text-violet-300 group-hover:text-violet-500 transition-colors" />}
                          {occ.type === 'monthly' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="size-10 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFolga(dlg.iso, occ.userId);
                              }}
                            >
                              <Trash2 className="size-5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );

                    if (isPending) {
                      return (
                        <button 
                          key={idx} 
                          className="text-left block w-full"
                          onClick={() => navigate('/admin/solicitacoes')}
                        >
                          {content}
                        </button>
                      );
                    }

                    return <div key={idx}>{content}</div>;
                  })}
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
                      {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button className="h-14 px-8 rounded-2xl shadow-xl shadow-primary/20 font-black uppercase tracking-widest text-xs" onClick={() => assignFolga(dlg.iso)}>
                    <Plus className="size-5 mr-2" /> Atribuir
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
    </div>
  );
}

function getMonthDays(year: number, month0: number): Date[] {
  const days: Date[] = [];
  const last = new Date(year, month0 + 1, 0).getDate();
  for (let i = 1; i <= last; i++) days.push(new Date(year, month0, i));
  return days;
}