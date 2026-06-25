import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cake, Loader2, Building2, MessageCircle, Briefcase } from "lucide-react";
import { formatBR } from "@/lib/folga-rules";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Colaborador {
  id: string;
  nome: string;
  data_nascimento: string | null;
  data_admissao: string | null;
  whatsapp: string | null;
  unidade: string;
}

interface EventoAniversario {
  colaboradorId: string;
  nome: string;
  unidade: string;
  whatsapp: string | null;
  tipo: "nascimento" | "tempo_casa";
  data_evento: string; // data do evento no formato YYYY-MM-DD
  dias_para: number;
  descricao: string; // "Completa X anos" ou "X anos de empresa"
}

interface AniversariantesWidgetProps {
  limit?: number;
  showSendButton?: boolean;
}

export function AniversariantesWidget({ limit = 10, showSendButton = true }: AniversariantesWidgetProps) {
  const [eventos, setEventos] = useState<EventoAniversario[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgDialog, setMsgDialog] = useState<{
    open: boolean;
    colaborador: EventoAniversario | null;
    mensagem: string;
  }>({
    open: false,
    colaborador: null,
    mensagem: "",
  });
  const [sending, setSending] = useState(false);

  // Função para calcular próximo evento (nascimento ou admissão) nos próximos 30 dias
  const calcularProximoEvento = (dataBase: string, hoje: Date): { data: Date; diffDias: number; idade: number } | null => {
    const data = new Date(dataBase + "T00:00:00");
    const anoAtual = hoje.getFullYear();

    let proximo = new Date(anoAtual, data.getMonth(), data.getDate());
    if (proximo < hoje) {
      proximo = new Date(anoAtual + 1, data.getMonth(), data.getDate());
    }

    const diffTime = proximo.getTime() - hoje.getTime();
    const diffDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDias >= 0 && diffDias <= 30) {
      // Calcular idade/anos de empresa
      const anos = proximo.getFullYear() - data.getFullYear();
      return { data: proximo, diffDias, idade: anos };
    }
    return null;
  };

  const loadAniversariantes = async () => {
    setLoading(true);
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const anoAtual = hoje.getFullYear();

      const { data: profiles, error } = await supabase
        .from("profiles")
        .select(`
          id,
          nome,
          data_nascimento,
          data_admissao,
          whatsapp,
          unidade_id,
          unidades!unidade_id (nome)
        `)
        .eq("ativo", true);

      if (error) throw error;

      // Mapear unidades
      const unidadeMap = new Map();
      profiles?.forEach(p => {
        let unidadeNome = null;
        if (p.unidades && typeof p.unidades === 'object' && !Array.isArray(p.unidades)) {
          unidadeNome = (p.unidades as any).nome;
        } else if (Array.isArray(p.unidades) && p.unidades.length > 0) {
          unidadeNome = p.unidades[0]?.nome;
        }
        if (unidadeNome) {
          unidadeMap.set(p.unidade_id, unidadeNome);
        }
      });

      const eventosList: EventoAniversario[] = [];

      profiles?.forEach(p => {
        const colaborador: Colaborador = {
          id: p.id,
          nome: p.nome,
          data_nascimento: p.data_nascimento,
          data_admissao: p.data_admissao,
          whatsapp: p.whatsapp || null,
          unidade: p.unidade_id ? unidadeMap.get(p.unidade_id) || "—" : "—",
        };

        // 🔥 Aniversário de Nascimento
        if (colaborador.data_nascimento) {
          const nasc = calcularProximoEvento(colaborador.data_nascimento, hoje);
          if (nasc) {
            eventosList.push({
              colaboradorId: colaborador.id,
              nome: colaborador.nome,
              unidade: colaborador.unidade,
              whatsapp: colaborador.whatsapp,
              tipo: "nascimento",
              data_evento: nasc.data.toISOString().split("T")[0],
              dias_para: nasc.diffDias,
              descricao: `Completa ${nasc.idade} anos`,
            });
          }
        }

        // 🔥 Aniversário de Tempo de Casa (admissão)
        if (colaborador.data_admissao) {
          const adm = calcularProximoEvento(colaborador.data_admissao, hoje);
          if (adm) {
            eventosList.push({
              colaboradorId: colaborador.id,
              nome: colaborador.nome,
              unidade: colaborador.unidade,
              whatsapp: colaborador.whatsapp,
              tipo: "tempo_casa",
              data_evento: adm.data.toISOString().split("T")[0],
              dias_para: adm.diffDias,
              descricao: `${adm.idade} anos de empresa`,
            });
          }
        }
      });

      // Ordenar por dias para o evento
      eventosList.sort((a, b) => a.dias_para - b.dias_para);
      setEventos(eventosList.slice(0, limit));
    } catch (error) {
      console.error("Erro ao carregar aniversariantes:", error);
      toast.error("Erro ao carregar aniversariantes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAniversariantes();
  }, []);

  const openMsgDialog = (evento: EventoAniversario) => {
    const isNascimento = evento.tipo === "nascimento";
    const emoji = isNascimento ? "🎉 Feliz Aniversário" : "🎊 Parabéns pelo Tempo de Casa";
    const mensagemPadrao = `${emoji}, ${evento.nome.split(' ')[0]}! 🎂

A equipe Pakerê deseja a você um dia especial, cheio de alegria e realizações. ${
  isNascimento
    ? "Que este novo ano de vida seja repleto de sucesso e felicidade!"
    : "Agradecemos por fazer parte da nossa história e por todos os anos de dedicação!"
}

Atenciosamente,
Equipe Pakerê`;

    setMsgDialog({
      open: true,
      colaborador: evento,
      mensagem: mensagemPadrao,
    });
  };

  const sendWhatsAppMessage = async () => {
    if (!msgDialog.colaborador) return;
    if (!msgDialog.colaborador.whatsapp) {
      toast.error("Colaborador não possui WhatsApp cadastrado.");
      return;
    }

    setSending(true);
    try {
      const numero = msgDialog.colaborador.whatsapp.replace(/\D/g, '');
      if (numero.length < 10) {
        toast.error("Número de WhatsApp inválido.");
        return;
      }

      const mensagemEncoded = encodeURIComponent(msgDialog.mensagem);
      const url = `https://wa.me/55${numero}?text=${mensagemEncoded}`;
      window.open(url, '_blank');

      toast.success("Mensagem aberta no WhatsApp!");
      setMsgDialog({ open: false, colaborador: null, mensagem: "" });
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast.error("Erro ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Cake className="size-5 text-pink-500" />
            Aniversariantes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (eventos.length === 0) {
    return (
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Cake className="size-5 text-pink-500" />
            Aniversariantes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-6">
            Nenhum aniversário de nascimento ou tempo de casa nos próximos 30 dias. 🎉
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border shadow-sm flex flex-col">
        <CardHeader className="pb-3 shrink-0">
          <CardTitle className="text-lg flex items-center gap-2">
            <Cake className="size-5 text-pink-500" />
            Aniversariantes dos Próximos 30 Dias
            <Badge className="ml-2 bg-pink-100 text-pink-700 border-pink-200">
              {eventos.length}
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Aniversários de nascimento e tempo de casa
          </p>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto max-h-[400px] pr-1">
          <div className="space-y-3">
            {eventos.map((evento) => {
              const isNascimento = evento.tipo === "nascimento";
              const badgeColor = isNascimento
                ? "bg-pink-100 text-pink-700 border-pink-200"
                : "bg-blue-100 text-blue-700 border-blue-200";
              const icon = isNascimento ? <Cake className="size-3" /> : <Briefcase className="size-3" />;
              const hoje = new Date();
              hoje.setHours(0, 0, 0, 0);
              const isHoje = evento.dias_para === 0;

              return (
                <div
                  key={`${evento.colaboradorId}-${evento.tipo}`}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow gap-2"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`size-10 rounded-full flex items-center justify-center font-bold shrink-0 ${isNascimento ? "bg-pink-200 text-pink-700" : "bg-blue-200 text-blue-700"}`}>
                      {evento.dias_para === 0 ? "🎉" : evento.dias_para}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{evento.nome}</div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge variant="outline" className={`text-xs ${badgeColor}`}>
                          {icon}
                          {isNascimento ? " Nascimento" : " Tempo de Casa"}
                          {isHoje && <span className="ml-1 font-bold">🎉 Hoje!</span>}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{evento.descricao}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Building2 className="size-3" />
                          {evento.unidade}
                        </span>
                      </div>
                    </div>
                  </div>
                  {showSendButton && (
                    <Button
                      variant="outline"
                      size="sm"
                      className={`shrink-0 gap-1.5 ${isNascimento ? "text-pink-600 border-pink-200 hover:bg-pink-50" : "text-blue-600 border-blue-200 hover:bg-blue-50"}`}
                      onClick={() => openMsgDialog(evento)}
                      disabled={!evento.whatsapp}
                      title={evento.whatsapp ? "Enviar mensagem" : "Sem WhatsApp cadastrado"}
                    >
                      <MessageCircle className="size-4" />
                      <span className="hidden sm:inline text-xs">Mensagem</span>
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={msgDialog.open} onOpenChange={(open) => !open && setMsgDialog({ open: false, colaborador: null, mensagem: "" })}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="size-5 text-primary" />
              {msgDialog.colaborador?.tipo === "nascimento" ? "Feliz Aniversário" : "Parabéns pelo Tempo de Casa"} - {msgDialog.colaborador?.nome}
            </DialogTitle>
            <DialogDescription>
              A mensagem será aberta no WhatsApp Web. Verifique o número antes de enviar.
              <br />
              <span className="text-xs text-muted-foreground">
                WhatsApp: {msgDialog.colaborador?.whatsapp || "Não cadastrado"}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mensagem">Mensagem</Label>
              <Textarea
                id="mensagem"
                value={msgDialog.mensagem}
                onChange={(e) => setMsgDialog({ ...msgDialog, mensagem: e.target.value })}
                rows={8}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setMsgDialog({ open: false, colaborador: null, mensagem: "" })} disabled={sending}>
              Cancelar
            </Button>
            <Button
              onClick={sendWhatsAppMessage}
              disabled={sending || !msgDialog.colaborador?.whatsapp}
              className="gap-2"
            >
              {sending ? "Enviando..." : <><MessageCircle className="size-4" /> Enviar via WhatsApp</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}