import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Send,
  MessageSquare,
  Users,
  Building2,
  User,
  Edit,
  Trash2,
  Plus,
  Copy,
  Loader2,
  Filter,
  Search,
} from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type ModeloMensagem = Tables<"modelos_mensagem"> & {
  tipo: string;
  titulo: string;
  mensagem: string;
  ativo: boolean;
};

type Profile = Tables<"profiles"> & {
  whatsapp?: string | null;
  unidade_id?: string | null;
};

type Unidade = Tables<"unidades">;

export default function MensagensAdmin() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modelos, setModelos] = useState<ModeloMensagem[]>([]);
  const [colaboradores, setColaboradores] = useState<Profile[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);

  // Estados de seleção para envio
  const [selectedColaboradores, setSelectedColaboradores] = useState<string[]>([]);
  const [filterUnidade, setFilterUnidade] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [selectedModeloId, setSelectedModeloId] = useState<string>("");
  const [mensagemCustom, setMensagemCustom] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Estado para edição/criação de modelo
  const [modeloDialogOpen, setModeloDialogOpen] = useState(false);
  const [editandoModelo, setEditandoModelo] = useState<ModeloMensagem | null>(null);
  const [modeloForm, setModeloForm] = useState({
    titulo: "",
    tipo: "",
    mensagem: "",
    ativo: true,
  });

  const [confirmDelete, setConfirmDelete] = useState<ModeloMensagem | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [modelosRes, profilesRes, unidadesRes] = await Promise.all([
        supabase.from("modelos_mensagem").select("*").order("tipo"),
        supabase.from("profiles").select("id, nome, whatsapp, unidade_id, ativo").eq("ativo", true),
        supabase.from("unidades").select("id, nome").eq("ativo", true),
      ]);

      if (modelosRes.error) throw modelosRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (unidadesRes.error) throw unidadesRes.error;

      setModelos(modelosRes.data || []);
      setColaboradores(profilesRes.data || []);
      setUnidades(unidadesRes.data || []);
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

  // Filtrar colaboradores com WhatsApp
  const colaboradoresComWhatsApp = useMemo(() => {
    return colaboradores.filter((c) => c.whatsapp && c.whatsapp.trim().length > 0);
  }, [colaboradores]);

  // Colaboradores filtrados por unidade e busca
  const filteredColaboradores = useMemo(() => {
    let list = colaboradoresComWhatsApp;
    if (filterUnidade !== "all") {
      list = list.filter((c) => c.unidade_id === filterUnidade);
    }
    if (filterSearch) {
      const search = filterSearch.toLowerCase();
      list = list.filter((c) => c.nome.toLowerCase().includes(search));
    }
    return list;
  }, [colaboradoresComWhatsApp, filterUnidade, filterSearch]);

  // Selecionar todos / nenhum
  const toggleSelectAll = () => {
    if (selectedColaboradores.length === filteredColaboradores.length) {
      setSelectedColaboradores([]);
    } else {
      setSelectedColaboradores(filteredColaboradores.map((c) => c.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedColaboradores((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Selecionar modelo e preencher mensagem
  const handleModeloSelect = (modeloId: string) => {
    setSelectedModeloId(modeloId);
    const modelo = modelos.find((m) => m.id === modeloId);
    if (modelo) {
      setMensagemCustom(modelo.mensagem);
    }
  };

  // Enviar mensagem
  const handleEnviar = async () => {
    if (selectedColaboradores.length === 0) {
      toast.error("Selecione pelo menos um colaborador");
      return;
    }
    if (!mensagemCustom.trim()) {
      toast.error("Digite uma mensagem ou selecione um modelo");
      return;
    }

    setEnviando(true);
    try {
      // Buscar números de WhatsApp dos colaboradores selecionados
      const selectedProfiles = colaboradores.filter((c) =>
        selectedColaboradores.includes(c.id)
      );

      const resultados = await Promise.all(
        selectedProfiles.map(async (profile) => {
          if (!profile.whatsapp) return { nome: profile.nome, status: "sem_whatsapp" };
          // 🔥 Aqui você pode integrar com a API de WhatsApp real
          // Exemplo: await sendWhatsApp(profile.whatsapp, mensagemCustom);
          console.log(`Enviando para ${profile.nome} (${profile.whatsapp}): ${mensagemCustom}`);
          return { nome: profile.nome, status: "enviado" };
        })
      );

      const enviados = resultados.filter((r) => r.status === "enviado").length;
      const semWhats = resultados.filter((r) => r.status === "sem_whatsapp").length;

      toast.success(`Mensagem enviada para ${enviados} colaboradores${semWhats > 0 ? ` (${semWhats} sem WhatsApp)` : ""}`);
      setSelectedColaboradores([]);
      setMensagemCustom("");
      setSelectedModeloId("");
    } catch (error) {
      console.error("Erro ao enviar:", error);
      toast.error("Erro ao enviar mensagens");
    } finally {
      setEnviando(false);
    }
  };

  // --- CRUD de Modelos ---
  const openModeloDialog = (modelo?: ModeloMensagem) => {
    if (modelo) {
      setEditandoModelo(modelo);
      setModeloForm({
        titulo: modelo.titulo,
        tipo: modelo.tipo,
        mensagem: modelo.mensagem,
        ativo: modelo.ativo,
      });
    } else {
      setEditandoModelo(null);
      setModeloForm({ titulo: "", tipo: "", mensagem: "", ativo: true });
    }
    setModeloDialogOpen(true);
  };

  const saveModelo = async () => {
    if (!modeloForm.titulo.trim() || !modeloForm.tipo.trim() || !modeloForm.mensagem.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setBusy(true);
    try {
      if (editandoModelo) {
        const { error } = await supabase
          .from("modelos_mensagem")
          .update(modeloForm)
          .eq("id", editandoModelo.id);
        if (error) throw error;
        toast.success("Modelo atualizado!");
      } else {
        const { error } = await supabase.from("modelos_mensagem").insert(modeloForm);
        if (error) throw error;
        toast.success("Modelo criado!");
      }
      setModeloDialogOpen(false);
      loadData();
    } catch (error) {
      console.error("Erro ao salvar modelo:", error);
      toast.error("Erro ao salvar modelo");
    } finally {
      setBusy(false);
    }
  };

  const deleteModelo = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("modelos_mensagem")
        .delete()
        .eq("id", confirmDelete.id);
      if (error) throw error;
      toast.success("Modelo excluído!");
      setConfirmDelete(null);
      loadData();
    } catch (error) {
      console.error("Erro ao excluir modelo:", error);
      toast.error("Erro ao excluir modelo");
    } finally {
      setBusy(false);
    }
  };

  const getTipoLabel = (tipo: string) => {
    const tipos: Record<string, string> = {
      aniversario: "🎂 Aniversário",
      aviso: "📢 Aviso Geral",
      feriado: "📅 Feriado",
      convocacao: "📣 Convocação",
      comunicado: "📨 Comunicado",
      outro: "📝 Outro",
    };
    return tipos[tipo] || tipo;
  };

  const tiposDisponiveis = [
    { value: "aniversario", label: "🎂 Aniversário" },
    { value: "aviso", label: "📢 Aviso Geral" },
    { value: "feriado", label: "📅 Feriado" },
    { value: "convocacao", label: "📣 Convocação" },
    { value: "comunicado", label: "📨 Comunicado" },
    { value: "outro", label: "📝 Outro" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <MessageSquare className="size-6 text-primary" /> Comunicação
        </h1>
        <p className="text-muted-foreground mt-1">
          Gerencie modelos de mensagem e envie comunicados para colaboradores via WhatsApp.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Painel de Envio */}
        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Send className="size-4 text-primary" /> Enviar Mensagem
            </CardTitle>
            <Badge variant="outline">{selectedColaboradores.length} selecionados</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filtros */}
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <div className="flex-1 min-w-[150px]">
                  <Label className="text-xs font-medium text-muted-foreground">Unidade</Label>
                  <Select value={filterUnidade} onValueChange={setFilterUnidade}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {unidades.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <Label className="text-xs font-medium text-muted-foreground">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Nome..."
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                  className="h-8"
                >
                  {selectedColaboradores.length === filteredColaboradores.length
                    ? "Desselecionar todos"
                    : "Selecionar todos"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {filteredColaboradores.length} colaboradores com WhatsApp
                </span>
              </div>
            </div>

            {/* Lista de colaboradores */}
            <div className="max-h-48 overflow-y-auto border rounded-lg divide-y divide-border">
              {filteredColaboradores.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nenhum colaborador com WhatsApp encontrado.
                </div>
              ) : (
                filteredColaboradores.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30">
                    <input
                      type="checkbox"
                      checked={selectedColaboradores.includes(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      className="size-4 rounded border-gray-300"
                    />
                    <span className="text-sm flex-1 truncate">{c.nome}</span>
                    <span className="text-xs text-muted-foreground">
                      {unidades.find((u) => u.id === c.unidade_id)?.nome || "—"}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Mensagem */}
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Modelo rápido</Label>
                <Select value={selectedModeloId} onValueChange={handleModeloSelect}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione um modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {modelos.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.titulo} ({getTipoLabel(m.tipo)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">Mensagem</Label>
                <Textarea
                  rows={4}
                  value={mensagemCustom}
                  onChange={(e) => setMensagemCustom(e.target.value)}
                  placeholder="Digite sua mensagem aqui..."
                  className="resize-none"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Você pode usar variáveis: {'{nome}'}, {'{unidade}'}
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleEnviar}
                disabled={enviando || selectedColaboradores.length === 0 || !mensagemCustom.trim()}
              >
                {enviando ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Send className="size-4 mr-2" />
                )}
                {enviando ? "Enviando..." : `Enviar para ${selectedColaboradores.length} colaborador(es)`}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Painel de Modelos */}
        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Copy className="size-4 text-primary" /> Modelos de Mensagem
            </CardTitle>
            <Button size="sm" className="h-8" onClick={() => openModeloDialog()}>
              <Plus className="size-4 mr-1" /> Novo
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : modelos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum modelo cadastrado.
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {modelos.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-lg border ${m.ativo ? "border-border" : "opacity-50 border-dashed"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{m.titulo}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {getTipoLabel(m.tipo)}
                          </Badge>
                          {!m.ativo && (
                            <Badge variant="outline" className="text-[10px] bg-gray-100">
                              Inativo
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {m.mensagem}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => openModeloDialog(m)}
                          title="Editar"
                        >
                          <Edit className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setConfirmDelete(m)}
                          title="Excluir"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de criação/edição de modelo */}
      <Dialog open={modeloDialogOpen} onOpenChange={setModeloDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editandoModelo ? "Editar Modelo" : "Novo Modelo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={modeloForm.titulo}
                onChange={(e) => setModeloForm({ ...modeloForm, titulo: e.target.value })}
                placeholder="Ex: Mensagem de Aniversário"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select
                value={modeloForm.tipo}
                onValueChange={(value) => setModeloForm({ ...modeloForm, tipo: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {tiposDisponiveis.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mensagem *</Label>
              <Textarea
                rows={4}
                value={modeloForm.mensagem}
                onChange={(e) => setModeloForm({ ...modeloForm, mensagem: e.target.value })}
                placeholder="Digite o conteúdo da mensagem..."
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Use {'{nome}'} para nome do colaborador e {'{unidade}'} para a unidade.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={modeloForm.ativo}
                onCheckedChange={(checked) => setModeloForm({ ...modeloForm, ativo: checked })}
              />
              <Label className="text-sm">Modelo ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModeloDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveModelo} disabled={busy}>
              {busy ? "Salvando..." : editandoModelo ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o modelo "{confirmDelete?.titulo}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteModelo} className="bg-red-600 text-white hover:bg-red-700">
              {busy ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}