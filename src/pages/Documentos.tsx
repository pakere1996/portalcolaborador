import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { FileText, Download, Eye, Filter, DownloadCloud } from "lucide-react";
import { formatBR } from "@/lib/folga-rules";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Documento {
  id: string;
  tipo: string;
  mes: number;
  ano: number;
  storage_path: string;
  nome_pdf: string | null;
  created_at: string;
}

const MESES = [
  { value: "todos", label: "Todos" },
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

export default function Documentos() {
  const { user } = useAuth();
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Documento | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroAno, setFiltroAno] = useState<string>("todos");
  const [filtroMes, setFiltroMes] = useState<string>("todos");

  const [anos, setAnos] = useState<number[]>([]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from("documentos")
        .select("*")
        .eq("colaborador_id", user.id);

      if (filtroTipo !== "todos") {
        query = query.eq("tipo", filtroTipo);
      }
      if (filtroAno !== "todos") {
        query = query.eq("ano", parseInt(filtroAno));
      }
      if (filtroMes !== "todos") {
        query = query.eq("mes", parseInt(filtroMes));
      }

      const { data, error } = await query
        .order("ano", { ascending: false })
        .order("mes", { ascending: false });

      if (error) throw error;
      setDocumentos(data ?? []);

      // Extrai anos disponíveis para filtros
      const anosSet = new Set(data?.map(d => d.ano) ?? []);
      setAnos(Array.from(anosSet).sort((a, b) => b - a));
    } catch (error) {
      toast.error("Erro ao carregar documentos", { description: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user, filtroTipo, filtroAno, filtroMes]);

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

  // 🔥 Função para baixar todos os documentos do filtro
  const handleDownloadAll = async () => {
    if (documentos.length === 0) {
      toast.warning("Nenhum documento para baixar");
      return;
    }

    setDownloadingAll(true);
    try {
      // Baixa um por um (abre em novas abas)
      for (const doc of documentos) {
        const { data } = await supabase.storage
          .from("documentos")
          .createSignedUrl(doc.storage_path, 60);
        if (data?.signedUrl) {
          window.open(data.signedUrl, "_blank");
        }
        // Pequeno delay para não sobrecarregar o navegador
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      toast.success(`${documentos.length} documento(s) baixado(s)!`);
    } catch (error) {
      toast.error("Erro ao baixar documentos", { description: (error as Error).message });
    } finally {
      setDownloadingAll(false);
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

  const getTipoLabel = (tipo: string) => {
    if (tipo === "contracheque") return "Contracheque";
    if (tipo === "ponto") return "Folha de Ponto";
    return tipo;
  };

  const limparFiltros = () => {
    setFiltroTipo("todos");
    setFiltroAno("todos");
    setFiltroMes("todos");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <FileText className="size-6 text-primary" /> Meus Documentos
        </h1>
        <p className="text-muted-foreground mt-1">
          Acesse e baixe seus contracheques, folhas de ponto e outros documentos vinculados.
        </p>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
          <CardTitle className="text-lg">Filtros</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Tipo</Label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="contracheque">Contracheque</SelectItem>
                  <SelectItem value="ponto">Folha de Ponto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Mês</Label>
              <Select value={filtroMes} onValueChange={setFiltroMes}>
                <SelectTrigger className="w-[120px] h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  {MESES.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Ano</Label>
              <Select value={filtroAno} onValueChange={setFiltroAno}>
                <SelectTrigger className="w-[100px] h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {anos.map(a => (
                    <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm" onClick={limparFiltros} className="mt-6 h-9">
              Limpar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {documentos.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              Nenhum documento encontrado com os filtros selecionados.
            </div>
          ) : (
            <div className="space-y-3">
              {/* 🔥 Botão de download múltiplo */}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadAll}
                  disabled={downloadingAll}
                  className="text-primary border-primary/30 hover:bg-primary/5"
                >
                  <DownloadCloud className="size-4 mr-1" />
                  {downloadingAll ? "Baixando..." : `Baixar todos (${documentos.length})`}
                </Button>
              </div>

              {documentos.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <FileText className="size-5" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {getTipoLabel(doc.tipo)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {String(doc.mes).padStart(2, "0")}/{doc.ano}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => handlePreview(doc)}
                    >
                      <Eye className="size-4 mr-1" /> Visualizar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:text-primary/80 hover:bg-primary/5"
                      onClick={() => handleDownload(doc)}
                    >
                      <Download className="size-4 mr-1" /> Baixar
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
                ? `${getTipoLabel(selectedDoc.tipo)} - ${String(selectedDoc.mes).padStart(2, "0")}/${selectedDoc.ano}`
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
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Fechar
            </Button>
            <Button
              onClick={() => {
                if (selectedDoc) handleDownload(selectedDoc);
              }}
            >
              <Download className="size-4 mr-1" /> Baixar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}