import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { FolgaCalendar, type DayOccupant } from "@/components/FolgaCalendar";
import {
  MONTH_NAMES,
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
import { Calendar as CalIcon, Cake, Clock, AlertCircle } from "lucide-react";

interface Solic {
  id: string;
  data: string;
  motivo: string;
  status: string;
  created_at: string;
}

export default function CalendarioPage() {
  const { user, profile } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month0, setMonth0] = useState(today.getMonth());
  
  const [folgas, setFolgas] = useState<{ user_id: string; data: string }[]>([]);
  const [manual, setManual] = useState<{ data: string; motivo: string; liberada: boolean }[]>([]);
  const [limites, setLimites] = useState<{ data: string; limite_colaboradores: number }[]>([]);
  const [prios, setPrios] = useState<{ user_id: string; data: string; status: string }[]>([]);
  const [pendingSolics, setPendingSolics] = useState<Solic[]>([]);
  const [allProfiles, setAllProfiles] = useState<{ id: string; folga_fixa_semana: number | null }[]>([]);
  
  const [reqDialog, setReqDialog] = useState<{ iso: string; reason: string } | null>(null);
  const [viewDialog, setViewDialog] = useState<Solic | null>(null);
  const [reqMotivo, setReqMotivo] = useState("");

  const load = async () => {
    if (!user) return;
    const start = `${year}-${String(month0 + 1).padStart(2, "0")}-01`;
    const endDate = new Date(year, month0 + 1, 0);
    const end = ymd(endDate);

    // Buscamos folgas de TODOS os usuários para calcular ocupação real
    const [allFolgasRes, blockRes, limRes, prioRes, pendingRes, profilesRes] = await Promise.all([
      supabase.from("folgas").select("user_id, data").gte("data", start).lte("data", end),
      supabase.from("datas_bloqueadas").select("data, motivo, liberada").gte("data", start).lte("data", end),
      supabase.from("dia_config").select("data, limite_colaboradores").gte("data", start).lte("data", end),
      supabase.from("prioridade_aniversario").select("user_id, data, status").eq("status", "ativa").gte("data", start).lte("data", end),
      supabase.from("solicitacoes_especiais").select("*").eq("user_id", user.id).eq("status", "pendente").gte("data", start).lte("data", end),
      supabase.from("profiles").select("id, folga_fixa_semana").eq("ativo", true),
    ]);

    setFolgas((allFolgasRes.data ?? []) as { user_id: string; data: string }[]);
    setManual((blockRes.data ?? []) as { data: string; motivo: string; liberada: boolean }[]);
    setLimites((limRes.data ?? []) as { data: string; limite_colaboradores: number }[]);
    setPrios((prioRes.data ?? []) as { user_id: string; data: string; status: string }[]);
    setPendingSolics((pendingRes.data ?? []) as Solic[]);
    setAllProfiles((profilesRes.data ?? []) as { id: string; folga_fixa_semana: number | null }[]);
  };

  useEffect(() => { load(); }, [year, month0, user]);

  useEffect(() => {
    const ch = supabase
      .channel("calendario-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "folgas" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "prioridade_aniversario" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "solicitacoes_especiais" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "dia_config" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "datas_bloqueadas" }, () => load())
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
    
    // USAR A MESMA LÓGICA UNIFICADA PARA VALIDAR O CLIQUE
    const { status, reason } = calculateDateStatus({
      date: parseYMD(iso),
      myUserId: user.id,
      allFolgas: folgas,
      allProfiles: allProfiles,
      manualBlocked: manualMap,
      dayLimits: dayLimits,
      birthdayByDate: birthdayByDate,
      pendingRequests: pendingSolics,
      isAdmin: false,
      locked: unlocked ? null : { unlockDateBR: formatBR(unlock) }
    });

    if (status === "available") {
      const myFolgaThisMonth = folgas.find((f) => f.user_id === user.id && monthKey(parseYMD(f.data)) === mk);
      if (myFolgaThisMonth) {
        toast.error("Você já possui uma folga selecionada neste mês.");
        return;
      }
      
      const d = parseYMD(iso);
      const type = dayType(d);
      if (!type) return;
      
      const { data: inserted, error } = await supabase.from("folgas").insert({
        user_id: user.id, data: iso, mes: mk, tipo: type, criado_por: user.id,
      }).select("id").maybeSingle();
      
      if (error || !inserted) {
        toast.error("Não foi possível registrar a folga", { description: error?.message || "Data indisponível" });
        load();
        return;
      }
      toast.success(`Folga registrada para ${formatBR(d)}`);
      load();
    } else if (status === "mine") {
      if (!confirm("Deseja cancelar sua folga nesta data?")) return;
      const { error } = await supabase.from("folgas").delete().eq("user_id", user.id).eq("data", iso);
      if (error) return toast.error(error.message);
      toast.success("Folga cancelada");
      load();
    } else if (status === "pending") {
      const solic = pendingSolics.find(s => s.data === iso);
      if (solic) setViewDialog(solic);
    } else if (status === "blocked" || status === "taken" || status === "birthday") {
      setReqDialog({ iso, reason: reason ?? "Data indisponível" });
    }
  };

  const submitRequest = async () => {
    if (!user || !reqDialog) return;
    if (reqMotivo.trim().length < 5) {
      toast.error("Descreva o motivo (mín. 5 caracteres).");
      return;
    }
    const { error } = await supabase.from("solicitacoes_especiais").insert({
      user_id: user.id, data: reqDialog.iso, motivo: reqMotivo.trim(),
    });
    if (error) return toast.error(error.message);
    toast.success("Solicitação enviada! Aguarde a resposta do admin.");
    setReqDialog(null); setReqMotivo("");
    load();
  };

  const myBirthdayPrio = prios.find((p) => p.user_id === user?.id);
  const abdicarPrio = async () => {
    if (!myBirthdayPrio) return;
    if (!confirm("Desistir da prioridade de aniversário e liberar para os colegas?")) return;
    const { error } = await supabase.from("prioridade_aniversario")
      .update({ status: "abdicada" })
      .eq("user_id", user!.id).eq("data", myBirthdayPrio.data);
    if (error) return toast.error(error.message);
    toast.success("Prioridade liberada.");
    load();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <CalIcon className="size-6 text-primary" /> Calendário de Folgas
        </h1>
        <p className="text-muted-foreground mt-1">
          Olá, <b>{profile?.nome}</b>. Escolha 1 sábado <i>ou</i> 1 domingo por mês.
        </p>
      </div>

      {myBirthdayPrio && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm flex items-center justify-between gap-3 flex-wrap text-amber-700">
          <div className="flex items-center gap-2">
            <Cake className="size-4 text-amber-500" />
            <span>
              Seu aniversário cai em <b>{formatBR(parseYMD(myBirthdayPrio.data))}</b>.
              Você tem <b>prioridade exclusiva</b> nesta data.
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={abdicarPrio} className="text-amber-700 hover:bg-amber-100">Desistir da prioridade</Button>
        </div>
      )}

      <FolgaCalendar
        year={year}
        month0={month0}
        manualBlocked={manualMap}
        dayLimits={dayLimits}
        birthdayByDate={birthdayByDate as any}
        myUserId={user?.id ?? null}
        allFolgas={folgas}
        allProfiles={allProfiles}
        pendingRequests={pendingSolics}
        onPrev={() => { const d = new Date(year, month0 - 1, 1); setYear(d.getFullYear()); setMonth0(d.getMonth()); }}
        onNext={() => { const d = new Date(year, month0 + 1, 1); setYear(d.getFullYear()); setMonth0(d.getMonth()); }}
        onSelectDay={onSelectDay}
        locked={unlocked ? null : { unlockDateBR: formatBR(unlock) }}
      />

      <div className="text-xs text-muted-foreground">
        Datas bloqueadas automaticamente:{" "}
        {autoBlockedDatesForMonth(year, month0).map((b) => formatBR(parseYMD(b.date))).join(", ") || "nenhuma"}.
        Você pode <b>solicitar exceção</b> clicando em uma data vermelha.
      </div>

      <Dialog open={!!reqDialog} onOpenChange={(o) => !o && setReqDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar exceção</DialogTitle>
            <DialogDescription>
              {reqDialog && (
                <>Data <b>{formatBR(parseYMD(reqDialog.iso))}</b> — {reqDialog.reason}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Explique o motivo da solicitaçao"
            value={reqMotivo}
            onChange={(e) => setReqMotivo(e.target.value)}
            rows={5}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReqDialog(null)}>Cancelar</Button>
            <Button onClick={submitRequest}>Enviar solicitação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewDialog} onOpenChange={(o) => !o && setViewDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="size-5 text-violet-500" /> Solicitação Pendente
            </DialogTitle>
            <DialogDescription>
              {viewDialog && (
                <>Data solicitada: <b>{formatBR(parseYMD(viewDialog.data))}</b></>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-violet-400">Seu Motivo</Label>
              <p className="text-sm text-violet-900 italic">"{viewDialog?.motivo}"</p>
            </div>
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-100">
              <AlertCircle className="size-4 shrink-0" />
              <span className="text-xs font-medium">Aguardando aprovação administrativa</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setViewDialog(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}