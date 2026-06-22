import { FileText } from "lucide-react";
import { DocumentosBase } from "@/components/DocumentosBase";

export default function DocumentosAdiantamento() {
  return (
    <DocumentosBase
      tipo="adiantamento"
      titulo="Adiantamentos Quinzenais"
      icone={<FileText className="size-6 text-primary" />}
      descricao="Gerencie os adiantamentos quinzenais dos colaboradores."
      importTitle="Importar Adiantamento"
    />
  );
}