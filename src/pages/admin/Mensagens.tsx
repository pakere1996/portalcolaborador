"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send, Users, User, Loader2, CheckCircle, XCircle } from "lucide-react";
import { FavoritarBotao } from "@/components/FavoritarBotao";
import { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles"> & { unidade_nome?: string };

export default function MensagensAdmin() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [unidades, setUnidades] = useState<{ id: string; nome: string }[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);

  // Formulário
  const [destinatario, setDestinatario] = useState<"all" | "unidade" | "colaborador">("all");
  const [unidadeId, setUnidadeId] = useState<string>("none");
  const [colaboradorId, setColaboradorId] = useState<string>("none");
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      // Carregar perfis ativos
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, nome, unidade_id, cargo")
        .eq("ativo", true)
        .order("nome");

      // Carregar unidades
      const { data: unidadesData } = await supabase
        .from("unidades")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");

      // Carregar histórico de mensagens enviadas
      const { data: historicoData } = await supabase
        .from("mensagens_enviadas")
        .select(`
          *,
          colaborador:colaborador_id(id, nome),
          mensagem:mensagem_id(id, titulo, mensagem, created_at)
        `)
        .order("enviado_em", { ascending: false })
        .limit(50);

      setProfiles(profilesData || []);
      setUnidades(unidadesData || []);
      setHistorico(historicoData || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const enviarMensagem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !mensagem.trim()) {
      toast.error("Preencha título e mensagem");
      return;
    }

    setSending(true);
    try {
      let destinatarios: string[] = [];

      if (destinatario === "all") {
        // Todos os colaboradores ativos
        destinatarios = profiles.map(p => p.id);
      } else if (destinatario === "unidade") {
        if (unidadeId === "none") {
          toast.error("Selecione uma unidade");
          setSending(false);
          return;
        }
        destinatarios = profiles.filter(p => p.unidade_id === unidadeId).map(p => p.id);
        if (destinatarios.length === 0) {
          toast.error("Nenhum colaborador nesta unidade");
          setSending(false);
          return;
        }
      } else if (destinatario === "colaborador") {
        if (colaboradorId === "none") {
          toast.error("Selecione um colaborador");
          setSending(false);
          return;
        }
        destinatarios = [colaboradorId];
      }

      if (destinatarios.length === 0) {
        toast.error("Nenhum destinatário selecionado");
        setSending(false);
        return;
      }

      // Inserir mensagem
      const { data: msgData, error: msgError } = await supabase
        .from("mensagens")
        .insert({
          titulo: titulo.trim(),
          mensagem: mensagem.trim(),
          tipo: "comunicado",
          created_by: user?.id,
        })
        .select("id")
        .single();

      if (msgError) throw msgError;

      // Inserir mensagens enviadas para cada destinatário
      const inserts = destinatarios.map(destinatario_id => ({
        mensagem_id: msgData.id,
        colaborador_id: destinatario_id,
        enviado_por: user?.id,
        status: "enviado",
        enviado_em: new Date().toISOString(),
      }));

      const { error: insertError } = await supabase
        .from("mensagens_enviadas")
        .insert(inserts);

      if (insertError) throw insertError;

      toast.success(`Mensagem enviada para ${destinatarios.length} colaborador(es)`);
      setTitulo("");
      setMensagem("");
      setDestinatario("all");
      setUnidadeId("none");
      setColaboradorId("none");
      loadData();
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast.error("Erro ao enviar mensagem", { description: (error as Error).message });
    } finally {
      setSending(false);
    }
  };

  const getDestinatarioLabel = (destinatario: string) => {
    switch (destinatario) {
      case "all": return "Todos";
      case "unidade": return "Unidade";
      case "colaborador": return "Colaborador";
      default: return destinatario;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Send className="size-6 text-primary" /> Comunicados
          </h1>
          <p className="text-muted-foreground mt-1">
            Envie comunicados para colaboradores específicos, por unidade ou para todos.
          </p>
        </div>
        <FavoritarBotao rota="/admin/mensagens" label="Comunicados" icone="Send" />
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle>Nova Mensagem</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={enviarMensagem} className="space-y-4">
            <div className="space-y-2">
              <Label>Destinatário *</Label>
              <Select
                value={destinatario}
                onValueChange={(value: "all" | "unidade" | "colaborador") => setDestinatario(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o destinatário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os colaboradores</SelectItem>
                  <SelectItem value="unidade">Por unidade</SelectItem>
                  <SelectItem value="colaborador">Colaborador específico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {destinatario === "unidade" && (
              <div className="space-y-2">
                <Label>Unidade *</Label>
                <Select value={unidadeId} onValueChange={setUnidadeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione uma unidade</SelectItem>
                    {unidades.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {destinatario === "colaborador" && (
              <div className="space-y-2">
                <Label>Colaborador *</Label>
                <Select value={colaboradorId} onValueChange={setColaboradorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o colaborador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione um colaborador</SelectItem>
                    {profiles.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nome} {p.cargo ? `(${p.cargo})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Comunicado importante"
              />
            </div>

            <div className="space-y-2">
              <Label>Mensagem *</Label>
              <Textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Digite a mensagem..."
                rows={6}
              />
            </div>

            <Button type="submit" disabled={sending} className="w-full">
              {sending ? <Loader2 className="size-4 animate-spin mr-2" /> : <Send className="size-4 mr-2" />}
              {sending ? "Enviando..." : "Enviar Mensagem"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle>Histórico de Mensagens</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : historico.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Nenhuma mensagem enviada ainda.
            </div>
          ) : (
            <div className="space-y-4">
              {historico.map((item) => (
                <div key={item.id} className="p-4 border border-border rounded-lg hover:bg-muted/10 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">{item.mensagem?.titulo || "Sem título"}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {item.mensagem?.mensagem || ""}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {item.colaborador ? (
                        <span className="flex items-center gap-1">
                          <User className="size-3" /> {item.colaborador.nome}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Users className="size-3" /> Múltiplos
                        </span>
                      )}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>{item.status === "enviado" ? "✅ Enviado" : item.status}</span>
                    <span>• {new Date(item.enviado_em).toLocaleString("pt-BR")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}