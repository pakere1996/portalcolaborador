import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileText, Download, Eye, Filter } from "lucide-react";
import { formatBR } from "@/lib/folga-rules";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Documento {
  id: string;
  tipo: string;
  mes: number;
  ano: number;
  storage_path: string;
  nome_pdf: string | null;
  created_at: string;
}

const TIPOS_DOCUMENTO = [
  { value: "todos", label: "Todos" },
  { value: "contracheque", label: "Contracheque" },
  { value: "ponto", label: "Folha de Ponto" },
];

export default function Documentos() {
  const { user } = useAuth();
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [filteredDocs, setFilteredDocs] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Documento | null>(null);
  
  // Filtros
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroCompetencia, setFiltroCompetencia] = useState("todos");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("documentos")
        .select("*")
        .eq("colaborador_id", user.id)
        .order("ano", { ascending: false })
        .order("mes", { ascending: false });

      if (error) throw error;
      setDocumentos(data ?? []);
      setFilteredDocs(data ?? []);
    } catch (error) {
      toast.error("Erro ao carregar documentos", { description: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  // Aplicar filtros
  useEffect(() => {
    let docs = [...documentos];
    
    if (filtroTipo !== "todos") {
      docs = docs.filter(d => d.tipo === filtroTipo);
    }
    
    if (filtroCompetencia !== "todos") {
      const [mes, ano] = filtroCompetencia.split("/");
      docs = docs.filter(d => d.mes === parseInt(mes) && d.ano === parseInt(ano));
    }
    
    setFilteredDocs(docs);
  }, [documentos, filtroTipo, filtroCompetencia]);

  // Opções de competência (únicas)
  const competencias = [...new Set(documentos.map(d => `${String(d.mes).padStart(2, "0")}/${d.ano}`))].sort((a, b) => {
    const [mesA, anoA] = a.split("/").map(Number);
    const [mesB, anoB] = b.split("/").map(Number);
    if (anoA !== anoB) return anoB - anoA;
    return mesB - mesA;
  });

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

  const getTipoLabel = (tipo: string) => {
    if (tipo === "contracheque") return "Contracheque";
    if (tipo === "ponto") return "Folha de Ponto";
    return tipo;
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
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="size-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Documento</Label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_DOCUMENTO.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Competência</Label>
              <Select value={filtroCompetencia} onValueChange={setFiltroCompetencia}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a competência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {competencias.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Documentos</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDocs.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              {documentos.length === 0 
                ? "Nenhum documento disponível." 
                : "Nenhum documento encontrado com os filtros selecionados."}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDocs.map((doc) => (
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