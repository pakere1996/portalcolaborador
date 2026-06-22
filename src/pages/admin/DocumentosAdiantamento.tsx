import { FileText } from "lucide-react";
import { DocumentosBase } from "@/components/DocumentosBase";

export default function DocumentosAdiantamento() {
  return (
    <DocumentosBase
      tipo="adiantamento"
      titulo="Adiantamentos Quinzenais"
      icone={<FileText className="size-6 text-primary" />}
      descricao="Importe e gerencie adiantamentos quinzenais dos colaboradores."
      importTitle="Importar Adiantamento"
      colunasExtras={(doc) => {
        if (doc.quinzena) {
          return (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              {doc.quinzena}ª Quinzena
            </span>
          );
        }
        return null;
      }}
    />
  );
}
