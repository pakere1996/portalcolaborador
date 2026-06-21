import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { MessageSquare, Plus, Pencil, Trash2, Send, Loader2, Copy } from "lucide-react";

interface ModeloMensagem {
  id: string;
  nome: string;
  assunto: string;
  corpo: string;
  tipo: string;
  ativo: boolean;
}

interface Profile {
  id: string;
  nome: string;
  whatsapp: string | null;
  unidade_id: string | null;
}

const TIPOS_MODELO = [
  { value: "aniversario", label: "Aniversário" },
  { value: "aviso_geral", label: "Aviso Geral" },
  { value: "convocacao", label: "Convocação" },
  { value: "feriado", label: "Feriado" },
  { value: "outro", label: "Outro" },
];

export default function MensagensAdmin() {
  const [modelos, setModelos] = useState<ModeloMensagem[]>([]);
  const [colaboradores, setColaboradores] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [destinatario, setDestinatario] = useState("todos");
  const [unidadeId, setUnidadeId] = useState("");
  const [colaboradorId, setColaboradorId] = useState("");
  const [modeloSelecionado, setModeloSelecionado] = useState("nenhum"); // 🔥 CORRIGIDO: valor sentinela
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [unidades, setUnidades] = useState<any[]>([]);

  const [modeloDialogOpen, setModeloDialogOpen] = useState(false);
  const [editandoModelo, setEditandoModelo] = useState<ModeloMensagem | null>(null);
  const [modeloForm, setModeloForm] = useState({
    nome: "",
    assunto: "",
    corpo: "",
    tipo: "outro",
  });

  const [confirmDelete, setConfirmDelete] = useState<ModeloMensagem | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [modelosRes, colaboradoresRes, unidadesRes] = await Promise.all([
        supabase.from("modelos_mensagem").select("*").order("nome"),
        supabase.from("profiles").select("id, nome, whatsapp, unidade_id").eq("ativo", true).order("nome"),
        supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome"),
      ]);

      setModelos(modelosRes.data ?? []);
      setColaboradores(colaboradoresRes.data ?? []);
      setUnidades(unidadesRes.data ?? []);
    } catch (error) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // 🔥 Quando selecionar um modelo, preenche os campos (exceto se for "nenhum")
  useEffect(() => {
    if (modeloSelecionado === "nenhum") {
      setAssunto("");
      setMensagem("");
      return;
    }
    const modelo = modelos.find(m => m.id === modeloSelecionado);
    if (modelo) {
      setAssunto(modelo.assunto);
      setMensagem(modelo.corpo);
    }
  }, [modeloSelecionado, modelos]);

  const handleEnviar = async () => {
    if (!assunto.trim() || !mensagem.trim()) {
      toast.error("Preencha assunto e mensagem");
      return;
    }

    setBusy(true);
    try {
      const destinatarios = [];
      if (destinatario === "todos") {
        destinatarios.push(...colaboradores.map(c => ({ id: c.id, nome: c.nome, whatsapp: c.whatsapp })));
      } else if (destinatario === "unidade" && unidadeId) {
        destinatarios.push(...colaboradores.filter(c => c.unidade_id === unidadeId).map(c => ({ id: c.id, nome: c.nome, whatsapp: c.whatsapp })));
      } else if (destinatario === "individual" && colaboradorId) {
        const colab = colaboradores.find(c => c.id === colaboradorId);
        if (colab) destinatarios.push({ id: colab.id, nome: colab.nome, whatsapp: colab.whatsapp });
      }

      const comWhatsApp = destinatarios.filter(d => d.whatsapp);
      const semWhatsApp = destinatarios.filter(d => !d.whatsapp);

      let msg = `Mensagem enviada para ${destinatarios.length} colaboradores.`;
      if (comWhatsApp.length > 0) msg += ` ${comWhatsApp.length} com WhatsApp.`;
      if (semWhatsApp.length > 0) msg += ` ${semWhatsApp.length} sem WhatsApp cadastrado.`;

      toast.success(msg);

      setAssunto("");
      setMensagem("");
      setModeloSelecionado("nenhum");
    } catch (error) {
      toast.error("Erro ao enviar mensagem");
    } finally {
      setBusy(false);
    }
  };

  const salvarModelo = async () => {
    if (!modeloForm.nome.trim() || !modeloForm.assunto.trim() || !modeloForm.corpo.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }

    setBusy(true);
    try {
      if (editandoModelo) {
        const { error } = await supabase
          .from("modelos_mensagem")
          .update({
            nome: modeloForm.nome.trim(),
            assunto: modeloForm.assunto.trim(),
            corpo: modeloForm.corpo.trim(),
            tipo: modeloForm.tipo,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editandoModelo.id);
        if (error) throw error;
        toast.success("Modelo atualizado");
      } else {
        const { error } = await supabase
          .from("modelos_mensagem")
          .insert({
            nome: modeloForm.nome.trim(),
            assunto: modeloForm.assunto.trim(),
            corpo: modeloForm.corpo.trim(),
            tipo: modeloForm.tipo,
            criado_por: (await supabase.auth.getUser()).data.user?.id,
          });
        if (error) throw error;
        toast.success("Modelo criado");
      }
      setModeloDialogOpen(false);
      setEditandoModelo(null);
      setModeloForm({ nome: "", assunto: "", corpo: "", tipo: "outro" });
      load();
    } catch (error) {
      toast.error("Erro ao salvar modelo");
    } finally {
      setBusy(false);
    }
  };

  const excluirModelo = async (id: string) => {
    const { error } = await supabase.from("modelos_mensagem").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Modelo excluído");
    setConfirmDelete(null);
    load();
  };

  const abrirEdicaoModelo = (modelo: ModeloMensagem) => {
    setEditandoModelo(modelo);
    setModeloForm({
      nome: modelo.nome,
      assunto: modelo.assunto,
      corpo: modelo.corpo,
      tipo: modelo.tipo,
    });
    setModeloDialogOpen(true);
  };

  const aplicarModelo = (modelo: ModeloMensagem) => {
    setModeloSelecionado(modelo.id);
    setAssunto(modelo.assunto);
    setMensagem(modelo.corpo);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="size-6 text-primary" /> Comunicados
          </h1>
          <p className="text-muted-foreground mt-1">
            Envie mensagens para colaboradores usando modelos pré-definidos ou mensagens personalizadas.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Modelos Rápidos</h2>
          <Button size="sm" onClick={() => { setEditandoModelo(null); setModeloForm({ nome: "", assunto: "", corpo: "", tipo: "outro" }); setModeloDialogOpen(true); }}>
            <Plus className="size-4 mr-1" /> Novo Modelo
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : modelos.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground border border-dashed rounded-xl">
            Nenhum modelo cadastrado. Crie um modelo para agilizar o envio de mensagens.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {modelos.map((modelo) => (
              <div key={modelo.id} className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{modelo.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {TIPOS_MODELO.find(t => t.value === modelo.tipo)?.label || modelo.tipo}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-1">{modelo.assunto}</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="size-8" title="Aplicar modelo" onClick={() => aplicarModelo(modelo)}>
                      <Copy className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8" title="Editar" onClick={() => abrirEdicaoModelo(modelo)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 text-red-500" title="Excluir" onClick={() => setConfirmDelete(modelo)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="size-5 text-primary" /> Enviar Mensagem
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Destinatário</Label>
                <Select value={destinatario} onValueChange={(v) => { setDestinatario(v); setUnidadeId(""); setColaboradorId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os colaboradores</SelectItem>
                    <SelectItem value="unidade">Por unidade</SelectItem>
                    <SelectItem value="individual">Colaborador específico</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {destinatario === "unidade" && (
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Select value={unidadeId} onValueChange={setUnidadeId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {unidades.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {destinatario === "individual" && (
                <div className="space-y-2">
                  <Label>Colaborador</Label>
                  <Select value={colaboradorId} onValueChange={setColaboradorId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {colaboradores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Modelo (opcional)</Label>
                {/* 🔥 CORRIGIDO: usa "nenhum" como valor sentinela */}
                <Select value={modeloSelecionado} onValueChange={setModeloSelecionado}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Nenhum</SelectItem>
                    {modelos.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Assunto *</Label>
              <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Assunto da mensagem" />
            </div>

            <div className="space-y-2">
              <Label>Mensagem *</Label>
              <Textarea rows={6} value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Digite a mensagem..." />
            </div>

            <Button onClick={handleEnviar} disabled={busy} className="w-full md:w-auto">
              {busy ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Send className="size-4 mr-2" />}
              {busy ? "Enviando..." : "Enviar Mensagem"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={modeloDialogOpen} onOpenChange={setModeloDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editandoModelo ? "Editar Modelo" : "Novo Modelo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Modelo *</Label>
              <Input value={modeloForm.nome} onChange={(e) => setModeloForm({ ...modeloForm, nome: e.target.value })} placeholder="Ex: Aniversário" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={modeloForm.tipo} onValueChange={(v) => setModeloForm({ ...modeloForm, tipo: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {TIPOS_MODELO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assunto *</Label>
              <Input value={modeloForm.assunto} onChange={(e) => setModeloForm({ ...modeloForm, assunto: e.target.value })} placeholder="Assunto do modelo" />
            </div>
            <div className="space-y-2">
              <Label>Corpo da Mensagem *</Label>
              <Textarea rows={4} value={modeloForm.corpo} onChange={(e) => setModeloForm({ ...modeloForm, corpo: e.target.value })} placeholder="Conteúdo do modelo" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModeloDialogOpen(false)}>Cancelar</Button>
            <Button onClick={salvarModelo} disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o modelo "{confirmDelete?.nome}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && excluirModelo(confirmDelete.id)} className="bg-red-600 text-white hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}