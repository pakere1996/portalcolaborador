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
} from "@/lib/folga-rules";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Calendar as CalIcon, Cake } from "lucide-react";

export default function CalendarioPage() {
  const { user, profile } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month0, setMonth0] = useState(today.getMonth());
  const [folgas, setFolgas] = useState<{ user_id: string; data: string; nome?: string }[]>([]);
  const [manual, setManual] = useState<{ data: string; motivo: string; liberada: boolean }[]>([]);
  const [limites, setLimites] = useState<{ data: string; limite_colaboradores: number }[]>([]);
  const [prios, setPrios] = useState<{ user_id: string; data: string; status: string; nome?: string }[]>([]);
  const [reqDialog, setReqDialog] = useState<{ iso: string; reason: string } | null>(null);
  const [reqMotivo, setReqMotivo] = useState("");

  const load = async () => {
    if (!user) return;
    const start = `${year}-${String(month0 + 1).padStart(2, "0")}-01`;
    const endDate = new Date(year, month0 + 1, 0);
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

    const [allFolgasRes, blockRes, limRes, prioRes] = await Promise.all([
      supabase.from("folgas").select("user_id, data").gte("data", start).lte("data", end),
      supabase.from("datas_bloqueadas").select("data, motivo, liberada").gte("data", start).lte("data", end),
      supabase.from("dia_config").select("data, limite_colaboradores").gte("data", start).lte("data", end),
      supabase.from("prioridade_aniversario").select("user_id, data, status").eq("status", "ativa").gte("data", start).lte("data", end),
    ]);

    const allFolgas = (allFolgasRes.data ?? []) as { user_id: string; data: string }[];

    const combined = allFolgas.map(f => ({
      user_id: f.user_id,
      data: f.data,
      nome: f.user_id === user.id ? "Sua folga" : "Ocupado"
    }));

    setFolgas(combined);
    setManual(blockRes.data ?? []);
    setLimites(limRes.data ?? []);
    setPrios(((prioRes.data ?? []) as { user_id: string; data: string; status: string }[]).map((p) => ({
      ...p, nome: p.user_id === user.id ? "Sua prioridade" : "Reservado",
    })));
  };

  useEffect(() => { load(); }, [year, month0, user]);

  useEffect(() => {
    const ch = supabase
      .channel("calendario-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "folgas" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "prioridade_aniversario" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "dia_config" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [year, month0, user?.id]);

  const occupantsByDate = useMemo(() => {
    const m = new Map<string, DayOccupant[]>();
    for (const f of folgas) {
      const arr = m.get(f.data) ?? [];
      arr.push({ userId: f.user_id, userName: f.nome });
      m.set(f.data, arr);
    }
    return m;
  }, [folgas]);

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
    const m = new Map<string, { userId: string; userName?: string }>();
    for (const p of prios) m.set(p.data, { userId: p.user_id, userName: p.nome });
    return m;
  }, [prios]);

  const unlocked = isMonthUnlocked(year, month0);
  const unlock = unlockDateForMonth(year, month0);

  const mk = `${year}-${String(month0 + 1).padStart(2, "0")}`;
  const myFolgaThisMonth = folgas.find((f) => f.user_id === user?.id && monthKey(parseYMD(f.data)) === mk);

  const goPrev = () => {
    const d = new Date(year, month0 - 1, 1);
    setYear(d.getFullYear()); setMonth0(d.getMonth());
  };
  const goNext = () => {
    const d = new Date(year, month0 + 1, 1);
    setYear(d.getFullYear()); setMonth0(d.getMonth());
  };

  const onSelectDay = async (iso: string, info: { status: string; reason?: string }) => {
    if (!user) return;
    if (info.status === "available") {
      if (myFolgaThisMonth) {
        toast.error("Você já escolheu uma folga neste mês.");
        return;
      }
      const d = parseYMD(iso);
      const type = dayType(d);
      if (!type) return;
      const { data: inserted, error } = await supabase.from("folgas").insert({
        user_id: user.id,
        data: iso,
        mes: mk,
        tipo: type,
        criado_por: user.id,
      }).select("id").maybeSingle();
      if (error || !inserted) {
        const msg = error?.message ?? "Erro desconhecido";
        if (msg.toLowerCase().includes("limite") || msg.toLowerCase().includes("lotado")) {
          toast.error("Esta data já atingiu o limite de colaboradores.");
        } else if (msg.toLowerCase().includes("aniversariante") || msg.toLowerCase().includes("reservad")) {
          toast.error("Esta data está reservada para um aniversariante.");
        } else {
          toast.error("Não foi possível registrar a folga", { description: msg });
        }
        await load();
        return;
      }
      toast.success(`Folga registrada para ${formatBR(d)}`);
      load();
    } else if (info.status === "birthday") {
      toast.info("Data reservada para aniversariante");
    } else if (info.status === "blocked") {
      setReqDialog({ iso, reason: info.reason ?? "Data bloqueada" });
    } else if (info.status === "mine") {
      if (!confirm("Deseja cancelar sua folga nesta data?")) return;
      const { error } = await supabase.from("folgas").delete().eq("user_id", user.id).eq("data", iso);
      if (error) return toast.error(error.message);
      toast.success("Folga cancelada");
      load();
    } else if (info.status === "taken") {
      toast.info("Esta data atingiu o limite de colaboradores.");
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

      {myFolgaThisMonth && (
        <div className="rounded-xl bg-mine/15 border border-mine/40 px-4 py-3 text-sm">
          Sua folga em <b>{MONTH_NAMES[month0]}</b>:{" "}
          <b>{formatBR(parseYMD(myFolgaThisMonth.data))}</b>. Clique nela para cancelar.
        </div>
      )}

      {myBirthdayPrio && (
        <div className="rounded-xl bg-pending/15 border border-pending/40 px-4 py-3 text-sm flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Cake className="size-4 text-pending" />
            <span>
              Seu aniversário cai em <b>{formatBR(parseYMD(myBirthdayPrio.data))}</b>.
              Você tem <b>prioridade exclusiva</b> nesta data.
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={abdicarPrio}>Desistir da prioridade</Button>
        </div>
      )}

      <FolgaCalendar
        year={year}
        month0={month0}
        occupantsByDate={occupantsByDate}
        manualBlocked={manualMap}
        dayLimits={dayLimits}
        birthdayByDate={birthdayByDate}
        myUserId={user?.id ?? null}
        onPrev={goPrev}
        onNext={goNext}
        onSelectDay={onSelectDay}
        locked={unlocked ? null : { unlockDateBR: formatBR(unlock) }}
      />

      <div className="text-xs text-muted-foreground">
        Datas bloqueadas automaticamente:{" "}
        {autoBlockedDatesForMonth(year, month0).map((b) => formatBR(parseYMD(b.date))).join(", ") || "nenhuma"}.
        Você pode <b>solicitar exceção</b> clicando em uma data vermelha bloqueada.
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
    </div>
  );
}