import { FileText } from "lucide-react";
import { DocumentosBase } from "@/components/DocumentosBase";

export default function DocumentosAdiantamento() {
  return (
    <DocumentosBase
      tipo="adiantamento"
      titulo="Adiantamentos"
      icone={<FileText className="size-6 text-primary" />}
      descricao="Importe e gerencie adiantamentos salariais dos colaboradores."
      importTitle="Importar Adiantamentos"
    />
  );
}