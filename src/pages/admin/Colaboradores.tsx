// ... existing code ...
  const filteredAndSortedList = useMemo(() => {
    let filtered = list;

    // 1. Filtragem
    if (filterName) {
// ... existing code ...
    if (filterUnidade !== "all") {
      if (filterUnidade === "null") {
        filtered = filtered.filter(p => p.unidade_id === null);
      } else {
        filtered = filtered.filter(p => p.unidade_id === filterUnidade);
      }
    }
    if (filterFolga !== "all") {
      if (filterFolga === "null") {
        filtered = filtered.filter(p => p.folga_fixa_semana === null);
      } else {
        const folgaNum = Number(filterFolga);
        filtered = filtered.filter(p => p.folga_fixa_semana === folgaNum);
      }
    }
    if (filterStatus !== "all") {
// ... existing code ...