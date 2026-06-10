"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Download, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Documento, getDocumentTypeLabel } from "@/lib/documentos";
import { Tables } from "@/integrations/supabase/types";


export default function DocumentosPage() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDocuments = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Busca todos os documentos vinculados ao ID do usuário logado
      const { data, error } = await supabase
        .from("documentos")
        .select("*")
        .eq("colaborador_id", user.id)
        .order("ano", { ascending: false })
        .order("mes", { ascending: false });

      if (error) throw error;

      setDocs(data as Documento[]);
    } catch (e) {
      console.error("Erro ao carregar documentos:", e);
      toast.error("Erro ao carregar seus documentos.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const openPreview = async (doc: Documento) => {
    try {
      const { data, error } = await supabase.storage.from("documentos").createSignedUrl(doc.storage_path, 300);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch {
      toast.error("Erro ao carregar documento para visualização");
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

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Documentos</CardTitle>
          <CardDescription>
            Documentos mensais (Contracheques e Folhas de Ponto)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="size-6 animate-spin mx-auto mb-2" />
              Carregando documentos...
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="size-12 mx-auto mb-2" />
              <p>Nenhum documento encontrado no seu histórico.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {docs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg gap-4 flex-wrap">
                  <div className="flex items-center gap-4 min-w-0">
                    <FileText className="size-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{doc.nome_pdf}</div>
                      <div className="text-sm text-muted-foreground">
                        {getDocumentTypeLabel(doc.tipo)} - {String(doc.mes).padStart(2, "0")}/{doc.ano}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openPreview(doc)}>
                      <Eye className="size-4" />
                    </Button>
                    <Button size="sm" onClick={() => downloadDoc(doc)}>
                      <Download className="size-4" /> Baixar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}