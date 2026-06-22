"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldAlert, FileText, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBR } from "@/lib/folga-rules";
import { formatDisciplinarTipo } from "@/lib/documentos-regulatorios";

interface RegistroDisciplinar {
  id: string;
  colaborador_id: string;
  tipo: string;
  data_ocorrencia: string;
  observacao: string | null;
  storage_path: string | null;
  storage_type: string | null;
  created_at: string;
}

export default function DocumentosDisciplinar() {
  const { user } = useAuth();
  const [registros, setRegistros] = useState<RegistroDisciplinar[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("registros_disciplinares")
      .select("*")
      .eq("colaborador_id", user.id)
      .order("data_ocorrencia", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar registros", { description: error.message });
    } else {
      setRegistros(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const handleDownload = async (path: string) => {
    if (!path) return toast.error("Documento não disponível");
    const { data } = await supabase.storage
      .from("documentos_admin")
      .createSignedUrl(path, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    } else {
      toast.error("Erro ao gerar link de download");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="size-6 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <ShieldAlert className="size-6 text-primary" /> Registros Disciplinares
        </h1>
        <p className="text-muted-foreground mt-1">
          Histórico de advertências, suspensões e outras ocorrências.
        </p>
      </div>

      {registros.length === 0 ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-green-700">Parabéns!</h2>
          <p className="text-green-600 mt-2">
            Você não possui nenhum registro disciplinar. Continue mantendo uma boa conduta!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {registros.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                    {formatDisciplinarTipo(r.tipo)}
                  </Badge>
                  <span className="text-sm text-muted-foreground ml-3">
                    {formatBR(new Date(r.data_ocorrencia + "T00:00:00"))}
                  </span>
                </div>
                {r.storage_path && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(r.storage_path!)}
                    className="text-blue-600"
                  >
                    <FileText className="size-4 mr-1" /> Ver documento
                  </Button>
                )}
              </div>
              {r.observacao && (
                <div className="rounded-xl bg-muted/40 p-3 text-sm">
                  {r.observacao}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
