// ... existing code ...
  const filteredAndSortedList = useMemo(() => {
    let filtered = list;

    // 1. Filtragem
    if (filterName) {
      filtered = filtered.filter(p => p.nome.toLowerCase().includes(filterName.toLowerCase()));
    }
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
      filtered = filtered.filter(p => p.aprovacao_status === filterStatus);
    }

    // 2. Ordenação
    if (sortOrder === "asc") {
      filtered = filtered.sort((a, b) => a.nome.localeCompare(b.nome));
    } else if (sortOrder === "desc") {
      filtered = filtered.sort((a, b) => b.nome.localeCompare(a.nome));
    }

    return filtered;
  }, [list, filterName, filterUnidade, filterFolga, filterStatus, sortOrder]);