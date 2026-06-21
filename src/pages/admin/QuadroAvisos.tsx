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
import { Bell, Plus, Pencil, Trash2, Loader2, CalendarDays, Users, Building2, User, X, FileText, Image } from "lucide-react";
import { formatBR } from "@/lib/folga-rules";

interface Aviso {
  id: string;
  titulo: string;
  mensagem: string;
  data_inicio: string;
  data_fim: string;
  para_todos: boolean;
  colaborador_id: string | null;
  unidade_id: string | null;
  ativo: boolean;
  created_at: string;
  arquivo_path?: string | null;
  arquivo_tipo?: string | null;
}

interface Profile {
  id: string;
  nome: string;
  unidade_id: string | null;
}

interface Unidade {
  id: string;
  nome: string;
}

export default function QuadroAvisosAdmin() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [colaboradores, setColaboradores] = useState<Profile[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Aviso | null>(null);
  const [form, setForm] = useState({
    titulo: "",
    mensagem: "",
    data_inicio: "",
    data_fim: "",
    destinatario_tipo: "todos", // 'todos', 'unidade', 'individual'
    unidade_id: "",
    colaborador_id: "",
    arquivo: null as File | null,
  });

  const [confirmDelete, setConfirmDelete] = useState<Aviso | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [avisosRes, colaboradoresRes, unidadesRes] = await Promise.all([
        supabase.from("avisos").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, nome, unidade_id").eq("ativo", true).order("nome"),
        supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome"),
      ]);

      setAvisos(avisosRes.data ?? []);
      setColaboradores(colaboradoresRes.data ?? []);
      setUnidades(unidadesRes.data ?? []);
    } catch (error) {
      toast.error("Erro ao carregar avisos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const getColaboradoresFiltrados = () => {
    if (!form.unidade_id) return colaboradores;
    return colaboradores.filter(c => c.unidade_id === form.unidade_id);
  };

  const salvarAviso = async () => {
    if (!form.titulo.trim() || !form.mensagem.trim() || !form.data_inicio || !form.data_fim) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (form.data_inicio > form.data_fim) {
      toast.error("Data de início não pode ser maior que data de fim");
      return;
    }

    setBusy(true);
    try {
      let arquivoPath: string | null = null;
      let arquivoTipo: string | null = null;

      // Upload do arquivo se houver
      if (form.arquivo) {
        const kind = form.arquivo.type === 'application/pdf' ? 'pdf' : 'image';
        const path = `avisos/${Date.now()}_${form.arquivo.name}`;
        const { error: uploadError } = await supabase.storage
          .from("documentos_admin")
          .upload(path, form.arquivo);
        if (uploadError) throw uploadError;
        arquivoPath = path;
        arquivoTipo = kind;
      }

      const dados: any = {
        titulo: form.titulo.trim(),
        mensagem: form.mensagem.trim(),
        data_inicio: form.data_inicio,
        data_fim: form.data_fim,
        ativo: true,
        criado_por: (await supabase.auth.getUser()).data.user?.id,
        arquivo_path: arquivoPath,
        arquivo_tipo: arquivoTipo,
      };

      if (form.destinatario_tipo === "todos") {
        dados.para_todos = true;
        dados.colaborador_id = null;
        dados.unidade_id = null;
      } else if (form.destinatario_tipo === "unidade") {
        dados.para_todos = false;
        dados.colaborador_id = null;
        dados.unidade_id = form.unidade_id || null;
      } else { // individual
        dados.para_todos = false;
        dados.colaborador_id = form.colaborador_id || null;
        dados.unidade_id = null;
      }

      if (editando) {
        const { error } = await supabase
          .from("avisos")
          .update({ ...dados, updated_at: new Date().toISOString() })
          .eq("id", editando.id);
        if (error) throw error;
        toast.success("Aviso atualizado");
      } else {
        const { error } = await supabase.from("avisos").insert(dados);
        if (error) throw error;
        toast.success("Aviso criado");
      }

      setDialogOpen(false);
      setEditando(null);
      setForm({
        titulo: "",
        mensagem: "",
        data_inicio: "",
        data_fim: "",
        destinatario_tipo: "todos",
        unidade_id: "",
        colaborador_id: "",
        arquivo: null,
      });
      load();
    } catch (error) {
      toast.error("Erro ao salvar aviso", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const excluirAviso = async (id: string) => {
    const { error } = await supabase.from("avisos").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Aviso excluído");
    setConfirmDelete(null);
    load();
  };

  const abrirEdicao = (aviso: Aviso) => {
    setEditando(aviso);
    let destinatario_tipo = "todos";
    if (aviso.unidade_id) destinatario_tipo = "unidade";
    else if (aviso.colaborador_id) destinatario_tipo = "individual";

    setForm({
      titulo: aviso.titulo,
      mensagem: aviso.mensagem,
      data_inicio: aviso.data_inicio,
      data_fim: aviso.data_fim,
      destinatario_tipo,
      unidade_id: aviso.unidade_id || "",
      colaborador_id: aviso.colaborador_id || "",
      arquivo: null,
    });
    setDialogOpen(true);
  };

  const alternarAtivo = async (aviso: Aviso) => {
    const { error } = await supabase
      .from("avisos")
      .update({ ativo: !aviso.ativo, updated_at: new Date().toISOString() })
      .eq("id", aviso.id);
    if (error) {
      toast.error("Erro ao alterar status");
      return;
    }
    toast.success(aviso.ativo ? "Aviso desativado" : "Aviso ativado");
    load();
  };

  const handleDownload = async (path: string) => {
    const { data } = await supabase.storage
      .from("documentos_admin")
      .createSignedUrl(path, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  const getDestinatarioLabel = (aviso: Aviso) => {
    if (aviso.para_todos) return "Todos";
    if (aviso.unidade_id) {
      const unidade = unidades.find(u => u.id === aviso.unidade_id);
      return unidade ? `Unidade: ${unidade.nome}` : "Unidade";
    }
    if (aviso.colaborador_id) {
      const colab = colaboradores.find(c => c.id === aviso.colaborador_id);
      return colab ? colab.nome : "Colaborador";
    }
    return "—";
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Bell className="size-6 text-primary" /> Quadro de Avisos
          </h1>
          <p className="text-muted-foreground mt-1">
            Crie avisos que aparecerão para os colaboradores ao fazerem login.
          </p>
        </div>
        <Button onClick={() => { setEditando(null); setForm({ titulo: "", mensagem: "", data_inicio: "", data_fim: "", destinatario_tipo: "todos", unidade_id: "", colaborador_id: "", arquivo: null }); setDialogOpen(true); }}>
          <Plus className="size-4 mr-2" /> Novo Aviso
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : avisos.length === 0 ? (
        <div className="text-center p-12 border border-dashed rounded-2xl text-muted-foreground">
          Nenhum aviso cadastrado.
        </div>
      ) : (
        <div className="grid gap-4">
          {avisos.map((aviso) => (
            <div key={aviso.id} className={`bg-card border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all ${!aviso.ativo ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-semibold text-lg">{aviso.titulo}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${aviso.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {aviso.ativo ? "Ativo" : "Inativo"}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="size-3" />
                      {getDestinatarioLabel(aviso)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{aviso.mensagem}</p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><CalendarDays className="size-3" /> Início: {formatBR(new Date(aviso.data_inicio + "T00:00:00"))}</span>
                    <span className="flex items-center gap-1"><CalendarDays className="size-3" /> Fim: {formatBR(new Date(aviso.data_fim + "T00:00:00"))}</span>
                    {aviso.arquivo_path && (
                      <button
                        onClick={() => handleDownload(aviso.arquivo_path!)}
                        className="flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        {aviso.arquivo_tipo === 'image' ? <Image className="size-3" /> : <FileText className="size-3" />}
                        Anexo
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => alternarAtivo(aviso)}>
                    {aviso.ativo ? "Desativar" : "Ativar"}
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" title="Editar" onClick={() => abrirEdicao(aviso)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 text-red-500" title="Excluir" onClick={() => setConfirmDelete(aviso)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Aviso" : "Novo Aviso"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Título do aviso" />
            </div>
            <div className="space-y-2">
              <Label>Mensagem *</Label>
              <Textarea rows={4} value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} placeholder="Conteúdo do aviso" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início *</Label>
                <Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Data Fim *</Label>
                <Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Destinatário</Label>
              <Select value={form.destinatario_tipo} onValueChange={(v) => {
                setForm({ ...form, destinatario_tipo: v, unidade_id: "", colaborador_id: "" });
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os colaboradores</SelectItem>
                  <SelectItem value="unidade">Unidade específica</SelectItem>
                  <SelectItem value="individual">Colaborador específico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.destinatario_tipo === "unidade" && (
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select value={form.unidade_id} onValueChange={(v) => setForm({ ...form, unidade_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                  <SelectContent>
                    {unidades.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.destinatario_tipo === "individual" && (
              <>
                <div className="space-y-2">
                  <Label>Unidade (para filtrar colaboradores)</Label>
                  <Select value={form.unidade_id} onValueChange={(v) => setForm({ ...form, unidade_id: v, colaborador_id: "" })}>
                    <SelectTrigger><SelectValue placeholder="Todas as unidades" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas as unidades</SelectItem>
                      {unidades.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Colaborador</Label>
                  <Select value={form.colaborador_id} onValueChange={(v) => setForm({ ...form, colaborador_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger>
                    <SelectContent>
                      {getColaboradoresFiltrados().map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                      {getColaboradoresFiltrados().length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground text-center">
                          Nenhum colaborador nesta unidade
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Anexo (PDF ou Imagem)</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setForm({ ...form, arquivo: file });
                }}
              />
              {form.arquivo && (
                <p className="text-xs text-muted-foreground">
                  {form.arquivo.name} ({(form.arquivo.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={salvarAviso} disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aviso?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o aviso "{confirmDelete?.titulo}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && excluirAviso(confirmDelete.id)} className="bg-red-600 text-white hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}