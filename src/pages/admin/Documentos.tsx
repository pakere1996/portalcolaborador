import { FileText } from "lucide-react";
import { DocumentImportForm } from "@/components/DocumentImportForm";

export default function DocumentosAdminPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <FileText className="size-6 text-primary" /> Documentos Administrativos
        </h1>
        <p className="text-muted-foreground mt-1">
          Cadastre, visualize, baixe ou remova documentos vinculados a colaboradores.
        </p>
      </div>

      <DocumentImportForm onSuccess={() => window.location.reload()} />
    </div>
  );
}