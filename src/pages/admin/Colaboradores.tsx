import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Users, Pencil, Trash2, Search, Key, Loader2, Eye, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { formatCPF, onlyDigits, isValidCPFLength } from "@/lib/cpf";
import { Badge } from "@/components/ui/badge";
import { ColaboradorFormDialog } from "@/components/ColaboradorFormDialog";
import { Tables } from "@/integrations/supabase/types";
import { adminApi } from "@/lib/admin-api";
import { FavoritarBotao } from "@/components/FavoritarBotao";

type Profile = Tables<"profiles"> & { role?: string | null };

type Unidade = Tables<"unidades">;
type Cargo = Tables<"cargos">;

const blankEditForm = {
  nome: "", cpf: "", matricula: "", email: "", whatsapp: "",
  cargo: "", unidadeId: "none", folgaFixa: "none",
  dataAdmissao: "", dataNascimento: "", perfil_acesso: "colaborador",
  ativo: true,
  senha: "",
  regime_trabalho: "none",
  dataDemissao: "",
  tipo_vinculo: "CLT",
  possui_folha_ponto: false,
  optante_adiantamento: false,
};

export default function Colaboradores() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [filtroUnidade, setFiltroUnidade] = useState("all");
  const [filtroStatus, setFiltroStatus] = useState("all");
  const [filtroCargo, setFiltroCargo] = useState("all");

  const [openNewDialog, setOpenNewDialog] = useState(false);
  const [newForm, setNewForm] = useState(blankEditForm);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState(blankEditForm);
  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null);
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{ profile: Profile; senha: string; confirmar: string } | null>(null);

  // 🔥 Estados para visualização
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewProfile, setViewProfile] = useState<Profile | null>(null);
  const [viewUnidadeNome, setViewUnidadeNome] = useState<string>("");
  const [viewCargoNome, setViewCargoNome] = useState<string>("");

  // 🔥 Cria um mapa de cargos para busca rápida (evita percorrer a lista toda)
  const cargosMap = useMemo(() => {
    const map = new Map<string, string>();
    cargos.forEach(c => map.set(c.id, c.nome));
    return map;
  }, [cargos]);

  // 🔥 Função para obter o nome do cargo (usando o mapa)
  const getCargoNome = useCallback((cargoId: string | null) => {
    if (!cargoId) return "—";
    const nome = cargosMap.get(cargoId);
    return nome || cargoId; // fallback: se não encontrar, mostra o ID
  }, [cargosMap]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 🔥 CARREGAR TODOS OS CARGOS (sem filtro de ativo)
      const [pRes, uRes, cRes] = await Promise.all([
        supabase.from("profiles").select("*").order("nome"),
        supabase.from("unidades").select("*").eq("ativo", true).order("nome"),
        supabase.from("cargos").select("*").order("nome"), // REMOVIDO o filtro eq("ativo", true)
      ]);

      if (pRes.error) throw pRes.error;
      if (uRes.error) throw uRes.error;
      if (cRes.error) throw cRes.error;

      // 🔥 LOG para verificar se os cargos foram carregados
      console.log("✅ Cargos carregados:", cRes.data?.length || 0, "registros");

      const profileIds = (pRes.data ?? []).map(p => p.id);
      let rolesMap = new Map<string, string[]>();
      if (profileIds.length > 0) {
        const { data: rolesData } = await supabase.from("user_roles").select("user_id, role").in("user_id", profileIds);
        rolesData?.forEach(r => {
          if (!rolesMap.has(r.user_id)) rolesMap.set(r.user_id, []);
          rolesMap.get(r.user_id)!.push(r.role);
        });
      }

      const profilesWithRoles = (pRes.data ?? []).map(p => ({
        ...p,
        role: rolesMap.get(p.id)?.[0] ?? null,
      }));

      const sortedProfiles = profilesWithRoles.sort((a, b) => {
        const unidadeA = uRes.data?.find(u => u.id === a.unidade_id)?.nome || "";
        const unidadeB = uRes.data?.find(u => u.id === b.unidade_id)?.nome || "";
        if (unidadeA !== unidadeB) return unidadeA.localeCompare(unidadeB);
        if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
        return a.nome.localeCompare(b.nome);
      });

      setProfiles(sortedProfiles);
      setUnidades((uRes.data ?? []) as Unidade[]);
      setCargos((cRes.data ?? []) as Cargo[]);
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
      toast.error("Erro ao carregar dados", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 🔥 Função para abrir visualização do colaborador
  const openViewDialog = async (p: Profile) => {
    setViewProfile(p);
    
    // Buscar nomes da unidade e cargo
    const unidade = unidades.find(u => u.id === p.unidade_id);
    setViewUnidadeNome(unidade?.nome || "—");
    
    // Usar a função auxiliar para obter o nome do cargo
    setViewCargoNome(getCargoNome(p.cargo));
    
    setViewDialogOpen(true);
  };

  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      const matchesSearch = p.nome.toLowerCase().includes(search.toLowerCase()) || p.cpf.includes(search.replace(/\D/g, ""));
      const matchesUnidade = filtroUnidade === "all" || p.unidade_id === filtroUnidade;
      const matchesStatus = filtroStatus === "all" || (filtroStatus === "ativo" ? p.ativo : !p.ativo);
      const matchesCargo = filtroCargo === "all" || p.cargo === filtroCargo;
      return matchesSearch && matchesUnidade && matchesStatus && matchesCargo;
    });
  }, [profiles, search, filtroUnidade, filtroStatus, filtroCargo]);

  // Para o filtro de cargo, exibir os nomes (mas o valor do select será o ID)
  const uniqueCargos = useMemo(() => {
    const ids = [...new Set(profiles.map(p => p.cargo).filter(Boolean))];
    return ids.map(id => {
      const nome = cargosMap.get(id);
      return { id, nome: nome || id };
    });
  }, [profiles, cargosMap]);

  const toUpperCaseTrim = (str: string) => str.trim().toUpperCase();

  const validateForm = (form: any) => {
    const errors: string[] = [];
    if (!form.nome?.trim()) errors.push("Nome");
    if (!form.cpf?.trim() || !isValidCPFLength(onlyDigits(form.cpf))) errors.push("CPF");
    if (!form.cargo?.trim()) errors.push("Cargo");
    if (!form.unidadeId || form.unidadeId === "none") errors.push("Unidade");
    if (!form.dataAdmissao) errors.push("Data de Admissão");
    if (!form.dataNascimento) errors.push("Data de Nascimento");
    return errors;
  };

  const handleCreate = async () => {
    const errors = validateForm(newForm);
    if (errors.length > 0) {
      toast.error("Campos obrigatórios pendentes", {
        description: `Preencha: ${errors.join(", ")}`,
        duration: 5000,
      });
      return;
    }

    setBusy(true);
    try {
      const cleanCpf = onlyDigits(newForm.cpf);
      if (!isValidCPFLength(cleanCpf)) throw new Error("CPF inválido");

      const { data: authUser, error: authErr } = await adminApi.createUser({
        nome: toUpperCaseTrim(newForm.nome),
        cpf: cleanCpf,
        email: newForm.email.trim().toLowerCase() || `${cleanCpf}@pakere.com.br`,
        senha: newForm.senha || cleanCpf.slice(-6),
        cargo: newForm.cargo, // JÁ DEVE SER O ID DO CARGO (UUID)
        dataAdmissao: newForm.dataAdmissao || null,
        dataNascimento: newForm.dataNascimento || null,
        folgaFixaSemana: newForm.folgaFixa === "none" ? null : Number(newForm.folgaFixa),
        role: newForm.perfil_acesso,
      });

      if (authErr) throw authErr;

      const unidadeSelecionada = unidades.find(u => u.id === newForm.unidadeId);
      const possuiFolhaPontoDefault = unidadeSelecionada?.possui_relogio_ponto || false;

      const { error: profErr } = await supabase.from("profiles").update({
        matricula: toUpperCaseTrim(newForm.matricula) || null,
        whatsapp: newForm.whatsapp.trim() || null,
        unidade_id: newForm.unidadeId === "none" ? null : newForm.unidadeId,
        ativo: true,
        regime_trabalho: newForm.regime_trabalho === "none" ? null : newForm.regime_trabalho,
        data_demissao: newForm.dataDemissao || null,
        tipo_vinculo: newForm.tipo_vinculo || "CLT",
        possui_folha_ponto: newForm.possui_folha_ponto !== undefined ? newForm.possui_folha_ponto : possuiFolhaPontoDefault,
        optante_adiantamento: newForm.optante_adiantamento || false,
      }).eq("id", authUser.userId);

      if (profErr) throw profErr;

      toast.success("Colaborador criado com sucesso!");
      setOpenNewDialog(false);
      setNewForm(blankEditForm);
      loadData();
    } catch (e) {
      toast.error("Erro ao criar colaborador", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (p: Profile) => {
    setEditingProfile(p);
    setEditForm({
      nome: p.nome,
      cpf: formatCPF(p.cpf),
      matricula: (p as any).matricula ?? "",
      email: p.email_contato ?? "",
      whatsapp: p.whatsapp ?? "",
      cargo: p.cargo, // O ID do cargo armazenado
      unidadeId: p.unidade_id ?? "none",
      folgaFixa: p.folga_fixa_semana?.toString() ?? "none",
      dataNascimento: p.data_nascimento ?? "",
      dataAdmissao: p.data_admissao ?? "",
      perfil_acesso: p.role ?? "colaborador",
      ativo: p.ativo,
      senha: "",
      regime_trabalho: p.regime_trabalho ?? "none",
      dataDemissao: (p as any).data_demissao ?? "",
      tipo_vinculo: (p as any).tipo_vinculo ?? "CLT",
      possui_folha_ponto: (p as any).possui_folha_ponto ?? false,
      optante_adiantamento: (p as any).optante_adiantamento ?? false,
    });
  };

  const handleUpdate = async () => {
    const errors = validateForm(editForm);
    if (errors.length > 0) {
      toast.error("Campos obrigatórios pendentes", {
        description: `Preencha: ${errors.join(", ")}`,
        duration: 5000,
      });
      return;
    }

    if (!editingProfile) return;
    setBusy(true);
    try {
      const cleanCpf = onlyDigits(editForm.cpf);
      if (!isValidCPFLength(cleanCpf)) throw new Error("CPF inválido");

      const { error: profErr } = await supabase.from("profiles").update({
        nome: toUpperCaseTrim(editForm.nome),
        cpf: cleanCpf,
        matricula: toUpperCaseTrim(editForm.matricula) || null,
        email_contato: editForm.email.trim().toLowerCase() || null,
        whatsapp: editForm.whatsapp.trim() || null,
        cargo: editForm.cargo, // O ID do cargo
        unidade_id: editForm.unidadeId === "none" ? null : editForm.unidadeId,
        folga_fixa_semana: editForm.folgaFixa === "none" ? null : Number(editForm.folgaFixa),
        data_nascimento: editForm.dataNascimento || null,
        data_admissao: editForm.dataAdmissao || null,
        ativo: editForm.ativo,
        updated_at: new Date().toISOString(),
        regime_trabalho: editForm.regime_trabalho === "none" ? null : editForm.regime_trabalho,
        data_demissao: editForm.dataDemissao || null,
        tipo_vinculo: editForm.tipo_vinculo || "CLT",
        possui_folha_ponto: editForm.possui_folha_ponto ?? false,
        optante_adiantamento: editForm.optante_adiantamento ?? false,
      }).eq("id", editingProfile.id);

      if (profErr) throw profErr;

      const currentRole = editingProfile.role;
      const newRole = editForm.perfil_acesso;
      if (currentRole !== newRole) {
        if (currentRole) {
          await supabase.from("user_roles").delete().eq("user_id", editingProfile.id).eq("role", currentRole);
        }
        if (newRole) {
          await supabase.from("user_roles").upsert({ user_id: editingProfile.id, role: newRole }, { onConflict: "user_id,role" });
        }
      }

      toast.success("Colaborador atualizado!");
      setEditingProfile(null);
      loadData();
    } catch (e) {
      toast.error("Erro ao atualizar", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await adminApi.deleteUser(confirmDelete.id);
      toast.success("Colaborador excluído.");
      setConfirmDelete(null);
      loadData();
    } catch (e) {
      toast.error("Erro ao excluir", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const openResetPassword = (p: Profile) => {
    setResetPasswordDialog({ profile: p, senha: "", confirmar: "" });
  };

  const doResetPassword = async () => {
    if (!resetPasswordDialog) return;
    if (resetPasswordDialog.senha !== resetPasswordDialog.confirmar) return toast.error("As senhas não conferem");
    if (resetPasswordDialog.senha.length < 6) return toast.error("Senha deve ter pelo menos 6 caracteres");
    setBusy(true);
    try {
      await adminApi.resetPassword(resetPasswordDialog.profile.id, resetPasswordDialog.senha);
      toast.success("Senha redefinida com sucesso!");
      setResetPasswordDialog(null);
    } catch (e) {
      toast.error("Erro ao redefinir senha", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  // ---------- Renderização ----------
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Users className="size-6 text-primary" /> Colaboradores
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie a equipe, cargos e acessos ao sistema.</p>
        </div>
        <div className="flex items-center gap-2">
          <FavoritarBotao rota="/admin/colaboradores" label="Colaboradores" icone="Users" />
          <Dialog open={openNewDialog} onOpenChange={setOpenNewDialog}>
            <DialogTrigger asChild>
              <Button className="rounded-full px-6"><Plus className="size-4 mr-2" /> Novo Colaborador</Button>
            </DialogTrigger>
            <ColaboradorFormDialog
              open={openNewDialog}
              onOpenChange={setOpenNewDialog}
              form={newForm}
              setForm={setNewForm}
              unidades={unidades}
              cargos={cargos}
              busy={busy}
              isEdit={false}
              onSave={handleCreate}
            />
          </Dialog>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap gap-4 items-end">
        <div className="space-y-2 flex-1 min-w-[200px]">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Nome ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Unidade</Label>
          <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)} className="bg-input border border-border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary w-[200px]">
            <option value="all">Todas</option>
            {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Status</Label>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="bg-input border border-border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary w-[160px]">
            <option value="all">Todos</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Cargo</Label>
          <select value={filtroCargo} onChange={(e) => setFiltroCargo(e.target.value)} className="bg-input border border-border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary w-[200px]">
            <option value="all">Todos</option>
            {uniqueCargos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">
            <Loader2 className="size-8 animate-spin mx-auto mb-2 text-primary" />
            Carregando colaboradores...
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">Nenhum colaborador encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px]">Colaborador</th>
                  <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] hidden md:table-cell">CPF</th>
                  <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] hidden lg:table-cell">Cargo</th>
                  <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] hidden xl:table-cell">Unidade</th>
                  <th className="text-center p-4 font-bold uppercase tracking-wider text-[10px]">Vínculo</th>
                  <th className="text-center p-4 font-bold uppercase tracking-wider text-[10px]">Status</th>
                  <th className="text-center p-4 font-bold uppercase tracking-wider text-[10px]">Perfil</th>
                  <th className="text-center p-4 font-bold uppercase tracking-wider text-[10px]">Folha Ponto</th>
                  <th className="text-right p-4 font-bold uppercase tracking-wider text-[10px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredProfiles.map((p) => (
                  <tr
                    key={p.id}
                    className={`${p.ativo ? "" : "opacity-50"} hover:bg-muted/20 transition-colors cursor-pointer`}
                    onClick={() => openViewDialog(p)}
                  >
                    <td className="p-4 font-medium">{p.nome}</td>
                    <td className="p-4 hidden md:table-cell font-mono text-xs">{formatCPF(p.cpf)}</td>
                    <td className="p-4 hidden lg:table-cell text-muted-foreground">
                      {getCargoNome(p.cargo)}
                    </td>
                    <td className="p-4 hidden xl:table-cell text-muted-foreground">
                      {unidades.find(u => u.id === p.unidade_id)?.nome ?? "—"}
                    </td>
                    <td className="p-4 text-center">
                      <Badge className={(p as any).tipo_vinculo === "Socio" ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-blue-100 text-blue-700 border-blue-200"}>
                        {(p as any).tipo_vinculo === "Socio" ? "Sócio" : (p as any).tipo_vinculo || "CLT"}
                      </Badge>
                    </td>
                    <td className="p-4 text-center">
                      <Switch checked={p.ativo} onCheckedChange={async (checked) => {
                        await supabase.from("profiles").update({ ativo: checked, updated_at: new Date().toISOString() }).eq("id", p.id);
                        loadData();
                      }} disabled={busy} onClick={(e) => e.stopPropagation()} />
                    </td>
                    <td className="p-4 text-center">
                      <Badge className={p.role === "admin" ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-border"}>
                        {p.role === "admin" ? "Admin" : "Colaborador"}
                      </Badge>
                    </td>
                    <td className="p-4 text-center">
                      {(p as any).possui_folha_ponto ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200">Sim</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Não</Badge>
                      )}
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          title="Editar"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(p);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          title="Redefinir Senha"
                          onClick={(e) => {
                            e.stopPropagation();
                            openResetPassword(p);
                          }}
                        >
                          <Key className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:bg-destructive/10"
                          title="Excluir"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete(p);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== DIALOG DE VISUALIZAÇÃO DO COLABORADOR ===== */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-5 text-primary" />
              {viewProfile?.nome || "Colaborador"}
            </DialogTitle>
          </DialogHeader>

          {viewProfile && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Nome</Label>
                  <p className="font-semibold">{viewProfile.nome}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">CPF</Label>
                  <p className="font-mono">{formatCPF(viewProfile.cpf)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Matrícula</Label>
                  <p className="font-mono">{(viewProfile as any).matricula || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Cargo</Label>
                  <p>{getCargoNome(viewProfile.cargo)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Unidade</Label>
                  <p>{viewUnidadeNome}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">E-mail</Label>
                  <p>{viewProfile.email_contato || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">WhatsApp</Label>
                  <p>{viewProfile.whatsapp || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Data de Admissão</Label>
                  <p>{viewProfile.data_admissao ? new Date(viewProfile.data_admissao + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Data de Nascimento</Label>
                  <p>{viewProfile.data_nascimento ? new Date(viewProfile.data_nascimento + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Folga Fixa Semanal</Label>
                  <p>
                    {viewProfile.folga_fixa_semana != null && viewProfile.folga_fixa_semana >= 0 && viewProfile.folga_fixa_semana < 7
                      ? ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][viewProfile.folga_fixa_semana]
                      : "Não definida"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Regime de Trabalho</Label>
                  <p>{viewProfile.regime_trabalho || "Não informado"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Tipo de Vínculo</Label>
                  <p>{(viewProfile as any).tipo_vinculo || "CLT"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Status</Label>
                  <p>{viewProfile.ativo ? "Ativo" : "Inativo"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Perfil de Acesso</Label>
                  <p>{viewProfile.role === "admin" ? "Administrador" : "Colaborador"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Folha de Ponto</Label>
                  <p>{(viewProfile as any).possui_folha_ponto ? "Sim" : "Não"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Optante por Adiantamento</Label>
                  <p>{(viewProfile as any).optante_adiantamento ? "Sim" : "Não"}</p>
                </div>
                {!viewProfile.ativo && (viewProfile as any).data_demissao && (
                  <div className="md:col-span-2">
                    <Label className="text-xs text-muted-foreground uppercase">Data de Demissão</Label>
                    <p>{new Date((viewProfile as any).data_demissao + "T00:00:00").toLocaleDateString("pt-BR")}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Fechar
            </Button>
            {viewProfile && (
              <Button
                onClick={() => {
                  setViewDialogOpen(false);
                  openEdit(viewProfile);
                }}
              >
                <Pencil className="size-4 mr-2" /> Editar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ColaboradorFormDialog
        open={!!editingProfile}
        onOpenChange={(open) => { if (!open) setEditingProfile(null); }}
        form={editForm}
        setForm={setEditForm}
        unidades={unidades}
        cargos={cargos}
        busy={busy}
        isEdit={true}
        onSave={handleUpdate}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {confirmDelete?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O usuário será removido do Auth e o perfil será excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-red-600 text-white hover:bg-red-700" disabled={busy}>
              {busy ? "Excluindo..." : "Excluir Permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!resetPasswordDialog} onOpenChange={(o) => !o && setResetPasswordDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redefinir senha de {resetPasswordDialog?.profile.nome}</AlertDialogTitle>
            <AlertDialogDescription>
              A nova senha será aplicada imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nova-senha">Nova Senha</Label>
              <Input id="nova-senha" type="password" value={resetPasswordDialog?.senha} onChange={(e) => setResetPasswordDialog({ ...resetPasswordDialog!, senha: e.target.value })} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmar-senha">Confirmar Senha</Label>
              <Input id="confirmar-senha" type="password" value={resetPasswordDialog?.confirmar} onChange={(e) => setResetPasswordDialog({ ...resetPasswordDialog!, confirmar: e.target.value })} placeholder="Repita a senha" />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doResetPassword} className="bg-primary text-white hover:bg-primary/90" disabled={busy}>
              {busy ? "Salvando..." : "Redefinir Senha"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}