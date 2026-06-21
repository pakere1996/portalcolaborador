import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeftRight, Check, X as XIcon, Info, Clock, User, MessageSquare, Loader2 } from "lucide-react";
import { formatBR, parseYMD } from "@/lib/folga-rules";
import { cn } from "@/lib/utils";
import { adminApi } from "@/lib/admin-api";

interface Troca {
  id: string;
  solicitante_id: string;
  destinatario_id: string | null;
  data_destinatario: string;
  mensagem: string | null;
  status: string;
  created_at: string;
  respondido_em: string | null;
}

export default function TrocasPage() {
  const { user } = useAuth();
  const [trocas, setTrocas] = useState<Troca[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [myFolgas, setMyFolgas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Buscar minhas folgas
      const { data: f } = await supabase.from("folgas").select("data").eq("user_id", user.id);
      const folgaDates = (f ?? []).map(x => x.data);
      setMyFolgas(folgaDates);

      // Buscar todas as trocas onde estou envolvido (como solicitante ou destinatário)
      const { data: trocasData, error } = await supabase
        .from("trocas_folga")
        .select("*")
        .or(`solicitante_id.eq.${user.id},destinatario_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Buscar nomes dos perfis envolvidos
      const userIds = new Set<string>();
      (trocasData ?? []).forEach((t: Troca) => {
        if (t.solicitante_id) userIds.add(t.solicitante_id);
        if (t.destinatario_id) userIds.add(t.destinatario_id);
      });

      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", Array.from(userIds));
        const nomeMap: Record<string, string> = {};
        (profiles ?? []).forEach(p => { nomeMap[p.id] = p.nome; });
        setNomes(nomeMap);
      }

      setTrocas(trocasData ?? []);
    } catch (error) {
      console.error("Erro ao carregar trocas:", error);
      toast.error("Erro ao carregar dados das trocas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`trocas-realtime-${user?.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trocas_folga" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const processarTroca = async (t: Troca, aprovar: boolean) => {
    if (!user) return;

    if (!aprovar) {
      toast.info("Solicitação ignorada");
      return;
    }

    setProcessingId(t.id);
    try {
      await adminApi.acceptSwap(t.id);
      toast.success("Troca realizada com sucesso!");
      load();
    } catch (e) {
      toast.error("Não foi possível realizar a troca", { description: (e as Error).message });
    } finally {
      setProcessingId(null);
    }
  };

  const cancelar = async (id: string) => {
    const { error } = await supabase.from("trocas_folga").update({ status: "cancelada" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Solicitação cancelada");
    load();
  };

  const getNome = (id: string) => nomes[id] || "Colaborador";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <ArrowLeftRight className="size-6 text-primary" /> Minhas Trocas
        </h1>
        <p className="text-muted-foreground mt-1">
          Solicite ou responda trocas de folga com outros colaboradores.
        </p>
      </div>

      {/* Mensagem atualizada – não mais anônima */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3 text-sm text-blue-800">
        <Info className="size-5 shrink-0 mt-0.5" />
        <p>
          As trocas são feitas diretamente entre colaboradores. Você vê quem solicitou e para quem,
          e pode aceitar ou recusar. <b>Lembre-se:</b> você só pode trocar com colaboradores da sua unidade.
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="size-8 animate-spin text-primary" />
            Carregando trocas...
          </div>
        ) : trocas.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            Nenhuma troca registrada ou disponível.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {trocas.map((t) => {
              const isSolicitante = t.solicitante_id === user?.id;
              const isDestinatario = t.destinatario_id === user?.id;
              const outroId = isSolicitante ? t.destinatario_id : t.solicitante_id;
              const outroNome = outroId ? getNome(outroId) : "—";
              const isProcessing = processingId === t.id;
              const isPendente = t.status === "pendente";

              return (
                <li key={t.id} className="p-6 flex flex-col gap-4 hover:bg-muted/10 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn(
                          isSolicitante ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600",
                          "border-current/20"
                        )}>
                          {isSolicitante ? "Você solicitou" : "Solicitaram para você"}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" /> {new Date(t.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <div className="font-bold text-lg flex items-center gap-2">
                        <User className="size-4 text-muted-foreground" />
                        {isSolicitante ? (
                          <>Para: <span className="text-primary">{outroNome}</span></>
                        ) : (
                          <>De: <span className="text-primary">{outroNome}</span></>
                        )}
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

                      {isPendente && (
                        <div className="flex gap-2">
                          {isSolicitante ? (
                            <Button variant="outline" size="sm" onClick={() => cancelar(t.id)}>Cancelar</Button>
                          ) : (
                            // Destinatário: pode aceitar ou recusar
                            <>
                              <Button variant="ghost" size="sm" onClick={() => processarTroca(t, false)} disabled={isProcessing}>
                                Ignorar
                              </Button>
                              <Button size="sm" onClick={() => processarTroca(t, true)} disabled={isProcessing}>
                                {isProcessing ? <Loader2 className="size-4 animate-spin mr-1" /> : <Check className="size-4 mr-1" />}
                                Aceitar Troca
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {t.mensagem && (
                    <div className="bg-muted/30 p-3 rounded-xl border border-border/50 flex items-start gap-2">
                      <MessageSquare className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="text-xs text-muted-foreground">
                        <span className="font-bold uppercase text-[9px] block mb-0.5">Motivo informado:</span>
                        "{t.mensagem}"
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}