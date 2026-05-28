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
import { Calendar as CalIcon, Cake, Clock, AlertCircle, ArrowLeftRight, ShieldAlert, User, RefreshCw } from "lucide-react";

interface Solic {
  id: string;
  data: string;
  motivo: string;
  status: string;
  created_at: string;
  user_id: string;
}

export default function CalendarioPage() {
  const { user, profile } = useAuth();
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
  
  const [smartSwap, setSmartSwap] = useState<{ iso: string; occupants: any[] } | null>(null);
  const [changeFolgaDialog, setChangeFolgaDialog] = useState<{ newIso: string; oldFolga: any } | null>(null);
  const [reqDialog, setReqDialog] = useState<{ iso: string; reason: string } | null>(null);
  const [viewDialog, setViewDialog] = useState<Solic | null>(null);
  const [reqMotivo, setReqMotivo] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const start = `${year}-${String(month0 + 1).padStart(2, "0")}-01`;
    const endDate = new Date(year, month0 + 1, 0);
    const end = ymd(endDate);

    const [allFolgasRes, blockRes, limRes, prioRes, pendingRes, profilesRes, canceledRes] = await Promise.all([
      supabase.from("folgas").select("*").gte("data", start).lte("data", end),
      supabase.from("datas_bloqueadas").select("*").gte("data", start).lte("data", end),
      supabase.from("dia_config").select("*").gte("data", start).lte("data", end),
      supabase.from("prioridade_aniversario").select("*").eq("status", "ativa").gte("data", start).lte("data", end),
      supabase.from("solicitacoes_especiais").select("*").eq("status", "pendente").gte("data", start).lte("data", end),
      supabase.from("profiles").select("*").eq("ativo", true),
      supabase.from("folgas_canceladas").select("*").gte("data", start).lte("data", end),
    ]);

    setFolgas(allFolgasRes.data ?? []);
    setManual(blockRes.data ?? []);
    setLimites(limRes.data ?? []);
    setPrios(prioRes.data ?? []);
    setPendingSolics(pendingRes.data ?? []);
    setAllProfiles(profilesRes.data ?? []);
    setCanceledFolgas(canceledRes.data ?? []);
  };

  useEffect(() => { load(); }, [year, month0, user]);

  useEffect(() => {
    const ch = supabase.channel("calendario-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "folgas" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "trocas_folga" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "solicitacoes_especiais" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "folgas_canceladas" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [year, month0, user?.id]);

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

  const onSelectDay = async (iso: string) => {
    if (!user) return;
    
    const statusInfo = calculateDateStatus({
      date: parseYMD(iso),
      myUserId: user.id,
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

    if (statusInfo.status === "available") {
      // Verifica se já tem folga mensal (sabado/domingo) neste mês
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
      // Identificar quem folga no dia para oferecer troca
      const d = parseYMD(iso);
      const wd = d.getDay();
      
      const occupants = [
        ...folgas.filter(f => f.data === iso).map(f => ({ id: f.user_id, nome: allProfiles.find(p => p.id === f.user_id)?.nome, tipo: 'mensal' })),
        ...allProfiles.filter(p => p.folga_fixa_semana === wd && !canceledFolgas.some(c => c.user_id === p.id && c.data === iso)).map(p => ({ id: p.id, nome: p.nome, tipo: 'semanal' }))
      ].filter(o => o.id !== user.id);

      setSmartSwap({ iso, occupants });
    }
  };

  const doChangeFolga = async () => {
    if (!user || !changeFolgaDialog) return;
    setBusy(true);
    
    try {
      // 1. Remove a antiga
      const { error: delErr } = await supabase
        .from("folgas")
        .delete()
        .eq("id", changeFolgaDialog.oldFolga.id);
      
      if (delErr) throw delErr;

      // 2. Cria a nova
      const d = parseYMD(changeFolgaDialog.newIso);
      const type = dayType(d);
      
      const { error: insErr } = await supabase.from("folgas").insert({
        user_id: user.id, 
        data: changeFolgaDialog.newIso, 
        mes: mk, 
        tipo: type!, 
        criado_por: user.id,
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

  const requestSwap = async (destId: string) => {
    if (!user) return;
    const { error } = await supabase.from("trocas_folga").insert({
      solicitante_id: user.id,
      destinatario_id: destId,
      data_destinatario: smartSwap!.iso,
      mensagem: `Solicitação de troca para o dia ${formatBR(parseYMD(smartSwap!.iso))}`,
    });
    if (error) return toast.error(error.message);
    toast.success("Solicitação de troca enviada!");
    setSmartSwap(null);
    load();
  };

  const submitRequest = async () => {
    if (!user || !reqDialog) return;
    if (reqMotivo.trim().length < 5) return toast.error("Descreva o motivo.");
    const { error } = await supabase.from("solicitacoes_especiais").insert({
      user_id: user.id, data: reqDialog.iso, motivo: reqMotivo.trim(),
    });
    if (error) return toast.error(error.message);
    toast.success("Solicitação de exceção enviada!");
    setReqDialog(null); setReqMotivo(""); setSmartSwap(null);
    load();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <CalIcon className="size-6 text-primary" /> Calendário de Folgas
        </h1>
        <p className="text-muted-foreground mt-1">Escolha sua folga ou solicite uma troca.</p>
      </div>

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

      {/* Diálogo de Mudança de Folga (Troca Direta) */}
      <Dialog open={!!changeFolgaDialog} onOpenChange={(o) => !o && setChangeFolgaDialog(null)}>
        <DialogContent className="rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <RefreshCw className="size-5 text-primary" /> Alterar Folga Mensal
            </DialogTitle>
            <DialogDescription>
              Você já possui uma folga agendada para este mês. Deseja trocá-la?
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-2xl border border-border text-center">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Folga Atual</Label>
                <div className="text-lg font-bold mt-1 text-muted-foreground line-through">
                  {changeFolgaDialog && formatBR(parseYMD(changeFolgaDialog.oldFolga.data))}
                </div>
              </div>
              <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 text-center">
                <Label className="text-[10px] font-black uppercase text-primary">Nova Folga</Label>
                <div className="text-lg font-bold mt-1 text-primary">
                  {changeFolgaDialog && formatBR(parseYMD(changeFolgaDialog.newIso))}
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-sm text-blue-800 flex items-start gap-3">
              <Info className="size-5 shrink-0" />
              <p>Ao confirmar, sua folga antiga será liberada para outros colaboradores e a nova será registrada imediatamente.</p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setChangeFolgaDialog(null)} disabled={busy}>Cancelar</Button>
            <Button onClick={doChangeFolga} disabled={busy} className="px-8">
              {busy ? "Alterando..." : "Confirmar Troca"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo Inteligente de Troca (Com outros) */}
      <Dialog open={!!smartSwap} onOpenChange={(o) => !o && setSmartSwap(null)}>
        <DialogContent className="rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ArrowLeftRight className="size-5 text-primary" /> Opções para {smartSwap && formatBR(parseYMD(smartSwap.iso))}
            </DialogTitle>
            <DialogDescription>
              Este dia possui restrições ou já atingiu o limite.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {smartSwap?.occupants.length ? (
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Colaboradores de folga neste dia:</Label>
                {smartSwap.occupants.map(occ => (
                  <div key={occ.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-border">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {occ.nome?.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold">{occ.nome}</div>
                        <div className="text-xs text-muted-foreground capitalize">Folga {occ.tipo}</div>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => requestSwap(occ.id)}>Solicitar Troca</Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-sm text-amber-800 flex items-start gap-3">
                <AlertCircle className="size-5 shrink-0" />
                <p>Ninguém possui folga agendada para este dia.</p>
              </div>
            )}

            <div className="pt-4 border-t border-border">
              <Button 
                variant="outline" 
                className="w-full h-12 rounded-xl border-primary/20 text-primary hover:bg-primary/5"
                onClick={() => setReqDialog({ iso: smartSwap!.iso, reason: "Solicitação de exceção administrativa" })}
              >
                <ShieldAlert className="size-4 mr-2" /> Solicitar exceção ao administrador
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Exceção */}
      <Dialog open={!!reqDialog} onOpenChange={(o) => !o && setReqDialog(null)}>
        <DialogContent className="rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>Solicitar exceção administrativa</DialogTitle>
            <DialogDescription>Data: {reqDialog && formatBR(parseYMD(reqDialog.iso))}</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Explique o motivo da sua solicitação para o administrador..."
            value={reqMotivo}
            onChange={(e) => setReqMotivo(e.target.value)}
            rows={5}
            className="rounded-xl"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReqDialog(null)}>Cancelar</Button>
            <Button onClick={submitRequest}>Enviar Solicitação</Button>
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
            <p className="text-sm text-violet-900 italic mt-1">"{viewDialog?.motivo}"</p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setViewDialog(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
    </svg>
  );
}