import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { User, Search, ArrowUpDown, Loader2, Plus, Pencil, Trash2, KeyRound, UserX, UserCheck, Check, X, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { adminApi } from "@/lib/admin-api";
import { NovoColaboradorDialog } from "@/components/NovoColaboradorDialog";

// Tipagem assumida para o perfil com a unidade join
type Profile = Tables<'profiles'> & {
  unidade: Tables<'unidades'> | null;
};
type Unidade = Tables<'unidades'>;
type Cargo = { nome: string }; // Redefinido para refletir a estrutura de dados necessária

type EditForm = {
  nome: string;
  cargo: string;
  folga_fixa_semana: string; // Use string for select input
  unidade_id: string; // Use string for select input
  ativo: boolean;
};

const blankEditForm: EditForm = {
  nome: "",
  cargo: "",
  folga_fixa_semana: "null",
  unidade_id: "null",
  ativo: true,
};

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
  const [busy, setBusy] = useState(false);

  // Edit/Delete State
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(blankEditForm);

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
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("*, unidade:unidade_id(id, nome)")
      .order("nome");

    if (profilesError) {
      console.error("[Colaboradores] Erro na consulta de perfis:", profilesError);
      toast.error("Erro ao carregar colaboradores.", { description: profilesError.message });
    } else {
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

    // 3. Fetch Cargos: Buscando cargos distintos da tabela profiles
    const { data: cargosData, error: cargosError } = await supabase
      .from("profiles")
      .select("cargo", { distinct: true })
      .order("cargo");
    
    if (cargosError) {
      console.error("[Colaboradores] Erro na consulta de cargos:", cargosError);
    } else {
      // Mapeando o resultado [{ cargo: 'Nome' }] para [{ nome: 'Nome' }]
      const distinctCargos = cargosData.map(item => ({ nome: item.cargo }));
      setCargos(distinctCargos);
      console.log(`[Colaboradores] Cargos carregados: ${distinctCargos.length}`);
      console.log("[Colaboradores] Opções de Cargos:", distinctCargos.map(c => c.nome));
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
    
    console.log(`[Colaboradores] Registros após filtros: ${sorted.length}`);
    return sorted;
  }, [list, filterName, filterUnidade, filterFolga, filterStatus, sortOrder]);

  // --- Handlers ---

  const openEdit = (profile: Profile) => {
    console.log("[Colaboradores] Abrindo edição para:", profile.nome);
    console.log("[Colaboradores] Cargo atual do colaborador:", profile.cargo);
    setEditingProfile(profile);
    setEditForm({
      nome: profile.nome,
      cargo: profile.cargo,
      folga_fixa_semana: profile.folga_fixa_semana !== null ? String(profile.folga_fixa_semana) : "null",
      unidade_id: profile.unidade_id || "null",
      ativo: profile.ativo,
    });
  };

  const handleFormChange = (id: keyof EditForm, value: string | boolean) => {
    setEditForm(prev => ({ ...prev, [id]: value }));
  };

  const saveEdit = async () => {
    if (!editingProfile) return;
    if (!editForm.nome.trim() || !editForm.cargo.trim()) {
      return toast.error("Nome e Cargo são obrigatórios.");
    }
    setBusy(true);

    const updateData: Tables<'profiles'>['Update'] = {
      nome: editForm.nome.trim(),
      cargo: editForm.cargo.trim(),
      folga_fixa_semana: editForm.folga_fixa_semana === "null" ? null : Number(editForm.folga_fixa_semana),
      unidade_id: editForm.unidade_id === "null" ? null : editForm.unidade_id,
      ativo: editForm.ativo,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", editingProfile.id);

      if (error) throw error;

      toast.success("Perfil atualizado com sucesso.");
      setEditingProfile(null);
      setEditForm(blankEditForm);
      loadData();
    } catch (e) {
      toast.error("Erro ao atualizar perfil", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (profile: Profile) => {
    setBusy(true);
    const newStatus = !profile.ativo;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ ativo: newStatus, aprovacao_status: newStatus ? 'aprovado' : 'inativo' })
        .eq("id", profile.id);

      if (error) throw error;

      toast.success(`Colaborador ${newStatus ? 'ativado' : 'inativado'} com sucesso.`);
      loadData();
    } catch (e) {
      toast.error("Erro ao alterar status", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async (profile: Profile) => {
    if (!confirm(`Tem certeza que deseja resetar a senha de ${profile.nome}? Uma nova senha será enviada para o e-mail de cadastro.`)) {
      return;
    }
    setBusy(true);
    try {
      // Nota: O admin-api.ts usa uma Edge Function para resetar a senha
      await adminApi.resetPassword(profile.id, "NovaSenhaTemporaria123"); // A Edge Function deve gerar e enviar a senha
      toast.success("Solicitação de reset de senha enviada.", { description: `Uma instrução de recuperação de senha foi enviada para o e-mail do usuário.` });
    } catch (e) {
      toast.error("Erro ao resetar senha", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      // Nota: O admin-api.ts usa uma Edge Function para deletar o usuário (auth + profile)
      await adminApi.deleteUser(confirmDelete.id);
      
      toast.success("Colaborador excluído permanentemente.");
      setConfirmDelete(null);
      loadData();
    } catch (e) {
      toast.error("Erro ao excluir colaborador", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <User className="size-6 text-primary" /> Colaboradores
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie os perfis e acessos dos colaboradores.</p>
        </div>
        <NovoColaboradorDialog 
          unidades={unidades} 
          cargos={cargos} 
          onSuccess={loadData} 
        />
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações para {profile.nome}</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          
                          <DropdownMenuItem onClick={() => openEdit(profile)} disabled={busy}>
                            <Pencil className="mr-2 size-4" /> Editar Perfil
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem onClick={() => handleResetPassword(profile)} disabled={busy}>
                            <KeyRound className="mr-2 size-4" /> Resetar Senha
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          {profile.ativo ? (
                            <DropdownMenuItem onClick={() => handleToggleActive(profile)} disabled={busy}>
                              <UserX className="mr-2 size-4 text-red-600" /> Inativar Colaborador
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleToggleActive(profile)} disabled={busy}>
                              <UserCheck className="mr-2 size-4 text-green-600" /> Ativar Colaborador
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuSeparator />

                          <DropdownMenuItem 
                            onClick={() => setConfirmDelete(profile)} 
                            className="text-red-600 focus:text-red-600"
                            disabled={busy}
                          >
                            <Trash2 className="mr-2 size-4" /> Excluir Permanentemente
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingProfile} onOpenChange={(o) => { if (!o) { setEditingProfile(null); setEditForm(blankEditForm); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Colaborador: {editingProfile?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input 
                id="nome" 
                value={editForm.nome} 
                onChange={(e) => handleFormChange('nome', e.target.value)} 
                disabled={busy}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Cargo */}
              <div className="space-y-2">
                <Label htmlFor="cargo">Cargo</Label>
                <Select 
                  value={editForm.cargo} 
                  onValueChange={(value) => handleFormChange('cargo', value)}
                  disabled={busy}
                >
                  <SelectTrigger id="cargo">
                    <SelectValue placeholder="Selecione o Cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    {cargos.map(c => (
                      <SelectItem key={c.nome} value={c.nome}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Unidade */}
              <div className="space-y-2">
                <Label htmlFor="unidade_id">Unidade</Label>
                <Select 
                  value={editForm.unidade_id} 
                  onValueChange={(value) => handleFormChange('unidade_id', value)}
                  disabled={busy}
                >
                  <SelectTrigger id="unidade_id">
                    <SelectValue placeholder="Selecione a Unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="null">Sem Unidade</SelectItem>
                    {unidades.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Folga Fixa */}
            <div className="space-y-2">
              <Label htmlFor="folga_fixa_semana">Folga Fixa Semanal</Label>
              <Select 
                value={editForm.folga_fixa_semana} 
                onValueChange={(value) => handleFormChange('folga_fixa_semana', value)}
                disabled={busy}
              >
                <SelectTrigger id="folga_fixa_semana">
                  <SelectValue placeholder="Nenhuma Folga Fixa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Nenhuma Folga Fixa</SelectItem>
                  {Object.entries(dayOfWeekMap).map(([key, value]) => (
                    <SelectItem key={key} value={key}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Switch 
                id="ativo" 
                checked={editForm.ativo} 
                onCheckedChange={(checked) => handleFormChange('ativo', checked)} 
                disabled={busy}
              />
              <Label htmlFor="ativo">Colaborador Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEditingProfile(null); setEditForm(blankEditForm); }} disabled={busy}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={busy}>{busy ? "Salvando..." : "Salvar Alterações"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Colaborador: {confirmDelete?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir permanentemente o colaborador "{confirmDelete?.nome}"? Esta ação é irreversível e removerá o perfil e o acesso do usuário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-red-600 text-white hover:bg-red-700" disabled={busy}>
              {busy ? "Excluindo..." : "Excluir Permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}