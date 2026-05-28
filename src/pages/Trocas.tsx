import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeftRight, Check, X as XIcon, Info, Clock } from "lucide-react";
import { formatBR, parseYMD } from "@/lib/folga-rules";

interface Troca {
  id: string;
  solicitante_id: string;
  destinatario_id: string;
  data_destinatario: string;
  data_solicitante: string | null;
  mensagem: string | null;
  status: string;
  created_at: string;
}

export default function TrocasPage() {
  const { user } = useAuth();
  const [trocas, setTrocas] = useState<Troca[]>([]);
  const [nomeMap, setNomeMap] = useState<Map<string, string>>(new Map());

  const load = async () => {
    if (!user) return;
    const [{ data: ts }, { data: ps }] = await Promise.all([
      supabase.from("trocas_folga").select("*").or(`solicitante_id.eq.${user.id},destinatario_id.eq.${user.id}`).order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, nome"),
    ]);
    setTrocas((ts ?? []) as Troca[]);
    setNomeMap(new Map((ps ?? []).map((p) => [p.id, p.nome])));
  };

  useEffect(() => {
    load();
    const ch = supabase.channel(`trocas-realtime-${user?.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trocas_folga" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const processarTroca = async (t: Troca, aprovar: boolean) => {
    if (!aprovar) {
      await supabase.from("trocas_folga").update({ status: "recusada", respondido_em: new Date().toISOString() }).eq("id", t.id);
      toast.success("Troca recusada");
      return;
    }

    // Lógica de Troca Automática
    const { error: updateErr } = await supabase.from("trocas_folga").update({ status: "aprovada", respondido_em: new Date().toISOString() }).eq("id", t.id);
    if (updateErr) return toast.error(updateErr.message);

    // 1. O solicitante ganha a folga na data do destinatário
    await supabase.from("folgas").insert({
      user_id: t.solicitante_id,
      data: t.data_destinatario,
      mes: t.data_destinatario.substring(0, 7),
      tipo: "troca",
      criado_por: user?.id
    });

    // 2. O destinatário trabalha na sua data original (cancelamento temporário)
    await supabase.from("folgas_canceladas").insert({
      user_id: t.destinatario_id,
      data: t.data_destinatario,
      motivo: "Troca de folga aprovada"
    });

    toast.success("Troca realizada com sucesso! O calendário foi atualizado.");
  };

  const cancelar = async (id: string) => {
    await supabase.from("trocas_folga").update({ status: "cancelada" }).eq("id", id);
    toast.success("Solicitação cancelada");
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <ArrowLeftRight className="size-6 text-primary" /> Minhas Trocas
        </h1>
        <p className="text-muted-foreground mt-1">Gerencie suas solicitações de permuta temporária.</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3 text-sm text-blue-800">
        <Info className="size-5 shrink-0 mt-0.5" />
        <p>As trocas são <b>temporárias</b> e válidas apenas para as datas selecionadas. Sua escala fixa não será alterada.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        {trocas.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">Nenhuma troca registrada.</div>
        ) : (
          <ul className="divide-y divide-border">
            {trocas.map((t) => {
              const isSol = t.solicitante_id === user?.id;
              const outroNome = nomeMap.get(isSol ? t.destinatario_id : t.solicitante_id) ?? "Colega";
              
              return (
                <li key={t.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={isSol ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"}>
                        {isSol ? "Você solicitou" : "Solicitaram a você"}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="size-3" /> {new Date(t.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div className="font-bold text-lg">
                      {isSol ? `Trocar com ${outroNome}` : `${outroNome} quer trocar`}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Data da folga: <b className="text-foreground">{formatBR(parseYMD(t.data_destinatario))}</b>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge className={cn(
                      "border",
                      t.status === 'pendente' ? "bg-pending/20 text-pending-foreground border-pending/40" :
                      t.status === 'aprovada' ? "bg-available/20 text-available border-available/40" :
                      "bg-muted text-muted-foreground border-border"
                    )}>
                      {t.status}
                    </Badge>

                    {t.status === 'pendente' && (
                      <div className="flex gap-2">
                        {isSol ? (
                          <Button variant="outline" size="sm" onClick={() => cancelar(t.id)}>Cancelar</Button>
                        ) : (
                          <>
                            <Button variant="destructive" size="sm" onClick={() => processarTroca(t, false)}><XIcon className="size-4 mr-1" /> Recusar</Button>
                            <Button size="sm" onClick={() => processarTroca(t, true)}><Check className="size-4 mr-1" /> Aceitar</Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}