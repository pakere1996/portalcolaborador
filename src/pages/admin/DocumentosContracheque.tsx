import { FileText } from "lucide-react";
import { DocumentosBase } from "@/components/DocumentosBase";

export default function DocumentosContracheque() {
  return (
    <DocumentosBase
      tipo="contracheque"
      titulo="Contracheques"
      icone={<FileText className="size-6 text-primary" />}
      descricao="Importe e gerencie contracheques mensais dos colaboradores."
      importTitle="Importar Contracheque"
    />
  );
}