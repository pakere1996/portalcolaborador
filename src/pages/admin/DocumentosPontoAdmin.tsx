import { Clock } from "lucide-react";
import { DocumentosBase } from "@/components/DocumentosBase";

export default function DocumentosPontoAdmin() {
  return (
    <DocumentosBase
      tipo="ponto"
      titulo="Folhas de Ponto"
      icone={<Clock className="size-6 text-primary" />}
      descricao="Importe e gerencie as folhas de ponto dos colaboradores."
      importTitle="Importar Folhas de Ponto"
    />
  );
}