import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Download, Eye, Loader2 } from "lucide-react";
import { formatBR } from "@/lib/folga-rules";
import { toast } from "sonner";

interface Documento {
  id: string;
  colaborador_id: string;
  tipo: string;
  mes: number;
  ano: number;
  storage_path: string;
  status: string;
  nome_pdf: string | null;
  created_at: string;
  aprovado_em?: string | null;
}

const TIPO_LABEL: Record<string, string> = {
  contracheque: "Contracheque",
  ponto: "Folha de Ponto",
};

export default function Documentos() {
  const { user } = useAuth();
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("documentos")
      .select("*")
      .eq("colaborador_id", user.id)
      .order("ano", { ascending: false })
      .order("mes", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar documentos", { description: error.message });
    } else {
      setDocumentos(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const handleView = async (doc: Documento) => {
    const { data } = await supabase.storage
      .from("documentos")
      .createSignedUrl(doc.storage_path, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    } else {
      toast.error("Erro ao abrir documento");
    }
  };

  const handleDownload = async (doc: Documento) => {
    setDownloading(doc.id);
    try {
      const { data } = await supabase.storage
        .from("documentos")
        .createSignedUrl(doc.storage_path, 60);
      if (data?.signedUrl) {
        // Abre em nova aba para download
        const link = document.createElement("a");
        link.href = data.signedUrl;
        link.target = "_blank";
        link.download = `${doc.tipo}_${doc.mes}_${doc.ano}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        toast.error("Erro ao gerar link de download");
      }
    } catch (error) {
      toast.error("Erro ao baixar documento");
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="size-6 animate-spin mr-2" /> Carregando documentos...
      </div>
    );
  }

  if (documentos.length === 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <FileText className="size-6 text-primary" /> Meus Documentos
          </h1>
          <p className="text-muted-foreground mt-1">
            Acesse e baixe seus contracheques, folhas de ponto e outros documentos.
          </p>
        </div>
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
          Nenhum documento disponível.
        </div>
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

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Histórico de Documentos</h2>
        {documentos.map((doc) => {
          const tipoLabel = TIPO_LABEL[doc.tipo] || doc.tipo;
          const competencia = `${String(doc.mes).padStart(2, "0")}/${doc.ano}`;
          const isDisponivel = doc.status === "disponivel" || doc.status === "vinculado";

          return (
            <div
              key={doc.id}
              className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="size-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{tipoLabel}</div>
                  <div className="text-sm text-muted-foreground">{competencia}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  title="Visualizar"
                  onClick={() => handleView(doc)}
                  disabled={!isDisponivel}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Eye className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  title="Baixar"
                  onClick={() => handleDownload(doc)}
                  disabled={!isDisponivel || downloading === doc.id}
                  className="text-green-600 hover:text-green-700"
                >
                  {downloading === doc.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                </Button>
                {!isDisponivel && (
                  <Badge variant="outline" className="text-muted-foreground text-[10px]">
                    Indisponível
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}