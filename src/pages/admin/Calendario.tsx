import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { FolgaCalendar, type DayOccupant } from "@/components/FolgaCalendar";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar as CalIcon, Filter, User, Info, Trash2, Plus } from "lucide-react";
import { dayType, formatBR, monthKey, parseYMD, ymd } from "@/lib/folga-rules";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function AdminCalendar() {
  const { user } = useAuth();
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
        arr.push({ userId: p.id, userName: p.nome, type: "fixed", origin: "Folga Semanal Fixa" });
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
        origin: "Solicitação Pendente" 
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

  const removeFolga = async (iso: string, userId: string) => {
    const f = folgas.find((x) => x.data === iso && x.user_id === userId);
    if (!f) return;
    const { error } = await supabase.from("folgas").delete().eq("id", f.id);
    if (error) return toast.error(error.message);
    toast.success("Folga removida");
    setDlg(null); load();
  };

  const goPrev = () => { const d = new Date(year, month0 - 1, 1); setYear(d.getFullYear()); setMonth0(d.getMonth()); };
  const goNext = () => { const d = new Date(year, month0 + 1, 1); setYear(d.getFullYear()); setMonth0(d.getMonth()); };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <CalIcon className="size-8 text-primary" /> Calendário Geral
          </h1>
          <p className="text-slate-500 mt-1">Gestão centralizada de escalas e folgas da equipe.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-6 items-end shadow-sm">
        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <User className="size-3" /> Colaborador
          </Label>
          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger className="w-[240px] bg-slate-50 border-slate-200 rounded-xl">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os colaboradores</SelectItem>
              {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Filter className="size-3" /> Tipo de Folga
          </Label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[200px] bg-slate-50 border-slate-200 rounded-xl">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="fixed">Semanal Fixa</SelectItem>
              <SelectItem value="monthly">Mensal (FDS)</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-600" onClick={() => { setFilterUser("all"); setFilterType("all"); }}>
          Limpar Filtros
        </Button>
      </div>

      <FolgaCalendar
        year={year} month0={month0}
        occupantsByDate={occupantsByDate} manualBlocked={manualMap}
        dayLimits={dayLimits}
        isAdmin={true}
        onPrev={goPrev} onNext={goNext}
        onSelectDay={onSelect}
      />

      <Dialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="max-w-lg rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <CalIcon className="size-5 text-primary" />
              </div>
              {dlg && formatBR(parseYMD(dlg.iso))}
            </DialogTitle>
          </DialogHeader>

          {dlg && (
            <div className="space-y-8 py-4">
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Escala do Dia</h3>
                <div className="grid gap-3">
                  {occupantsByDate.get(dlg.iso)?.map((occ, idx) => (
                    <div key={idx} className="group bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between transition-all hover:bg-white hover:shadow-md">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "size-2 rounded-full",
                          occ.type === 'fixed' ? "bg-blue-400" :
                          occ.type === 'monthly' ? "bg-amber-400" :
                          "bg-orange-400"
                        )} />
                        <div>
                          <div className="font-bold text-slate-900">{occ.userName}</div>
                          <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{occ.origin}</div>
                        </div>
                      </div>
                      {occ.type === 'monthly' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="size-8 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeFolga(dlg.iso, occ.userId)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {!occupantsByDate.get(dlg.iso)?.length && (
                    <div className="text-sm text-slate-400 text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      Ninguém escalado para este dia.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Atribuir Folga Manual</h3>
                <div className="flex gap-3">
                  <Select value={assignUser} onValueChange={setAssignUser}>
                    <SelectTrigger className="flex-1 bg-slate-50 border-slate-200 rounded-xl h-11">
                      <SelectValue placeholder="Escolher colaborador..." />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button className="h-11 px-6 rounded-xl shadow-lg shadow-primary/20" onClick={() => assignFolga(dlg.iso)}>
                    <Plus className="size-4 mr-2" /> Atribuir
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-center">
            <Button variant="ghost" className="text-slate-400 font-bold uppercase tracking-widest text-[10px]" onClick={() => setDlg(null)}>Fechar</Button>
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