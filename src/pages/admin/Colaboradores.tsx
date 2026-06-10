import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { User, Search, ArrowUpDown, Loader2, Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Tipagem assumida para o perfil com a unidade join
type Profile = Tables<'profiles'> & {
  unidade: Tables<'unidades'> | null;
};
type Unidade = Tables<'unidades'>;
type Cargo = Tables<'cargos'>;

const statusMap: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  inativo: "Inativo",
};

const dayOfWeekMap: Record<number, string> = {
  0: "Domingo",
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
};

export default function Colaboradores() {
  const [list, setList] = useState<Profile[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [filterName, setFilterName] = useState("");
  const [filterUnidade, setFilterUnidade] = useState("all");
  const [filterFolga, setFilterFolga] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | "none">("none");

  const loadData = useCallback(async () => {
    setLoading(true);
    console.log("[Colaboradores] Iniciando consulta de dados...");
    
    // 1. Fetch Profiles (Colaboradores)
    // Tabela consultada: profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("*, unidade:unidade_id(id, nome)")
      .order("nome");

    if (profilesError) {
      // Erros do Supabase
      console.error("[Colaboradores] Erro na consulta de perfis:", profilesError);
      toast.error("Erro ao carregar colaboradores.", { description: profilesError.message });
    } else {
      // Quantidade de colaboradores retornados e resultado da consulta
      console.log(`[Colaboradores] Consulta de perfis bem-sucedida. Registros retornados: ${profilesData.length}`);
      console.log("[Colaboradores] Resultado da consulta:", profilesData);
      setList(profilesData as Profile[]);
    }

    // 2. Fetch Unidades
    const { data: unidadesData, error: unidadesError } = await supabase
      .from("unidades")
      .select("*")
      .order("nome");
    
    if (unidadesError) {
      console.error("[Colaboradores] Erro na consulta de unidades:", unidadesError);
    } else {
      setUnidades(unidadesData);
    }

    // 3. Fetch Cargos
    const { data: cargosData, error: cargosError } = await supabase
      .from("cargos")
      .select("*")
      .order("nome");
    
    if (cargosError) {
      console.error("[Colaboradores] Erro na consulta de cargos:", cargosError);
    } else {
      setCargos(cargosData);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredAndSortedList = useMemo(() => {
    let filtered = list;

    // 1. Filtragem
    if (filterName) {
      // Adicionando busca por CPF também
      filtered = filtered.filter(p => p.nome.toLowerCase().includes(filterName.toLowerCase()) || p.cpf.includes(filterName));
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
    let sorted = [...filtered];
    
    if (sortOrder === "asc") {
      sorted = sorted.sort((a, b) => a.nome.localeCompare(b.nome));
    } else if (sortOrder === "desc") {
      sorted = sorted.sort((a, b) => b.nome.localeCompare(a.nome));
    }
    
    // Quantidade exibida após aplicação dos filtros
    console.log(`[Colaboradores] Registros após filtros: ${sorted.length}`);
    return sorted;
  }, [list, filterName, filterUnidade, filterFolga, filterStatus, sortOrder]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <User className="size-6 text-primary" /> Colaboradores
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie os perfis e acessos dos colaboradores.</p>
        </div>
        <Button className="rounded-full px-6">
            <Plus className="size-4 mr-2" /> Novo Colaborador
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-2">
          <Label htmlFor="searchName" className="sr-only">Buscar por Nome/CPF</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              id="searchName" 
              placeholder="Buscar por Nome ou CPF..." 
              className="pl-10"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
            />
          </div>
        </div>

        {/* Filter Unidade */}
        <div>
          <Label htmlFor="filterUnidade" className="text-xs text-muted-foreground block mb-1">Unidade</Label>
          <Select value={filterUnidade} onValueChange={setFilterUnidade}>
            <SelectTrigger id="filterUnidade">
              <SelectValue placeholder="Todas as Unidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Unidades</SelectItem>
              <SelectItem value="null">Sem Unidade</SelectItem>
              {unidades.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filter Folga Fixa */}
        <div>
          <Label htmlFor="filterFolga" className="text-xs text-muted-foreground block mb-1">Folga Fixa</Label>
          <Select value={filterFolga} onValueChange={setFilterFolga}>
            <SelectTrigger id="filterFolga">
              <SelectValue placeholder="Qualquer Dia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer Dia</SelectItem>
              <SelectItem value="null">Sem Folga Fixa</SelectItem>
              {Object.entries(dayOfWeekMap).map(([key, value]) => (
                <SelectItem key={key} value={key}>{value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filter Status */}
        <div>
          <Label htmlFor="filterStatus" className="text-xs text-muted-foreground block mb-1">Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger id="filterStatus">
              <SelectValue placeholder="Todos os Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              {Object.entries(statusMap).map(([key, value]) => (
                <SelectItem key={key} value={key}>{value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Collaborator List/Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] w-1/3">
                  <Button variant="ghost" className="p-0 h-auto" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                    Nome
                    <ArrowUpDown className="ml-2 size-3" />
                  </Button>
                </th>
                <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] hidden lg:table-cell">Cargo</th>
                <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] hidden md:table-cell">Unidade</th>
                <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] hidden sm:table-cell">Folga Fixa</th>
                <th className="text-center p-4 font-bold uppercase tracking-wider text-[10px]">Status</th>
                <th className="text-right p-4 font-bold uppercase tracking-wider text-[10px]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground">
                    <Loader2 className="size-6 animate-spin mx-auto mb-2" />
                    Carregando colaboradores...
                  </td>
                </tr>
              ) : filteredAndSortedList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground">
                    Nenhum colaborador encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredAndSortedList.map((profile) => (
                  <tr key={profile.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-medium">
                      {profile.nome}
                      <div className="text-xs text-muted-foreground mt-0.5 block lg:hidden">{profile.cargo}</div>
                    </td>
                    <td className="p-4 hidden lg:table-cell text-muted-foreground">
                      {profile.cargo}
                    </td>
                    <td className="p-4 hidden md:table-cell text-muted-foreground">
                      {profile.unidade?.nome || "—"}
                    </td>
                    <td className="p-4 hidden sm:table-cell text-muted-foreground">
                      {profile.folga_fixa_semana !== null ? dayOfWeekMap[profile.folga_fixa_semana] : "—"}
                    </td>
                    <td className="p-4 text-center">
                      <span className={cn(
                        "text-xs font-medium px-2 py-1 rounded-full",
                        profile.aprovacao_status === 'aprovado' && "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                        profile.aprovacao_status === 'pendente' && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
                        profile.aprovacao_status === 'rejeitado' && "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
                        profile.aprovacao_status === 'inativo' && "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
                      )}>
                        {statusMap[profile.aprovacao_status] || profile.aprovacao_status}
                      </span>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      {/* Placeholder for actions */}
                      <Button variant="ghost" size="icon" className="size-8" title="Editar">
                        <Pencil className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}