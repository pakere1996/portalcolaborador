import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, FileText, Download, Eye, Trash2, Filter, X } from "lucide-react";
import { formatBR } from "@/lib/folga-rules";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Documento {
  id: string;
  tipo: string;
  subtipo?: string | null;
  quinzena?: number | null;
  mes: number;
  ano: number;
  storage_path: string;
  nome_pdf: string | null;
  created_at: string;
  colaborador_id: string;
}

interface Profile {
  id: string;
  nome: string;
  unidade_id?: string | null;
  tem_adiantamento_individual?: boolean;
}

interface DocumentosBaseProps {
  tipo: string;
  titulo: string;
  icone: React.ReactNode;
  descricao: string;
  importTitle: string;
}

const MESES = [
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

export function DocumentosBase({
  tipo,
  titulo,
  icone,
  descricao,
  importTitle,
}: DocumentosBaseProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [colaboradores, setColaboradores] = useState<Profile[]>([]);
  const [unidades, setUnidades] = useState<any[]>([]);

  // Filtros
  const [filtroColaborador, setFiltroColaborador] = useState<string>("todos");
  const [filtroAno, setFiltroAno] = useState<string>("todos");
  const [filtroMes, setFiltroMes] = useState<string>("todos");
  const [filtroSubtipo, setFiltroSubtipo] = useState<string>("todos");

  // Formulário de upload
  const [selectedColaborador, setSelectedColaborador] = useState<string>("");
  const [selectedMes, setSelectedMes] = useState<string>("");
  const [selectedAno, setSelectedAno] = useState<string>("");
  const [selectedSubtipo, setSelectedSubtipo] = useState<"mensal" | "adiantamento">("mensal");
  const [selectedQuinzena, setSelectedQuinzena] = useState<1 | 2 | null>(null);
  const [file, setFile] = useState<File | null>(null);

  // Preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Documento | null>(null);

  const [anos, setAnos] = useState<number[]>([]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Buscar colaboradores (ativos)
      const { data: cols } = await supabase
        .from("profiles")
        .select("id, nome, unidade_id, tem_adiantamento_individual")
        .eq("ativo", true)
        .order("nome");

      // Buscar unidades
      const { data: unis } = await supabase.from("unidades").select("*");

      // Buscar documentos do tipo
      let query = supabase
        .from("documentos")
        .select("*")
        .eq("tipo", tipo);

      if (filtroColaborador !== "todos") {
        query = query.eq("colaborador_id", filtroColaborador);
      }
      if (filtroAno !== "todos") {
        query = query.eq("ano", parseInt(filtroAno));
      }
      if (filtroMes !== "todos") {
        query = query.eq("mes", parseInt(filtroMes));
      }
      if (filtroSubtipo !== "todos") {
        query = query.eq("subtipo", filtroSubtipo);
      }

      const { data: docs, error } = await query
        .order("ano", { ascending: false })
        .order("mes", { ascending: false });

      if (error) throw error;

      setColaboradores(cols ?? []);
      setUnidades(unis ?? []);
      setDocumentos(docs ?? []);

      const anosSet = new Set(docs?.map(d => d.ano) ?? []);
      setAnos(Array.from(anosSet).sort((a, b) => b - a));
    } catch (error) {
      toast.error("Erro ao carregar dados", { description: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user, filtroColaborador, filtroAno, filtroMes, filtroSubtipo]);

  const resetUploadForm = () => {
    setSelectedColaborador("");
    setSelectedMes("");
    setSelectedAno("");
    setSelectedSubtipo("mensal");
    setSelectedQuinzena(null);
    setFile(null);
  };

  const colaboradorPodeAdiantamento = (colaboradorId: string) => {
    const col = colaboradores.find(c => c.id === colaboradorId);
    if (!col) return false;
    const unidade = unidades.find(u => u.id === col.unidade_id);
    return !!(unidade?.tem_adiantamento && col.tem_adiantamento_individual);
  };

  const handleUpload = async () => {
    if (!file) return toast.error("Selecione um arquivo");
    if (!selectedColaborador) return toast.error("Selecione um colaborador");
    if (!selectedMes) return toast.error("Selecione o mês");
    if (!selectedAno) return toast.error("Selecione o ano");

    if (selectedSubtipo === "adiantamento") {
      if (!selectedQuinzena) return toast.error("Selecione a quinzena");
      if (!colaboradorPodeAdiantamento(selectedColaborador)) {
        return toast.error("Este colaborador não tem direito a adiantamento.");
      }
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const mesStr = String(selectedMes).padStart(2, "0");
      const quinzenaStr = selectedSubtipo === "adiantamento" ? `_${selectedQuinzena}` : "";
      const fileName = `${selectedColaborador}/${selectedAno}/${mesStr}/${tipo}${quinzenaStr}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("documentos")
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from("documentos")
        .insert({
          colaborador_id: selectedColaborador,
          tipo: tipo,
          subtipo: selectedSubtipo,
          quinzena: selectedSubtipo === "adiantamento" ? selectedQuinzena : null,
          mes: parseInt(selectedMes),
          ano: parseInt(selectedAno),
          storage_path: fileName,
          nome_pdf: file.name,
        });

      if (insertError) throw insertError;

      toast.success("Documento enviado com sucesso!");
      resetUploadForm();
      load();
    } catch (error) {
      toast.error("Erro ao enviar", { description: (error as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: Documento) => {
    if (!confirm("Tem certeza que deseja excluir este documento?")) return;
    try {
      await supabase.storage.from("documentos").remove([doc.storage_path]);
      await supabase.from("documentos").delete().eq("id", doc.id);
      toast.success("Documento excluído");
      load();
    } catch (error) {
      toast.error("Erro ao excluir", { description: (error as Error).message });
    }
  };

  const handleDownload = async (doc: Documento) => {
    const { data } = await supabase.storage
      .from("documentos")
      .createSignedUrl(doc.storage_path, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    } else {
      toast.error("Erro ao gerar link de download");
    }
  };

  const handlePreview = async (doc: Documento) => {
    setSelectedDoc(doc);
    const { data } = await supabase.storage
      .from("documentos")
      .createSignedUrl(doc.storage_path, 60);
    if (data?.signedUrl) {
      setPreviewUrl(data.signedUrl);
      setPreviewOpen(true);
    } else {
      toast.error("Erro ao gerar link de visualização");
    }
  };

  const getSubtipoLabel = (doc: Documento) => {
    if (doc.tipo !== "contracheque") return "";
    if (doc.subtipo === "adiantamento") return `Adiantamento ${doc.quinzena}ª`;
    return "Mensal";
  };

  const getColaboradorNome = (id: string) => {
    return colaboradores.find(c => c.id === id)?.nome || "Desconhecido";
  };

  const limparFiltros = () => {
    setFiltroColaborador("todos");
    setFiltroAno("todos");
    setFiltroMes("todos");
    setFiltroSubtipo("todos");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            {icone} {titulo}
          </h1>
          <p className="text-muted-foreground mt-1">{descricao}</p>
        </div>
      </div>

      {/* Formulário de upload */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="size-5 text-primary" /> {importTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Colaborador *</Label>
              <Select value={selectedColaborador} onValueChange={setSelectedColaborador}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {colaboradores.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                      {colaboradorPodeAdiantamento(c.id) && " (Adiantamento)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mês *</Label>
              <Select value={selectedMes} onValueChange={setSelectedMes}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ano *</Label>
              <Select value={selectedAno} onValueChange={setSelectedAno}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(a => (
                    <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {tipo === "contracheque" && (
              <>
                <div className="space-y-2">
                  <Label>Subtipo *</Label>
                  <Select
                    value={selectedSubtipo}
                    onValueChange={(v: "mensal" | "adiantamento") => {
                      setSelectedSubtipo(v);
                      if (v === "mensal") setSelectedQuinzena(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="adiantamento">Adiantamento Quinzenal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedSubtipo === "adiantamento" && (
                  <div className="space-y-2">
                    <Label>Quinzena *</Label>
                    <Select value={selectedQuinzena?.toString() || ""} onValueChange={(v) => setSelectedQuinzena(Number(v) as 1 | 2)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1ª Quinzena</SelectItem>
                        <SelectItem value="2">2ª Quinzena</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            <div className="space-y-2 md:col-span-3">
              <Label>Arquivo *</Label>
              <Input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="cursor-pointer"
              />
              {file && <p className="text-sm text-muted-foreground">{file.name}</p>}
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleUpload} disabled={uploading || !file}>
              {uploading ? "Enviando..." : <><Upload className="size-4 mr-2" /> Enviar</>}
            </Button>
            <Button variant="ghost" onClick={resetUploadForm}>Limpar</Button>
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card className="border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="size-5 text-muted-foreground" /> Filtros
          </CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Colaborador</Label>
              <Select value={filtroColaborador} onValueChange={setFiltroColaborador}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {colaboradores.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Mês</Label>
              <Select value={filtroMes} onValueChange={setFiltroMes}>
                <SelectTrigger className="w-[120px] h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {MESES.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Ano</Label>
              <Select value={filtroAno} onValueChange={setFiltroAno}>
                <SelectTrigger className="w-[100px] h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {anos.map(a => (
                    <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {tipo === "contracheque" && (
              <div className="space-y-1">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Subtipo</Label>
                <Select value={filtroSubtipo} onValueChange={setFiltroSubtipo}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="adiantamento">Adiantamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={limparFiltros} className="mt-6 h-9">
              Limpar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {documentos.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              Nenhum documento encontrado.
            </div>
          ) : (
            <div className="space-y-3">
              {documentos.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <FileText className="size-5" />
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {getColaboradorNome(doc.colaborador_id)}
                        {doc.subtipo && (
                          <Badge variant="outline" className={doc.subtipo === "adiantamento" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"}>
                            {getSubtipoLabel(doc)}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {String(doc.mes).padStart(2, "0")}/{doc.ano}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handlePreview(doc)}>
                      <Eye className="size-4 mr-1" /> Visualizar
                    </Button>
                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 hover:bg-primary/5" onClick={() => handleDownload(doc)}>
                      <Download className="size-4 mr-1" /> Baixar
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(doc)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de visualização */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Visualização do Documento</DialogTitle>
            <DialogDescription>
              {selectedDoc
                ? `${getColaboradorNome(selectedDoc.colaborador_id)} - ${String(selectedDoc.mes).padStart(2, "0")}/${selectedDoc.ano}`
                : "Documento"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-[500px] bg-muted/20 rounded-lg overflow-hidden">
            {previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full h-[600px] border-0"
                title="Visualização do documento"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Carregando visualização...
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button>
            <Button onClick={() => { if (selectedDoc) handleDownload(selectedDoc); }}>
              <Download className="size-4 mr-1" /> Baixar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}