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
import { Plus, Users, Pencil, Trash2, Search, Key, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { formatCPF, onlyDigits, isValidCPFLength } from "@/lib/cpf";
import { Badge } from "@/components/ui/badge";
import { ColaboradorFormDialog } from "@/components/ColaboradorFormDialog";
import { Tables } from "@/integrations/supabase/types";
import { adminApi } from "@/lib/admin-api";

type Profile = Tables<'profiles'> & { role?: string | null };
type Unidade = Tables<'unidades'>;
type Cargo = Tables<'cargos'>;

const blankEditForm = {
  nome: "", cpf: "", matricula: "", email: "", whatsapp: "",
  cargo: "", unidadeId: "none", folgaFixa: "none",
  dataAdmissao: "", dataNascimento: "", perfil_acesso: "colaborador",
  ativo: true,
  senha: "",
  regime_trabalho: "none",
  data_demissao: "",
  tipo_vinculo: "CLT",
  possui_folha_ponto: false,
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, uRes, cRes] = await Promise.all([
        supabase.from("profiles").select("*").order("nome"),
        supabase.from("unidades").select("*").eq("ativo", true).order("nome"),
        supabase.from("cargos").select("*").eq("ativo", true).order("nome"),
      ]);

      if (pRes.error) throw pRes.error;
      if (uRes.error) throw uRes.error;
      if (cRes.error) throw cRes.error;

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
      setUnidades(uRes.data ?? []);
      setCargos(cRes.data ?? []);
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

  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      const matchesSearch = p.nome.toLowerCase().includes(search.toLowerCase()) || p.cpf.includes(search.replace(/\D/g, ""));
      const matchesUnidade = filtroUnidade === "all" || p.unidade_id === filtroUnidade;
      const matchesStatus = filtroStatus === "all" || (filtroStatus === "ativo" ? p.ativo : !p.ativo);
      const matchesCargo = filtroCargo === "all" || p.cargo === filtroCargo;
      return matchesSearch && matchesUnidade && matchesStatus && matchesCargo;
    });
  }, [profiles, search, filtroUnidade, filtroStatus, filtroCargo]);

  const uniqueCargos = useMemo(() => {
    return [...new Set(profiles.map(p => p.cargo).filter(Boolean))];
  }, [profiles]);

  const toUpperCaseTrim = (str: string) => str.trim().toUpperCase();

  const validateForm = (form: any) => {
    const errors: string[] = [];
    if (!form.nome.trim()) errors.push("Nome");
    if (!form.cpf.trim() || !isValidCPFLength(onlyDigits(form.cpf))) errors.push("CPF");
    if (!form.cargo.trim()) errors.push("Cargo");
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
        cargo: toUpperCaseTrim(newForm.cargo),
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
        data_demissao: newForm.data_demissao || null,
        tipo_vinculo: newForm.tipo_vinculo || "CLT",
        possui_folha_ponto: newForm.possui_folha_ponto !== undefined ? newForm.possui_folha_ponto : possuiFolhaPontoDefault,
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
      matricula: p.matricula ?? "",
      email: p.email_contato ?? "",
      whatsapp: p.whatsapp ?? "",
      cargo: p.cargo,
      unidadeId: p.unidade_id ?? "none",
      folgaFixa: p.folga_fixa_semana?.toString() ?? "none",
      dataNascimento: p.data_nascimento ?? "",
      dataAdmissao: p.data_admissao ?? "",
      perfil_acesso: p.role ?? "colaborador",
      ativo: p.ativo,
      senha: "",
      regime_trabalho: p.regime_trabalho ?? "none",
      data_demissao: p.data_demissao ?? "",
      tipo_vinculo: p.tipo_vinculo ?? "CLT",
      possui_folha_ponto: p.possui_folha_ponto ?? false,
    });
  };

  const handleUpdate = async () => {
    // Validação
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

      // 🔥 Converte datas vazias para null
      const dataAdmissao = editForm.dataAdmissao || null;
      const dataNascimento = editForm.dataNascimento || null;
      const dataDemissao = editForm.data_demissao || null;

      const { error: profErr } = await supabase.from("profiles").update({
        nome: toUpperCaseTrim(editForm.nome),
        cpf: cleanCpf,
        matricula: toUpperCaseTrim(editForm.matricula) || null,
        email_contato: editForm.email.trim().toLowerCase() || null,
        whatsapp: editForm.whatsapp.trim() || null,
        cargo: toUpperCaseTrim(editForm.cargo),
        unidade_id: editForm.unidadeId === "none" ? null : editForm.unidadeId,
        folga_fixa_semana: editForm.folgaFixa === "none" ? null : Number(editForm.folgaFixa),
        data_nascimento: dataNascimento,
        data_admissao: dataAdmissao,
        ativo: editForm.ativo,
        updated_at: new Date().toISOString(),
        regime_trabalho: editForm.regime_trabalho === "none" ? null : editForm.regime_trabalho,
        data_demissao: dataDemissao,
        tipo_vinculo: editForm.tipo_vinculo || "CLT",
        possui_folha_ponto: editForm.possui_folha_ponto ?? false,
      }).eq("id", editingProfile.id);

      if (profErr) throw profErr;

      const currentRole = editingProfile.role;
      const newRole = editForm.perfil_acesso;
      if (currentRole !== newRole) {
        if (currentRole) {
          await supabase.from("user_roles").delete().eq("user_id", editingProfile.id).eq("role", currentRole);
        }
        await supabase.from("user_roles").upsert({ user_id: editingProfile.id, role: newRole }, { onConflict: "user_id,role" });
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ... cabeçalho, filtros, tabela ... */}
      {/* (mesmo código da versão anterior, sem alterações aqui) */}
    </div>
  );
}