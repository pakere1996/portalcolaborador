"use client";

import { DocumentImportForm } from "@/components/DocumentImportForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Upload } from "lucide-react";

export default function AdminDocumentosPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <FileText className="size-6 text-primary" /> Gestão de Documentos
        </h1>
        <p className="text-muted-foreground mt-1">
          Importe documentos para processamento e acompanhe o fluxo administrativo.
        </p>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="size-5 text-primary" />
            Importar Novo Documento
          </CardTitle>
          <CardDescription>
            Envie arquivos em PDF, DOC, DOCX, JPG ou PNG.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentImportForm />
        </CardContent>
      </Card>
    </div>
  );
}