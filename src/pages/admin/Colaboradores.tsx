import { useMemo, useState } from "react";

export default function Colaboradores() {
  const [list] = useState<
    Array<{
      id: string;
      nome: string;
      unidade_id: string | null;
      folga_fixa_semana: number | null;
      aprovacao_status: string;
    }>
  >([]);
  const [filterName] = useState("");
  const [filterUnidade] = useState("all");
  const [filterFolga] = useState("all");
  const [filterStatus] = useState("all");
  const [sortOrder] = useState<"asc" | "desc" | "none">("none");

  const filteredAndSortedList = useMemo(() => {
    let filtered = list;

    if (filterName) {
      filtered = filtered.filter((p) =>
        p.nome.toLowerCase().includes(filterName.toLowerCase()),
      );
    }

    if (filterUnidade !== "all") {
      if (filterUnidade === "null") {
        filtered = filtered.filter((p) => p.unidade_id === null);
      } else {
        filtered = filtered.filter((p) => p.unidade_id === filterUnidade);
      }
    }

    if (filterFolga !== "all") {
      if (filterFolga === "null") {
        filtered = filtered.filter((p) => p.folga_fixa_semana === null);
      } else {
        const folgaNum = Number(filterFolga);
        filtered = filtered.filter((p) => p.folga_fixa_semana === folgaNum);
      }
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter((p) => p.aprovacao_status === filterStatus);
    }

    if (sortOrder === "asc") {
      filtered = [...filtered].sort((a, b) => a.nome.localeCompare(b.nome));
    } else if (sortOrder === "desc") {
      filtered = [...filtered].sort((a, b) => b.nome.localeCompare(a.nome));
    }

    return filtered;
  }, [list, filterName, filterUnidade, filterFolga, filterStatus, sortOrder]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Colaboradores</h1>
        <p className="text-muted-foreground mt-1">
          Página restaurada para voltar a carregar corretamente.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          {filteredAndSortedList.length === 0
            ? "Nenhum colaborador para exibir."
            : `${filteredAndSortedList.length} colaborador(es) encontrado(s).`}
        </p>
      </div>
    </div>
  );
}