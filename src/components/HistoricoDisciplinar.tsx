"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Loader2, FileText, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBR } from "@/lib/folga-rules";

// Estendendo a tipagem para garantir compatibilidade com colunas customizadas ou omitidas no esquema
type Ocorrencia = Tables<'registros_disciplinares'> & {
  responsavel: Pick<Tables<'profiles'>, 'nome'> | null;
  data_ocorrencia?: string | null;
  pdf_storage_path?: string | null;
  storage_path?: string | null;
  motivo?: string | null;
  descricao_detalhada?: string | null;
  tipo?: string | null;
};

const TIPOS_DISCIPLINA: Record<string, string> = {
  advertencia_verbal: "Advertência Verbal",
  advertencia_escrita: "Advertência Escrita",
  suspensao: "Suspensão",
  outros: "Outros",
};

export default function HistoricoDisciplinar() {
  const { user } = useAuth();
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistorico = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("registros_disciplinares")
        .select(`
          *,
          responsavel:responsavel_id(nome)
        `)
        .eq("colaborador_id", user.id)
        .order("data_ocorrencia", { ascending: false });

      if (error) throw error;
      
      setOcorrencias(data as Ocorrencia[]);
    } catch (e) {
      toast.error("Erro ao carregar histórico disciplinar", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadHistorico();
  }, [loadHistorico]);

  const downloadPdf = async (path: string) => {
    try {
      const { data, error } = await supabase.storage.from("documentos").createSignedUrl(path, 300);
      if (error) throw error;

      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.download = path.split('/').pop() || 'ocorrencia.pdf';
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      toast.error("Erro ao baixar PDF.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> Carregando histórico...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {ocorrencias.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <ShieldAlert className="size-12 mx-auto mb-2" />
          <p>Nenhuma ocorrência disciplinar registrada no seu histórico.</p>
        </div>
      ) : (
        ocorrencias.map((r) => {
          // Garante a leitura do caminho do PDF independente se a coluna for storage_path ou pdf_storage_path
          const documentoPath = r.storage_path || r.pdf_storage_path;
          const tipoOcorrencia = r.tipo ?? "outros";

          return (
            <div key={r.id} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-lg">{TIPOS_DISCIPLINA[tipoOcorrencia] || tipoOcorrencia}</div>
                  <div className="text-sm text-muted-foreground">
                    Registrado em {r.data_ocorrencia ? formatBR(new Date(r.data_ocorrencia + "T00:00:00")) : "Data não informada"}
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  {documentoPath ? (
                    <Button variant="outline" size="sm" onClick={() => downloadPdf(documentoPath)}>
                      <FileText className="size-4 mr-1" /> Baixar PDF
                    </Button>
                  ) : (
                    <Badge variant="destructive">Documento Pendente</Badge>
                  )}
                </div>
              </div>

              <div className="text-sm">
                <span className="font-semibold">Motivo:</span> {r.motivo ?? "Não informado"}
              </div>
              
              {r.descricao_detalhada && (
                <div className="rounded-xl bg-muted/40 p-3 text-sm">
                  <span className="font-semibold">Detalhes:</span> {r.descricao_detalhada}
                </div>
              )}
              
              <div className="text-xs text-muted-foreground pt-2 border-t mt-3">
                Registrado por: {r.responsavel?.nome || 'Admin'}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}