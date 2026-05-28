import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeftRight, Check, X as XIcon, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/trocas")({
  component: TrocasPage,
});

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

interface Profile { id: string; nome: string; folga_fixa_semana: number | null }

interface Troca {
  id: string;
  solicitante_id: string;
  destinatario_id: string;
  dia_original: number;
  dia_solicitado: number;
  mensagem: string | null;
  status: string;
  solicitante_aprovou: boolean;
  destinatario_aprovou: boolean;
  created_at: string;
}

function TrocasPage() {
  const { user, profile } = useAuth();
  const [colegas, setColegas] = useState<Profile[]>([]);
  const [trocas, setTrocas] = useState<Troca[]>([]);
  const [nomeMap, setNomeMap] = useState<Map<string, string>>(new Map());
  const [open, setOpen] = useState(false);
  const [destId, setDestId] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    if (!user) return;
    const [{ data: ps }, { data: ts }] = await Promise.all([
      supabase.from("profiles").select("id, nome, folga_fixa_semana").eq("ativo", true).order("nome"),
      supabase.from("trocas_folga").select("*").or(`solicitante_id.eq.${user.id},destinatario_id.eq.${user.id}`).order("created_at", { ascending: false }),
    ]);
    const all = (ps ?? []) as Profile[];
    setColegas(all.filter((p) => p.id !== user.id && p.folga_fixa_semana !== null));
    setNomeMap(new Map(all.map((p) => [p.id, p.nome])));
    setTrocas((ts ?? []) as Troca[]);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel(`trocas-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trocas_folga" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const solicitar = async () => {
    if (!user || !profile) return;
    if (profile.folga_fixa_semana == null) return toast.error("Você não tem folga fixa definida");
    if (!destId) return toast.error("Escolha um colega");
    const dest = colegas.find((c) => c.id === destId);
    if (!dest || dest.folga_fixa_semana == null) return toast.error("Colega sem folga fixa");
    const { error } = await supabase.from("trocas_folga").insert({
      solicitante_id: user.id,
      destinatario_id: destId,
      dia_original: profile.folga_fixa_semana,
      dia_solicitado: dest.folga_fixa_semana,
      mensagem: msg || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Solicitação enviada");
    setOpen(false); setDestId(""); setMsg("");
  };

  const aprovar = async (t: Troca) => {
    const field = user!.id === t.destinatario_id ? "destinatario_aprovou" : "solicitante_aprovou";
    const update = field === "destinatario_aprovou"
      ? { destinatario_aprovou: true }
      : { solicitante_aprovou: true };
    const { error } = await supabase.from("trocas_folga").update(update).eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Troca aprovada");
  };

  const recusar = async (t: Troca) => {
    const { error } = await supabase.from("trocas_folga").update({ status: "recusada" }).eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Troca recusada");
  };

  const cancelar = async (t: Troca) => {
    const { error } = await supabase.from("trocas_folga").update({ status: "cancelada" }).eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Troca cancelada");
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      pendente: "bg-pending/20 text-pending-foreground border-pending/40",
      aprovada: "bg-available/20 text-available border-available/40",
      recusada: "bg-unavailable/20 text-unavailable border-unavailable/40",
      cancelada: "bg-muted text-muted-foreground border-border",
    };
    return <Badge className={`${map[s] ?? ""} border`}>{s}</Badge>;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <ArrowLeftRight className="size-6 text-primary" /> Trocas de Folga
          </h1>
          <p className="text-muted-foreground mt-1">
            Sua folga fixa: <b>{profile?.folga_fixa_semana != null ? DIAS[profile.folga_fixa_semana] : "—"}</b>
          </p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={profile?.folga_fixa_semana == null}>
          <Plus className="size-4" /> Nova troca
        </Button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-xl">
        {trocas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma troca registrada.</p>
        ) : (
          <ul className="divide-y divide-border">
            {trocas.map((t) => {
              const isSol = t.solicitante_id === user?.id;
              const meAprovei = isSol ? t.solicitante_aprovou : t.destinatario_aprovou;
              const outro = isSol ? t.destinatario_id : t.solicitante_id;
              return (
                <li key={t.id} className="py-3 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      {isSol ? "Você" : nomeMap.get(t.solicitante_id) ?? "?"} ↔ {isSol ? nomeMap.get(t.destinatario_id) ?? "?" : "Você"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {DIAS[t.dia_original]} ⇄ {DIAS[t.dia_solicitado]}
                      {t.mensagem && ` — "${t.mensagem}"`}
                    </div>
                  </div>
                  {statusBadge(t.status)}
                  {t.status === "pendente" && (
                    <div className="flex gap-2">
                      {!meAprovei && (
                        <Button size="sm" variant="default" onClick={() => aprovar(t)}>
                          <Check className="size-4" /> Aprovar
                        </Button>
                      )}
                      {isSol ? (
                        <Button size="sm" variant="outline" onClick={() => cancelar(t)}>Cancelar</Button>
                      ) : (
                        <Button size="sm" variant="destructive" onClick={() => recusar(t)}>
                          <XIcon className="size-4" /> Recusar
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar troca de folga</DialogTitle>
            <DialogDescription>
              Sua folga atual: <b>{profile?.folga_fixa_semana != null ? DIAS[profile.folga_fixa_semana] : "—"}</b>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Trocar com:</Label>
              <select
                className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
                value={destId}
                onChange={(e) => setDestId(e.target.value)}
              >
                <option value="">Selecione um colega...</option>
                {colegas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} — folga {DIAS[c.folga_fixa_semana!]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Mensagem (opcional)</Label>
              <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} placeholder="Motivo da troca..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={solicitar}>Enviar solicitação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
