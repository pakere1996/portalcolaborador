import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  FileText,
  Download,
  Eye,
  Building2,
  Users,
  Calendar,
  File,
} from "lucide-react";
import { FavoritarBotao } from "@/components/FavoritarBotao";

// --- Interfaces ---
interface Negociacao {
  id: string;
  sindicato_patronal_id: string;
  sindicato_laboral_id: string;
  unidade_id: string;
  ano: number;
  mes: number;
  tipo_documento: "act" | "cct";
  storage_path: string | null;
  nome_pdf: string | null;
  created_at: string;
  updated_at: string;
}

interface Sindicato {
  id: string;
  nome: string;
  tipo: "patronal" | "laboral";
}

interface Unidade {
  id: string;
  nome: string;
}

// Formatação de mês
const meses = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function SindicatosNegociacoes() {
  const [negociacoes, setNegociacoes] = useState<Negociacao[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [sindicatos, setSindicatos] = useState<Sindicato[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Estado do modal
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Negociacao | null>(null);
  const [form, setForm] = useState({
    unidade_id: "",
    sindicato_patronal_id: "",
    sindicato_laboral_id: "",
    ano: new Date().getFullYear(),
    mes: new Date().getMonth() + 1,
    tipo_documento: "act" as "act" | "cct",
  });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arquivoAtual, setArquivoAtual] = useState<string | null>(null);

  // Confirmação de exclusão
  const [confirmDelete, setConfirmDelete] = useState<Negociacao | null>(null);

  // --- Patronais vinculados por unidade ---
  const [patronaisVinculados, setPatronaisVinculados] = useState<Sindicato[]>([]);

  // --- Loaders ---
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [unidadesData, sindicatosData, negociacoesData] = await Promise.all([
        supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("sindicatos").select("id, nome, tipo").order("nome"),
        supabase.from("negociacoes").select(`
          *,
          unidade:unidades(nome),
          sindicato_patronal:sindicatos!negociacoes_sindicato_patronal_id_fkey(nome),
          sindicato_laboral:sindicatos!negociacoes_sindicato_laboral_id_fkey(nome)
        `).order("ano", { ascending: false }).order("mes", { ascending: false })
      ]);

      if (unidadesData.error) throw unidadesData.error;
      if (sindicatosData.error) throw sindicatosData.error;
      if (negociacoesData.error) throw negociacoesData.error;

      setUnidades(unidadesData.data ?? []);
      setSindicatos(sindicatosData.data ?? []);
      setNegociacoes(negociacoesData.data ?? []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Carregar patronais vinculados quando a unidade mudar
  useEffect(() => {
    const loadPatronais = async () => {
      if (!form.unidade_id) {
        setPatronaisVinculados([]);
        return;
      }
      const { data, error } = await supabase
        .from("sindicato_unidades")
        .select("sindicato_id")
        .eq("unidade_id", form.unidade_id);
      if (error) {
        console.error(error);
        return;
      }
      const ids = data.map(item => item.sindicato_id);
      const vinculados = sindicatos.filter(s => ids.includes(s.id) && s.tipo === "patronal");
      setPatronaisVinculados(vinculados);
    };
    loadPatronais();
  }, [form.unidade_id, sindicatos]);

  // --- Handlers ---
  const handleUnidadeChange = (unidadeId: string) => {
    setForm({ ...form, unidade_id: unidadeId, sindicato_patronal_id: "" });
  };

  const handlePatronalChange = (patronalId: string) => {
    setForm({ ...form, sindicato_patronal_id: patronalId });
  };

  const handleLaboralChange = (laboralId: string) => {
    setForm({ ...form, sindicato_laboral_id: laboralId });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== "application/pdf") {
        toast.error("Apenas arquivos PDF são permitidos.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Arquivo muito grande. Máximo 10MB.");
        return;
      }
      setArquivo(file);
      setArquivoAtual(file.name);
    }
  };

  // Abrir modal para novo cadastro
  const abrirNovo = () => {
    setEditando(null);
    setForm({
      unidade_id: "",
      sindicato_patronal_id: "",
      sindicato_laboral_id: "",
      ano: new Date().getFullYear(),
      mes: new Date().getMonth() + 1,
      tipo_documento: "act",
    });
    setArquivo(null);
    setArquivoAtual(null);
    setPatronaisVinculados([]);
    setDialogOpen(true);
  };

  // Abrir modal para edição
  const abrirEdicao = (negociacao: Negociacao) => {
    setEditando(negociacao);
    setForm({
      unidade_id: negociacao.unidade_id || "",
      sindicato_patronal_id: negociacao.sindicato_patronal_id,
      sindicato_laboral_id: negociacao.sindicato_laboral_id,
      ano: negociacao.ano,
      mes: negociacao.mes,
      tipo_documento: negociacao.tipo_documento,
    });
    setArquivo(null);
    setArquivoAtual(negociacao.nome_pdf);
    setDialogOpen(true);
  };

  // Salvar
  const salvarNegociacao = async () => {
    // 🔥 VALIDAÇÃO: Converter campos vazios para null
    const unidadeId = form.unidade_id.trim() || null;
    const patronalId = form.sindicato_patronal_id.trim() || null;
    const laboralId = form.sindicato_laboral_id.trim() || null;

    if (!unidadeId) {
      toast.error("Selecione a unidade.");
      return;
    }
    if (!patronalId) {
      toast.error("Selecione o sindicato patronal.");
      return;
    }
    if (!laboralId) {
      toast.error("Selecione o sindicato laboral.");
      return;
    }
    if (!form.ano || form.ano < 2000 || form.ano > 2100) {
      toast.error("Ano inválido.");
      return;
    }
    if (!form.mes || form.mes < 1 || form.mes > 12) {
      toast.error("Mês inválido.");
      return;
    }

    setBusy(true);
    try {
      // Verificar duplicidade (mesmo par de sindicatos + mesmo ano)
      const { data: existing, error: checkError } = await supabase
        .from("negociacoes")
        .select("id")
        .eq("sindicato_patronal_id", patronalId)
        .eq("sindicato_laboral_id", laboralId)
        .eq("ano", form.ano)
        .neq("id", editando?.id || "");
      if (checkError) throw checkError;
      if (existing && existing.length > 0) {
        toast.error("Já existe uma negociação para este par de sindicatos e ano base.");
        return;
      }

      let storagePath = editando?.storage_path || null;
      let nomePdf = editando?.nome_pdf || null;

      // Upload do arquivo se houver
      if (arquivo) {
        const ext = arquivo.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const filePath = `negociacoes/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("sindicatos")
          .upload(filePath, arquivo);
        if (uploadError) throw uploadError;

        // Se havia arquivo antigo, deletar
        if (editando?.storage_path) {
          await supabase.storage.from("sindicatos").remove([editando.storage_path]);
        }

        storagePath = filePath;
        nomePdf = arquivo.name;
      }

      const dados = {
        unidade_id: unidadeId,
        sindicato_patronal_id: patronalId,
        sindicato_laboral_id: laboralId,
        ano: form.ano,
        mes: form.mes,
        tipo_documento: form.tipo_documento,
        storage_path: storagePath,
        nome_pdf: nomePdf,
        updated_at: new Date().toISOString(),
      };

      if (editando) {
        const { error } = await supabase
          .from("negociacoes")
          .update(dados)
          .eq("id", editando.id);
        if (error) throw error;
        toast.success("Negociação atualizada!");
      } else {
        const { error } = await supabase
          .from("negociacoes")
          .insert({ ...dados, created_at: new Date().toISOString() });
        if (error) throw error;
        toast.success("Negociação cadastrada!");
      }

      setDialogOpen(false);
      loadData();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  // Excluir
  const excluirNegociacao = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      if (confirmDelete.storage_path) {
        await supabase.storage.from("sindicatos").remove([confirmDelete.storage_path]);
      }
      const { error } = await supabase
        .from("negociacoes")
        .delete()
        .eq("id", confirmDelete.id);
      if (error) throw error;
      toast.success("Negociação excluída!");
      setConfirmDelete(null);
      loadData();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir");
    } finally {
      setBusy(false);
    }
  };

  // Download
  const downloadArquivo = async (path: string, nome: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("sindicatos")
        .download(path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao baixar arquivo:", error);
      toast.error("Erro ao baixar arquivo");
    }
  };

  // Visualizar PDF
  const visualizarArquivo = async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("sindicatos")
        .createSignedUrl(path, 60);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (error) {
      console.error("Erro ao visualizar:", error);
      toast.error("Erro ao visualizar arquivo");
    }
  };

  // --- Renderização ---
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <FileText className="size-6 text-primary" /> Negociações Coletivas
          </h1>
          <p className="text-muted-foreground mt-1">
            Registre acordos entre sindicatos patronais e laborais, vinculados a uma unidade.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FavoritarBotao rota="/admin/documentos/act-cct" label="ACT-CCT" icone="FileText" />
          <Button onClick={abrirNovo}>
            <Plus className="size-4 mr-2" /> Nova Negociação
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {negociacoes.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
              Nenhuma negociação cadastrada.
            </div>
          ) : (
            negociacoes.map((n) => {
              const unidadeNome = (n as any).unidade?.nome || "Unidade não definida";
              const patronalNome = (n as any).sindicato_patronal?.nome || "Não definido";
              const laboralNome = (n as any).sindicato_laboral?.nome || "Não definido";
              return (
                <Card key={n.id} className="border-border shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Building2 className="size-4 text-primary" />
                          {unidadeNome}
                        </CardTitle>
                        <div className="flex flex-wrap gap-2 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="size-3" /> {patronalNome}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="size-3" /> {laboralNome}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" /> {meses[n.mes - 1]}/{n.ano}
                          </span>
                          <Badge variant={n.tipo_documento === "act" ? "default" : "secondary"}>
                            {n.tipo_documento.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => abrirEdicao(n)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setConfirmDelete(n)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {n.nome_pdf && n.storage_path && (
                    <CardContent className="pt-2 flex items-center gap-4">
                      <File className="size-4 text-muted-foreground" />
                      <span className="text-sm flex-1">{n.nome_pdf}</span>
                      <Button variant="outline" size="sm" onClick={() => visualizarArquivo(n.storage_path!)}>
                        <Eye className="size-4 mr-1" /> Visualizar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => downloadArquivo(n.storage_path!, n.nome_pdf!)}>
                        <Download className="size-4 mr-1" /> Baixar
                      </Button>
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Modal de cadastro/edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editando ? "Editar" : "Nova"} Negociação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Unidade */}
            <div className="space-y-2">
              <Label>Unidade *</Label>
              <Select
                value={form.unidade_id}
                onValueChange={handleUnidadeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sindicato Patronal */}
            <div className="space-y-2">
              <Label>Sindicato Patronal *</Label>
              <Select
                value={form.sindicato_patronal_id}
                onValueChange={handlePatronalChange}
                disabled={!form.unidade_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={form.unidade_id ? "Selecione o patronal" : "Selecione uma unidade primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {patronaisVinculados.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                  {patronaisVinculados.length === 0 && form.unidade_id && (
                    <div className="px-2 py-1 text-sm text-muted-foreground">
                      Nenhum sindicato patronal vinculado a esta unidade.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Sindicato Laboral */}
            <div className="space-y-2">
              <Label>Sindicato Laboral *</Label>
              <Select
                value={form.sindicato_laboral_id}
                onValueChange={handleLaboralChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o laboral" />
                </SelectTrigger>
                <SelectContent>
                  {sindicatos.filter(s => s.tipo === "laboral").map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ano e Mês */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ano Base *</Label>
                <Input
                  type="number"
                  value={form.ano}
                  onChange={(e) => setForm({ ...form, ano: parseInt(e.target.value) || new Date().getFullYear() })}
                  min={2000}
                  max={2100}
                />
              </div>
              <div className="space-y-2">
                <Label>Mês Base *</Label>
                <Select
                  value={form.mes.toString()}
                  onValueChange={(v) => setForm({ ...form, mes: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meses.map((nome, idx) => (
                      <SelectItem key={idx} value={(idx + 1).toString()}>{nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select
                value={form.tipo_documento}
                onValueChange={(v) => setForm({ ...form, tipo_documento: v as "act" | "cct" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="act">ACT (Acordo Coletivo de Trabalho)</SelectItem>
                  <SelectItem value="cct">CCT (Convenção Coletiva de Trabalho)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Arquivo */}
            <div className="space-y-2">
              <Label>Arquivo (PDF) {editando ? "(opcional)" : "*"}</Label>
              <Input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              {editando && arquivoAtual && !arquivo && (
                <p className="text-sm text-muted-foreground">
                  Mantendo arquivo atual: <span className="font-medium">{arquivoAtual}</span>
                </p>
              )}
              {arquivo && (
                <p className="text-sm text-green-600">Novo arquivo selecionado: {arquivo.name}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarNegociacao} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              {editando ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir negociação?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo associado também será removido. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluirNegociacao} className="bg-red-600 text-white hover:bg-red-700">
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}