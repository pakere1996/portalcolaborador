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
import { Calendar as CalIcon, Filter, User, Info } from "lucide-react";
import { dayType, formatBR, monthKey, parseYMD, ymd } from "@/lib/folga-rules";
import { Badge } from "@/components/ui/badge";

export default function AdminCalendar() {
  const { user } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month0, setMonth0] = useState(today.getMonth());
  
  // Data
  const [folgas, setFolgas] = useState<any[]>([]);
  const [manual, setManual] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [limites, setLimites] = useState<any[]>([]);
  const [pendentes, setPendentes] = useState<any[]>([]);
  
  // Filters
  const [filterUser, setFilterUser] = useState("all");
  const [filterType, setFilterType] = useState("all");

  // Dialog
  const [dlg, setDlg] = useState<{ iso: string; status: string } | null>(null);
  const [assignUser, setAssignUser] = useState<string>("");
  const [blockReason, setBlockReason] = useState("");
  const [limitInput, setLimitInput] = useState<number>(1);

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

    // 1. Folgas Fixas (Calculadas para cada dia do mês)
    const days = getMonthDays(year, month0);
    for (const d of days) {
      const iso = ymd(d);
      const wd = d.getDay();
      const fixedOnes = profiles.filter(p => p.folga_fixa_semana === wd);
      
      fixedOnes.forEach(p => {
        if (filterUser !== "all" && p.id !== filterUser) return;
        if (filterType !== "all" && filterType !== "fixed") return;
        
        const arr = m.get(iso) ?? [];
        arr.push({ userId: p.id, userName: p.nome, type: "fixed", origin: "Cadastro Administrativo" });
        m.set(iso, arr);
      });
    }

    // 2. Folgas Mensais
    folgas.forEach(f => {
      if (filterUser !== "all" && f.user_id !== filterUser) return;
      if (filterType !== "all" && filterType !== "monthly") return;
      
      const iso = f.data;
      const arr = m.get(iso) ?? [];
      arr.push({ 
        userId: f.user_id, 
        userName: nm.get(f.user_id) || "Desconhecido", 
        type: "monthly", 
        origin: f.criado_por ? "Manual/Admin" : "Sorteio/Sistema" 
      });
      m.set(iso, arr);
    });

    // 3. Pendentes
    pendentes.forEach(p => {
      if (filterUser !== "all" && p.user_id !== filterUser) return;
      if (filterType !== "all" && filterType !== "pending") return;
      
      const iso = p.data;
      const arr = m.get(iso) ?? [];
      arr.push({ 
        userId: p.user_id, 
        userName: nm.get(p.user_id) || "Desconhecido", 
        type: "pending", 
        origin: "Solicitação do Colaborador" 
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

  const onSelect = (iso: string, info: { status: string }) => {
    setDlg({ iso, status: info.status });
    setAssignUser("");
    setBlockReason("");
    setLimitInput(dayLimits.get(iso) ?? 1);
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
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <CalIcon className="size-6 text-primary" /> Calendário Geral
          </h1>
          <p className="text-muted-foreground mt-1">Visão completa da escala e folgas da equipe.</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-4 items-end shadow-sm">
        <div className="space-y-2">
          <Label className="text-xs flex items-center gap-1"><User className="size-3" /> Colaborador</Label>
          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os colaboradores</SelectItem>
              {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs flex items-center gap-1"><Filter className="size-3" /> Tipo de Folga</Label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
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
        <Button variant="ghost" size="sm" onClick={() => { setFilterUser("all"); setFilterType("all"); }}>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalIcon className="size-5 text-primary" />
              {dlg && formatBR(parseYMD(dlg.iso))}
            </DialogTitle>
          </DialogHeader>

          {dlg && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Escala do Dia</h3>
                <div className="space-y-2">
                  {occupantsByDate.get(dlg.iso)?.map((occ, idx) => (
                    <div key={idx} className="bg-muted/30 p-3 rounded-lg border border-border/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm">{occ.userName}</span>
                        <Badge className={cn(
                          "text-[10px]",
                          occ.type === 'fixed' ? "bg-blue-600" :
                          occ.type === 'monthly' ? "bg-amber-400 text-amber-900" :
                          "bg-orange-500"
                        )}>
                          {occ.type === 'fixed' ? "Fixa" : occ.type === 'monthly' ? "Mensal" : "Pendente"}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Info className="size-3" /> Origem: {occ.origin}
                      </div>
                      {occ.type === 'monthly' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full mt-2 h-7 text-xs text-destructive hover:bg-destructive/10"
                          onClick={() => removeFolga(dlg.iso, occ.userId)}
                        >
                          Remover Folga
                        </Button>
                      )}
                    </div>
                  ))}
                  {!occupantsByDate.get(dlg.iso)?.length && (
                    <div className="text-sm text-muted-foreground text-center py-4 italic">Ninguém escalado para este dia.</div>
                  )}
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Ações Rápidas</h3>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Atribuir Folga Mensal</Label>
                    <div className="flex gap-2">
                      <Select value={assignUser} onValueChange={setAssignUser}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={() => assignFolga(dlg.iso)}>Atribuir</Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDlg(null)}>Fechar</Button>
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