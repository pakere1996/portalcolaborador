import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeftRight, Check, X as XIcon, Info, Clock, User } from "lucide-react";
import { formatBR, parseYMD } from "@/lib/folga-rules";
import { cn } from "@/lib/utils";

interface Troca {
  id: string;
  solicitante_id: string;
  destinatario_id: string | null;
  data_destinatario: string;
  data_solicitante: string | null;
  mensagem: string | null;
  status: string;
  created_at: string;
}

export default function TrocasPage() {
  const { user } = useAuth();
  const [trocas, setTrocas] = useState<Troca[]>([]);
  const [myFolgas, setMyFolgas] = useState<string[]>([]);

  const load = async () => {
    if (!user) return;
    
    // 1. Carregar minhas folgas para saber quais trocas públicas posso aceitar
    const { data: f } = await supabase.from("folgas").select("data").eq("user_id", user.id);
    const { data: p } = await supabase.from("profiles").select("folga_fixa_semana").eq("id", user.id).single();
    
    const folgaDates = (f ?? []).map(x => x.data);
    setMyFolgas(folgaDates);

    // 2. Carregar trocas: minhas solicitações OU solicitações públicas para datas que eu folgo
    const { data: ts } = await supabase
      .from("trocas_folga")
      .select("*")
      .or(`solicitante_id.eq.${user.id},destinatario_id.eq.${user.id},destinatario_id.is.null`)
      .order("created_at", { ascending: false });

    // Filtrar trocas públicas: apenas se a data_destinatario for uma das minhas folgas
    const filtered = (ts ?? []).filter(t => {
      if (t.solicitante_id === user.id) return true;
      if (t.destinatario_id === user.id) return true;
      if (t.destinatario_id === null && folgaDates.includes(t.data_destinatario)) return true;
      return false;
    });

    setTrocas(filtered as Troca[]);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel(`trocas-realtime-${user?.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trocas_folga" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const processarTroca = async (t: Troca, aprovar: boolean) => {
    if (!user) return;
    
    if (!aprovar) {
      // Se for uma troca pública, apenas ignora (não remove para os outros)
      // Se for direcionada, recusa
      if (t.destinatario_id) {
        await supabase.from("trocas_folga").update({ status: "recusada", respondido_em: new Date().toISOString() }).eq("id", t.id);
      }
      toast.success("Solicitação ignorada");
      load();
      return;
    }

    // Lógica de Troca Automática
    const { error: updateErr } = await supabase.from("trocas_folga").update({ 
      status: "aprovada", 
      destinatario_id: user.id, // Assume a troca
      respondido_em: new Date().toISOString() 
    }).eq("id", t.id);
    
    if (updateErr) return toast.error(updateErr.message);

    // 1. O solicitante ganha a folga na data do destinatário
    await supabase.from("folgas").insert({
      user_id: t.solicitante_id,
      data: t.data_destinatario,
      mes: t.data_destinatario.substring(0, 7),
      tipo: "troca",
      criado_por: user.id
    });

    // 2. O destinatário (eu) trabalha na sua data original (cancelamento temporário)
    await supabase.from("folgas_canceladas").insert({
      user_id: user.id,
      data: t.data_destinatario,
      motivo: "Troca de folga aprovada"
    });

    toast.success("Troca realizada com sucesso! Seu calendário foi atualizado.");
    load();
  };

  const cancelar = async (id: string) => {
    await supabase.from("trocas_folga").update({ status: "cancelada" }).eq("id", id);
    toast.success("Solicitação cancelada");
    load();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <ArrowLeftRight className="size-6 text-primary" /> Minhas Trocas
        </h1>
        <p className="text-muted-foreground mt-1">Gerencie suas solicitações de permuta anônima.</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3 text-sm text-blue-800">
        <Info className="size-5 shrink-0 mt-0.5" />
        <p>As trocas são <b>anônimas</b>. Você não verá quem solicitou nem quem recebeu até que a troca seja concluída.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        {trocas.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">Nenhuma troca registrada.</div>
        ) : (
          <ul className="divide-y divide-border">
            {trocas.map((t) => {
              const isSol = t.solicitante_id === user?.id;
              const isPublic = t.destinatario_id === null;
              
              return (
                <li key={t.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn(
                        isSol ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600",
                        "border-current/20"
                      )}>
                        {isSol ? "Sua solicitação" : "Solicitação de troca"}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="size-3" /> {new Date(t.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div className="font-bold text-lg flex items-center gap-2">
                      <User className="size-4 text-muted-foreground" />
                      {isSol ? (isPublic ? "Aguardando interessado..." : "Troca em andamento") : "Existe um interessado na sua folga"}
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
                            <Button variant="ghost" size="sm" onClick={() => processarTroca(t, false)}>Ignorar</Button>
                            <Button size="sm" onClick={() => processarTroca(t, true)}><Check className="size-4 mr-1" /> Aceitar Troca</Button>
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