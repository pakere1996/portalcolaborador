"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentPreviewProps {
  path?: string;
  kind?: string;
  className?: string;
}

export function DocumentPreview({ path, kind, className }: DocumentPreviewProps) {
  const [url, setUrl] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;

    let cancelled = false;
    setError(null);

    supabase.storage
      .from("documentos")
      .createSignedUrl(path, 300)
      .then(({ data, error: signedError }) => {
        if (cancelled) return;
        if (signedError) {
          setError(signedError.message);
          return;
        }
        setUrl(data.signedUrl);
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!path) {
    return (
      <div className={cn("flex items-center justify-center rounded-xl border border-dashed p-6 text-sm text-muted-foreground", className)}>
        Sem arquivo vinculado
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive", className)}>
        <AlertTriangle className="size-4 shrink-0" />
        Não foi possível carregar o arquivo.
      </div>
    );
  }

  if (!url) {
    return (
      <div className={cn("flex items-center justify-center gap-2 rounded-xl border p-8 text-sm text-muted-foreground", className)}>
        <Loader2 className="size-4 animate-spin" />
        Carregando visualização...
      </div>
    );
  }

  if (kind === "pdf") {
    return (
      <div className={cn("overflow-hidden rounded-xl border bg-white", className)}>
        <iframe src={url} title="Visualização do documento" className="h-96 w-full" />
      </div>
    );
  }

  if (kind === "image") {
    return (
      <div className={cn("overflow-hidden rounded-xl border bg-white p-2", className)}>
        <img src={url} alt="Documento" className="h-96 w-full rounded-lg object-contain" />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3 rounded-xl border p-4 text-sm text-muted-foreground", className)}>
      {kind === "pdf" ? <FileText className="size-5" /> : <ImageIcon className="size-5" />}
      Tipo de arquivo não identificado.
    </div>
  );
}