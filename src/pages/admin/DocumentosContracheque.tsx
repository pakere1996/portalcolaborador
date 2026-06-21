import { FileText } from "lucide-react";
import { DocumentosBase } from "@/components/DocumentosBase";

export default function DocumentosContracheque() {
  return (
    <DocumentosBase
      tipo="contracheque"
      titulo="Contracheques"
      icone={<FileText className="size-6 text-primary" />}
      descricao="Importe e gerencie contracheques dos colaboradores, incluindo adiantamentos quinzenais."
      importTitle="Importar Contracheque"
      // 🔥 Coluna extra para exibir subtipo (Mensal / Adiantamento)
      colunasExtras={(doc) => {
        const subtipo = doc.subtipo || "mensal";
        const quinzena = doc.quinzena;
        let label = subtipo === "quinzenal" ? "Adiantamento" : "Mensal";
        if (subtipo === "quinzenal" && quinzena) {
          label += ` (${quinzena}ª Quinzena)`;
        }
        return (
          <td className="p-4 text-center">
            <span className={`text-xs px-2 py-1 rounded-full ${
              subtipo === "quinzenal" 
                ? "bg-blue-100 text-blue-700 border border-blue-200" 
                : "bg-gray-100 text-gray-700 border border-gray-200"
            }`}>
              {label}
            </span>
          </td>
        );
      }}
      // 🔥 Filtro extra para subtipo (se desejar adicionar no futuro)
      // Campos extras para o formulário de importação (já estão no DocumentImportForm)
    />
  );
}