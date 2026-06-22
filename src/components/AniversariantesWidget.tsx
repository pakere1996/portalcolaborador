import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cake, Loader2, Building2, MessageCircle } from "lucide-react";
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

interface Aniversariante {
  id: string;
  nome: string;
  data_nascimento: string;
  idade: number;
  unidade: string;
  whatsapp: string | null;
  dias_para_aniversario: number;
}

interface AniversariantesWidgetProps {
  limit?: number;
  showSendButton?: boolean;
}

export function AniversariantesWidget({ limit = 10, showSendButton = true }: AniversariantesWidgetProps) {
  const [aniversariantes, setAniversariantes] = useState<Aniversariante[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgDialog, setMsgDialog] = useState<{
    open: boolean;
    colaborador: Aniversariante | null;
    mensagem: string;
  }>({
    open: false,
    colaborador: null,
    mensagem: "",
  });
  const [sending, setSending] = useState(false);

  const loadAniversariantes = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const anoAtual = now.getFullYear();
      const hoje = new Date(anoAtual, now.getMonth(), now.getDate());
      const limite = new Date(hoje);
      limite.setDate(limite.getDate() + 30);

      const { data: profiles, error } = await supabase
        .from("profiles")
        .select(`
          id,
          nome,
          data_nascimento,
          whatsapp,
          unidade_id,
          unidades!unidade_id (nome)
        `)
        .eq("ativo", true)
        .not("data_nascimento", "is", null);

      if (error) throw error;

      const unidadeMap = new Map();
      profiles?.forEach(p => {
        if (p.unidades) {
          unidadeMap.set(p.unidade_id, p.unidades.nome);
        }
      });

      const aniversariantesList = (profiles ?? [])
        .map(p => {
          const nasc = new Date(p.data_nascimento + "T00:00:00");
          let proximoAniversario = new Date(anoAtual, nasc.getMonth(), nasc.getDate());
          if (proximoAniversario < hoje) {
            proximoAniversario = new Date(anoAtual + 1, nasc.getMonth(), nasc.getDate());
          }
          const idade = proximoAniversario.getFullYear() - nasc.getFullYear();
          const diffTime = proximoAniversario.getTime() - hoje.getTime();
          const diffDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return {
            id: p.id,
            nome: p.nome,
            data_nascimento: p.data_nascimento,
            idade,
            unidade: p.unidade_id ? unidadeMap.get(p.unidade_id) || "—" : "—",
            whatsapp: p.whatsapp || null,
            dias_para_aniversario: diffDias,
          };
        })
        .filter(item => item.dias_para_aniversario >= 0 && item.dias_para_aniversario <= 30)
        .sort((a, b) => a.dias_para_aniversario - b.dias_para_aniversario)
        .slice(0, limit);

      setAniversariantes(aniversariantesList);
    } catch (error) {
      console.error("Erro ao carregar aniversariantes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAniversariantes();
  }, []);

  const openMsgDialog = (colaborador: Aniversariante) => {
    const mensagemPadrao = `🎉 Feliz Aniversário, ${colaborador.nome.split(' ')[0]}! 🎂

A equipe Pakerê deseja a você um dia especial, cheio de alegria e realizações. Que este novo ano de vida seja repleto de sucesso e felicidade!

Atenciosamente,
Equipe Pakerê`;

    setMsgDialog({
      open: true,
      colaborador,
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

  if (aniversariantes.length === 0) {
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
            Nenhum aniversariante nos próximos 30 dias. 🎉
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
              {aniversariantes.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto max-h-[400px] pr-1">
          <div className="space-y-3">
            {aniversariantes.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 bg-pink-50 rounded-lg border border-pink-100 shadow-sm gap-2"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="size-10 rounded-full bg-pink-200 flex items-center justify-center text-pink-700 font-bold shrink-0">
                    {new Date(p.data_nascimento + "T00:00:00").getDate()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{p.nome}</div>
                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span>Completa {p.idade} anos</span>
                      <span className="flex items-center gap-0.5">
                        <Building2 className="size-3" />
                        {p.unidade}
                      </span>
                    </div>
                  </div>
                </div>
                {showSendButton && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5 text-pink-600 border-pink-200 hover:bg-pink-50 hover:text-pink-700"
                    onClick={() => openMsgDialog(p)}
                    disabled={!p.whatsapp}
                    title={p.whatsapp ? "Enviar mensagem de aniversário" : "Sem WhatsApp cadastrado"}
                  >
                    <MessageCircle className="size-4" />
                    <span className="hidden sm:inline text-xs">Mensagem</span>
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modal de envio de mensagem */}
      <Dialog open={msgDialog.open} onOpenChange={(open) => !open && setMsgDialog({ open: false, colaborador: null, mensagem: "" })}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="size-5 text-primary" />
              Enviar mensagem para {msgDialog.colaborador?.nome}
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