"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MessageSquare, Plus, Pencil, Trash2, Send, Loader2, Users, User } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Mensagem = Tables<'mensagens'>;

const TIPOS = [
  { value: "aniversario", label: "🎂 Aniversário" },
  { value: "convocacao", label: "📢 Convocação de Feriado" },
  { value: "aviso", label: "📢 Aviso Geral" },
  { value: "outros", label: "📝 Outros" },
];

export default function MensagensAdmin() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Mensagem | null>(null);
  const [form, setForm] = useState({
    titulo: "",
    corpo: "",
    tipo: "aviso",
    ativo: true,
  });
  const [deleteDialog, setDeleteDialog] = useState<Mensagem | null>(null);
  const [envioDialog, setEnvioDialog] = useState<Mensagem | null>(null);
  const [envioBusy, setEnvioBusy] = useState(false);
  const [selectedColaborador, setSelectedColaborador] = useState("");
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [envioModo, setEnvioModo] = useState<"individual" | "massa">("massa");
  const [unidades, setUnidades] = useState<any[]>([]);
  const [selectedUnidade, setSelectedUnidade] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const [msgRes, colabRes, unidadesRes] = await Promise.all([
        supabase.from("mensagens").select("*").order("tipo"),
        supabase.from("profiles").select("id, nome, whatsapp, unidade_id").eq("ativo", true).order("nome"),
        supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome"),
      ]);
      setMensagens(msgRes.data ?? []);
      setColaboradores(colabRes.data ?? []);
      setUnidades(unidadesRes.data ?? []);
    } catch (e) {
      toast.error("Erro ao carregar dados", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openDialog = (msg?: Mensagem) => {
    if (msg) {
      setEditando(msg);
      setForm({
        titulo: msg.titulo,
        corpo: msg.corpo,
        tipo: msg.tipo,
        ativo: msg.ativo,
      });
    } else {
      setEditando(null);
      setForm({ titulo: "", corpo: "", tipo: "aviso", ativo: true });
    }
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.titulo.trim() || !form.corpo.trim()) {
      toast.error("Preencha título e corpo da mensagem");
      return;
    }
    setBusy(true);
    try {
      if (editando) {
        const { error } = await supabase
          .from("mensagens")
          .update({
            titulo: form.titulo.trim(),
            corpo: form.corpo.trim(),
            tipo: form.tipo,
            ativo: form.ativo,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editando.id);
        if (error) throw error;
        toast.success("Modelo atualizado!");
      } else {
        const { error } = await supabase
          .from("mensagens")
          .insert({
            titulo: form.titulo.trim(),
            corpo: form.corpo.trim(),
            tipo: form.tipo,
            ativo: form.ativo,
          });
        if (error) throw error;
        toast.success("Modelo criado!");
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      toast.error("Erro ao salvar", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const deleteMsg = async (id: string) => {
    const { error } = await supabase.from("mensagens").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir", { description: error.message });
      return;
    }
    toast.success("Modelo excluído!");
    setDeleteDialog(null);
    load();
  };

  const toggleAtivo = async (msg: Mensagem) => {
    const { error } = await supabase
      .from("mensagens")
      .update({ ativo: !msg.ativo, updated_at: new Date().toISOString() })
      .eq("id", msg.id);
    if (error) {
      toast.error("Erro ao alterar status", { description: error.message });
      return;
    }
    load();
  };

  const openEnvio = (msg: Mensagem) => {
    setEnvioDialog(msg);
    setSelectedColaborador("");
    setSelectedUnidade("all");
    setEnvioModo("massa");
  };

  const enviarWhatsApp = async () => {
    if (!envioDialog) return;
    setEnvioBusy(true);
    try {
      // 🔥 Filtrar colaboradores
      let destinatarios = colaboradores;
      if (envioModo === "individual" && selectedColaborador) {
        destinatarios = destinatarios.filter(c => c.id === selectedColaborador);
      } else if (selectedUnidade !== "all") {
        destinatarios = destinatarios.filter(c => c.unidade_id === selectedUnidade);
      }

      // 🔥 Filtrar apenas com WhatsApp
      const comWhatsApp = destinatarios.filter(c => c.whatsapp);
      if (comWhatsApp.length === 0) {
        toast.error("Nenhum colaborador com WhatsApp cadastrado");
        return;
      }

      // 🔥 Substituir variáveis no corpo
      const corpo = envioDialog.corpo;
      const titulo = envioDialog.titulo;

      // 🔥 Enviar para cada um (ou em lote, dependendo da sua API)
      const resultados = await Promise.all(
        comWhatsApp.map(async (c) => {
          const mensagem = corpo
            .replace(/{nome}/g, c.nome)
            .replace(/{unidade}/g, unidades.find(u => u.id === c.unidade_id)?.nome || "não informada");
          // 🔥 Chame sua função de envio aqui (ex: adminApi.sendWhatsApp)
          // Simulando envio:
          console.log(`📤 Enviando para ${c.nome} (${c.whatsapp}):`, mensagem);
          return { nome: c.nome, success: true };
        })
      );

      const enviados = resultados.filter(r => r.success).length;
      toast.success(`Mensagem enviada para ${enviados} colaborador(es)!`);
      setEnvioDialog(null);
    } catch (e) {
      toast.error("Erro ao enviar mensagem", { description: (e as Error).message });
    } finally {
      setEnvioBusy(false);
    }
  };

  const filteredColaboradores = colaboradores.filter(c => 
    selectedUnidade === "all" || c.unidade_id === selectedUnidade
  );

  const getTipoLabel = (tipo: string) => {
    return TIPOS.find(t => t.value === tipo)?.label || tipo;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="size-6 text-primary" /> Comunicados
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie modelos de mensagens para envio via WhatsApp.
          </p>
        </div>
        <Button onClick={() => openDialog()} className="rounded-full px-6">
          <Plus className="size-4 mr-2" /> Novo Modelo
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : mensagens.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
          Nenhum modelo de mensagem cadastrado. Crie seu primeiro modelo!
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mensagens.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "bg-card border rounded-2xl p-4 space-y-3 transition-all",
                msg.ativo ? "border-border" : "border-muted opacity-60"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate">{msg.titulo}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {getTipoLabel(msg.tipo)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{msg.corpo}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => openDialog(msg)}
                  >
                    <Pencil className="size-3 mr-1" /> Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-red-500 hover:text-red-700"
                    onClick={() => setDeleteDialog(msg)}
                  >
                    <Trash2 className="size-3 mr-1" /> Excluir
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={msg.ativo ? "outline" : "secondary"}
                    size="sm"
                    className="h-7 px-2 text-[10px]"
                    onClick={() => toggleAtivo(msg)}
                  >
                    {msg.ativo ? "Ativo" : "Inativo"}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700"
                    onClick={() => openEnvio(msg)}
                    disabled={!msg.ativo}
                  >
                    <Send className="size-3 mr-1" /> Enviar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog de criação/edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Modelo" : "Novo Modelo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ex: Mensagem de Aniversário"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Corpo da Mensagem *</Label>
              <Textarea
                value={form.corpo}
                onChange={(e) => setForm({ ...form, corpo: e.target.value })}
                placeholder="Use {nome} para o nome do colaborador e {unidade} para a unidade."
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Variáveis disponíveis: <code className="bg-muted px-1 rounded">{`{nome}`}</code> e <code className="bg-muted px-1 rounded">{`{unidade}`}</code>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ativo"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                className="size-4"
              />
              <Label htmlFor="ativo">Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              {editando ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de envio */}
      <Dialog open={!!envioDialog} onOpenChange={(o) => !o && setEnvioDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="size-5 text-primary" /> Enviar Mensagem
            </DialogTitle>
          </DialogHeader>
          {envioDialog && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted/50 rounded-xl">
                <p className="text-sm font-medium">{envioDialog.titulo}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{envioDialog.corpo}</p>
              </div>
              <div className="space-y-2">
                <Label>Modo de Envio</Label>
                <Select value={envioModo} onValueChange={(v) => setEnvioModo(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="massa">👥 Envio em massa</SelectItem>
                    <SelectItem value="individual">👤 Envio individual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {envioModo === "individual" ? (
                <div className="space-y-2">
                  <Label>Colaborador</Label>
                  <Select value={selectedColaborador} onValueChange={setSelectedColaborador}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o colaborador" />
                    </SelectTrigger>
                    <SelectContent>
                      {colaboradores.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedColaborador && (
                    <p className="text-xs text-muted-foreground">
                      WhatsApp: {colaboradores.find(c => c.id === selectedColaborador)?.whatsapp || "Não cadastrado"}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Unidade (opcional)</Label>
                  <Select value={selectedUnidade} onValueChange={setSelectedUnidade}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as unidades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as unidades</SelectItem>
                      {unidades.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {filteredColaboradores.length} colaborador(es) com WhatsApp
                  </p>
                </div>
              )}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                ⚠️ Esta funcionalidade está em desenvolvimento. O envio será simulado.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEnvioDialog(null)}>Cancelar</Button>
            <Button onClick={enviarWhatsApp} disabled={envioBusy} className="bg-green-600 hover:bg-green-700">
              {envioBusy ? <Loader2 className="size-4 animate-spin mr-2" /> : <Send className="size-4 mr-2" />}
              {envioBusy ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de exclusão */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(o) => !o && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o modelo <strong>"{deleteDialog?.titulo}"</strong>?
              <br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialog && deleteMsg(deleteDialog.id)}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}