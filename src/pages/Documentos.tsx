import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileText, Download, Eye, Loader2, AlertCircle } from "lucide-react";
import { Documento, DocumentType, getDocumentTypeLabel } from "@/lib/documentos";

const routeTypeMap: Record<string, DocumentType> = {
  "/documentos": "contracheque",
  "/documentos/ponto": "folha_ponto",
};

export default function DocumentosPage() {
  const { user } = useAuth();
  const location = useLocation();
  const tipo = routeTypeMap[location.pathname] ?? "contracheque";

  const [docs, setDocs] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadDocs();
  }, [user?.id, tipo]);

  const loadDocs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("documentos")
        .select("*")
        .eq("colaborador_id", user.id)
        .eq("tipo", tipo)
        .order("ano", { ascending: false })
        .order("mes", { ascending: false });

      if (error) throw error;
      setDocs((data ?? []) as Documento[]);
    } catch {
      toast.error("Erro ao carregar documentos");
    } finally {
      setLoading(false);
    }
  };

  const openPreview = async (doc: Documento) => {
    setPreviewUrl("");
    setPreviewLoading(true);

    try {
      const { data, error } = await supabase.storage.from("documentos").createSignedUrl(doc.storage_path, 300);
      if (error) throw error;
      setPreviewUrl(data.signedUrl);
    } catch {
      toast.error("Erro ao carregar documento");
    } finally {
      setPreviewLoading(false);
    }
  };

  const downloadDoc = async (doc: Documento) => {
    try {
      const { data, error } = await supabase.storage.from("documentos").createSignedUrl(doc.storage_path, 300);
      if (error) throw error;

      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.download = doc.nome_pdf;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      toast.error("Erro ao baixar documento");
    }
  };

  const groupedDocs = useMemo(() => {
    return docs.reduce((acc, doc) => {
      const key = `${doc.ano}-${String(doc.mes).padStart(2, "0")}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(doc);
      return acc;
    }, {} as Record<string, Documento[]>);
  }, [docs]);

  const getStatusBadge = (status: string) => {
    if (status === "vinculado") {
      return <Badge className="bg-green-100 text-green-700 border-green-200">Disponível</Badge>;
    }
    return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Pendente</Badge>;
  };

  if (!user) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <FileText className="size-6 text-primary" /> Meus {getDocumentTypeLabel(tipo)}
        </h1>
        <p className="text-muted-foreground mt-1">
          Esta página mostra apenas {getDocumentTypeLabel(tipo).toLowerCase()}.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Carregando documentos...</span>
        </div>
      ) : docs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="size-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum documento encontrado</h3>
            <p className="text-muted-foreground">
              Seus documentos aparecerão aqui assim que forem enviados pela administração.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedDocs).map(([periodo, groupDocs]) => {
            const [ano, mes] = periodo.split("-");

            return (
              <div key={periodo}>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <FileText className="size-5 text-primary" />
                  {new Date(Number(ano), Number(mes) - 1, 1).toLocaleDateString("pt-BR", {
                    month: "long",
                    year: "numeric",
                  })}
                </h2>

                <div className="grid gap-4">
                  {groupDocs.map((doc) => (
                    <Card key={doc.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-4 min-w-0">
                            <FileText className="size-5 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <div className="font-medium truncate">{doc.nome_pdf}</div>
                              <div className="text-sm text-muted-foreground">
                                {String(doc.mes).padStart(2, "0")}/{doc.ano}
                              </div>
                            </div>
                            {getStatusBadge(doc.status)}
                          </div>

                          <div className="flex gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => openPreview(doc)}>
                                  <Eye className="size-4 mr-1" /> Visualizar
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl">
                                <DialogHeader>
                                  <DialogTitle>{doc.nome_pdf}</DialogTitle>
                                </DialogHeader>
                                {previewLoading ? (
                                  <div className="flex items-center justify-center py-12">
                                    <Loader2 className="size-8 animate-spin text-primary" />
                                    <span className="ml-2 text-muted-foreground">Carregando...</span>
                                  </div>
                                ) : previewUrl ? (
                                  <div className="border rounded-lg overflow-hidden">
                                    <iframe src={previewUrl} className="w-full h-[70vh]" title={doc.nome_pdf} />
                                  </div>
                                ) : (
                                  <div className="text-center py-12 text-muted-foreground">
                                    <AlertCircle className="size-8 mx-auto mb-2" />
                                    Não foi possível carregar o documento
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>

                            <Button variant="outline" size="sm" onClick={() => downloadDoc(doc)}>
                              <Download className="size-4 mr-1" /> Baixar
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}