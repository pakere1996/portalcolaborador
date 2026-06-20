"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MessageCircle, Send, Users, Filter, Loader2 } from "lucide-react";

interface Profile {
  id: string;
  nome: string;
  whatsapp: string | null;
  unidade_id: string | null;
  ativo: boolean;
}

interface Unidade {
  id: string;
  nome: string;
}

export default function MensagensPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [filtroUnidade, setFiltroUnidade] = useState("all");
  const [filtroStatus, setFiltroStatus] = useState("all");
  const [mensagem, setMensagem] = useState("");
  const [titulo, setTitulo] = useState("");
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, uRes] = await Promise.all([
        supabase.from("profiles").select("id, nome, whatsapp, unidade_id, ativo").order("nome"),
        supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome"),
      ]);
      setProfiles(pRes.data ?? []);
      setUnidades(uRes.data ?? []);
    } catch (e) {
      toast.error("Erro ao carregar dados", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredProfiles = profiles.filter(p => {
    if (filtroUnidade !== "all" && p.unidade_id !== filtroUnidade) return false;
    if (filtroStatus === "ativo" && !p.ativo) return false;
    if (filtroStatus === "inativo" && p.ativo) return false;
    return true;
  });

  const toggleSelectAll = () => {
    if (selectedProfiles.length === filteredProfiles.filter(p => p.whatsapp).length) {
      setSelectedProfiles([]);
    } else {
      setSelectedProfiles(filteredProfiles.filter(p => p.whatsapp).map(p => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedProfiles(prev =>
      prev.includes(id) ? prev.filter(p => p.id !== id) : [...prev, id]
    );
  };

  const sendMessages = async () => {
    if (selectedProfiles.length === 0) {
      toast.error("Selecione pelo menos um colaborador.");
      return;
    }
    if (!mensagem.trim()) {
      toast.error("Digite uma mensagem.");
      return;
    }

    setSending(true);
    try {
      const selected = profiles.filter(p => selectedProfiles.includes(p.id));
      const comWhatsApp = selected.filter(p => p.whatsapp);
      if (comWhatsApp.length === 0) {
        toast.error("Nenhum dos selecionados possui WhatsApp.");
        return;
      }

      // Abre múltiplas abas (simplificado – em produção seria melhor usar uma API)
      for (const p of comWhatsApp) {
        const numero = p.whatsapp!.replace(/\D/g, '');
        const mensagemEncoded = encodeURIComponent(mensagem);
        // Abre cada uma em uma nova aba (o navegador pode bloquear popups)
        const url = `https://wa.me/55${numero}?text=${mensagemEncoded}`;
        window.open(url, '_blank');
        // Pequeno delay para evitar bloqueio
        await new Promise(r => setTimeout(r, 300));
      }

      toast.success(`Abrindo WhatsApp para ${comWhatsApp.length} colaborador(es).`);
      setSelectedProfiles([]);
      setMensagem("");
      setTitulo("");
    } catch (e) {
      toast.error("Erro ao enviar mensagens", { description: (e as Error).message });
    } finally {
      setSending(false);
    }
  };

  const mensagensPreDefinidas = [
    {
      titulo: "🎉 Feliz Aniversário!",
      mensagem: `🎉 Feliz Aniversário, [NOME]! 🎂

A equipe Pakerê deseja a você um dia especial, cheio de alegria e realizações. Que este novo ano de vida seja repleto de sucesso e felicidade!

Atenciosamente,
Equipe Pakerê`
    },
    {
      titulo: "📢 Aviso Geral",
      mensagem: `📢 Comunicado importante da administração Pakerê:

[MENSAGEM]

Atenciosamente,
Equipe Pakerê`
    },
    {
      titulo: "🗓️ Convocação de Feriado",
      mensagem: `🗓️ Convocação para trabalho em feriado:

Prezado(a) [NOME],

Informamos que haverá expediente no feriado de [DATA]. Sua presença é indispensável.

Agradecemos sua compreensão.

Equipe Pakerê`
    },
    {
      titulo: "📝 Lembrete de Documentos",
      mensagem: `📝 Lembrete: envio de documentos pendentes.

Prezado(a) [NOME],

Informamos que há documentos pendentes em seu cadastro. Favor regularizar o mais breve possível.

Equipe Pakerê`
    }
  ];

  const aplicarModelo = (modelo: typeof mensagensPreDefinidas[0]) => {
    setTitulo(modelo.titulo);
    setMensagem(modelo.mensagem);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <MessageCircle className="size-6 text-primary" /> Disparo de Mensagens
          </h1>
          <p className="text-muted-foreground mt-1">
            Envie mensagens via WhatsApp para colaboradores.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Filtros e lista */}
        <div className="md:col-span-1 space-y-4">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Filter className="size-4 text-primary" /> Filtros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Unidade</Label>
                <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {unidades.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Status</Label>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="ativo">Ativos</SelectItem>
                    <SelectItem value="inativo">Inativos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                  {selectedProfiles.length === filteredProfiles.filter(p => p.whatsapp).length && filteredProfiles.filter(p => p.whatsapp).length > 0
                    ? "Desmarcar todos"
                    : "Selecionar todos"}
                </Button>
                <Badge variant="outline" className="text-xs">
                  {selectedProfiles.length} / {filteredProfiles.filter(p => p.whatsapp).length} com WhatsApp
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm max-h-[400px] overflow-y-auto">
            <CardContent className="p-3 space-y-1">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="size-6 animate-spin mx-auto mb-2" />
                  Carregando...
                </div>
              ) : filteredProfiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Nenhum colaborador encontrado.</div>
              ) : (
                filteredProfiles.map(p => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedProfiles.includes(p.id) ? "bg-primary/10" : "hover:bg-muted/50"
                    } ${!p.whatsapp ? "opacity-50" : ""}`}
                    onClick={() => p.whatsapp && toggleSelect(p.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedProfiles.includes(p.id)}
                        onChange={() => p.whatsapp && toggleSelect(p.id)}
                        disabled={!p.whatsapp}
                        className="size-4 rounded border-border accent-primary shrink-0"
                      />
                      <span className="text-sm truncate">{p.nome}</span>
                    </div>
                    {p.whatsapp ? (
                      <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">✓</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">Sem WhatsApp</Badge>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Área da mensagem */}
        <div className="md:col-span-2 space-y-4">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <MessageCircle className="size-4 text-primary" /> Modelos Rápidos
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {mensagensPreDefinidas.map((m, i) => (
                <Button key={i} variant="outline" size="sm" onClick={() => aplicarModelo(m)} className="text-xs">
                  {m.titulo}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="space-y-4 p-5">
              <div className="space-y-2">
                <Label>Título (opcional)</Label>
                <Input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex: Feliz Aniversário, Aviso..."
                />
              </div>
              <div className="space-y-2">
                <Label>Mensagem *</Label>
                <Textarea
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  rows={10}
                  className="resize-none"
                  placeholder="Digite a mensagem aqui... Use [NOME] para personalizar."
                />
                <p className="text-xs text-muted-foreground">
                  Use <span className="font-mono bg-muted px-1 rounded">[NOME]</span> para substituir pelo nome do colaborador.
                </p>
              </div>
              <Button
                onClick={sendMessages}
                disabled={sending || selectedProfiles.length === 0 || !mensagem.trim()}
                className="w-full gap-2"
              >
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {sending ? "Abrindo WhatsApp..." : `Enviar para ${selectedProfiles.length} colaborador(es)`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
