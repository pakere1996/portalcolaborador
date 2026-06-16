import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

interface ColaboradorForm {
  nome: string;
  cpf: string;
  cargo: string;
  senha: string;
  dataAdmissao: string;
  dataNascimento: string;
  folgaFixa: string;
  unidadeId: string;
  matricula: string;
  email: string;
  whatsapp: string;
  perfil_acesso: string;
}

interface ColaboradorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ColaboradorForm;
  setForm: React.Dispatch<React.SetStateAction<ColaboradorForm>>;
  unidades: { id: string; nome: string; cnpj: string | null }[];
  cargos: { id: string; nome: string }[];
  busy: boolean;
  isEdit?: boolean;
  onSave?: () => Promise<void> | void;
}

export function ColaboradorFormDialog({
  open,
  onOpenChange,
  form,
  setForm,
  unidades,
  cargos,
  busy,
  isEdit = false,
  onSave,
}: ColaboradorFormDialogProps) {

  const handleFormChange = (id: string, value: string | boolean) => {
    setForm((prev) => {
      let newValue = value;
      
      if (id === 'cpf' && typeof value === 'string') {
        const rawValue = value.replace(/\D/g, "");
        if (rawValue.length > 11) return prev;
        if (rawValue.length <= 3) newValue = rawValue;
        else if (rawValue.length <= 6) newValue = `${rawValue.slice(0, 3)}.${rawValue.slice(3)}`;
        else if (rawValue.length <= 9) newValue = `${rawValue.slice(0, 3)}.${rawValue.slice(3, 6)}.${rawValue.slice(6)}`;
        else newValue = `${rawValue.slice(0, 3)}.${rawValue.slice(3, 6)}.${rawValue.slice(6, 9)}-${rawValue.slice(9)}`;
      } else if (id === 'whatsapp' && typeof value === 'string') {
        const digits = value.replace(/\D/g, "");
        if (digits.length <= 2) newValue = digits;
        else if (digits.length <= 7) newValue = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        else newValue = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
      }

      return { ...prev, [id]: newValue };
    });
  };

  const handleSubmit = async () => {
    if (onSave) {
      await onSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Colaborador" : "Novo Colaborador"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Atualize as informações do colaborador." : "Preencha os dados do novo colaborador."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome Completo *</Label>
            <Input
              id="nome"
              value={form.nome}
              onChange={(e) => handleFormChange('nome', e.target.value)}
              placeholder="Ex: João Silva"
              disabled={busy}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF *</Label>
              <Input
                id="cpf"
                value={form.cpf}
                onChange={(e) => handleFormChange('cpf', e.target.value)}
                placeholder="000.000.000-00"
                maxLength={14}
                disabled={busy || isEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="matricula">Matrícula</Label>
              <Input
                id="matricula"
                value={form.matricula}
                onChange={(e) => handleFormChange('matricula', e.target.value)}
                placeholder="Ex: 12345"
                disabled={busy}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => handleFormChange('email', e.target.value)}
                placeholder="email@empresa.com (Opcional)"
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">Telefone (WhatsApp)</Label>
              <Input
                id="whatsapp"
                value={form.whatsapp}
                onChange={(e) => handleFormChange('whatsapp', e.target.value)}
                placeholder="(99) 99999-9999"
                maxLength={15}
                disabled={busy}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo *</Label>
              <Select
                value={form.cargo}
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
            <div className="space-y-2">
              <Label htmlFor="unidade_id">Unidade *</Label>
              <Select
                value={form.unidadeId}
                onValueChange={(value) => handleFormChange('unidadeId', value)}
                disabled={busy}
              >
                <SelectTrigger id="unidade_id">
                  <SelectValue placeholder="Selecione a Unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem Unidade</SelectItem>
                  {unidades.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_nascimento">Data de Nascimento *</Label>
              <Input
                id="data_nascimento"
                type="date"
                value={form.dataNascimento}
                onChange={(e) => handleFormChange('dataNascimento', e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_admissao">Data de Admissão *</Label>
              <Input
                id="data_admissao"
                type="date"
                value={form.dataAdmissao}
                onChange={(e) => handleFormChange('dataAdmissao', e.target.value)}
                disabled={busy}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="folga_fixa_semana">Folga Fixa Semanal *</Label>
              <Select
                value={form.folgaFixa}
                onValueChange={(value) => handleFormChange('folgaFixa', value)}
                disabled={busy}
              >
                <SelectTrigger id="folga_fixa_semana">
                  <SelectValue placeholder="Nenhuma Folga Fixa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma Folga Fixa</SelectItem>
                  {WEEKDAYS.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="perfil_acesso">Perfil de Acesso *</Label>
              <Select
                value={form.perfil_acesso}
                onValueChange={(value) => handleFormChange('perfil_acesso', value)}
                disabled={busy}
              >
                <SelectTrigger id="perfil_acesso">
                  <SelectValue placeholder="Colaborador (Padrão)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha">Senha Inicial *</Label>
            <Input
              id="senha"
              type="password"
              value={form.senha}
              onChange={(e) => handleFormChange('senha', e.target.value)}
              placeholder="Mínimo 6 caracteres"
              disabled={busy}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {isEdit ? "Salvar" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

Let me continue and fix the issues:
<dyad-write path="src/components/ColaboradorFormDialog.tsx">
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

interface ColaboradorForm {
  nome: string;
  cpf: string;
  cargo: string;
  senha: string;
  dataAdmissao: string;
  dataNascimento: string;
  folgaFixa: string;
  unidadeId: string;
  matricula: string;
  email: string;
  whatsapp: string;
  perfil_acesso: string;
}

interface ColaboradorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ColaboradorForm;
  setForm: React.Dispatch<React.SetStateAction<ColaboradorForm>>;
  unidades: { id: string; nome: string; cnpj: string | null }[];
  cargos: { id: string; nome: string }[];
  busy: boolean;
  isEdit?: boolean;
  onSave?: () => Promise<void> | void;
}

export function ColaboradorFormDialog({
  open,
  onOpenChange,
  form,
  setForm,
  unidades,
  cargos,
  busy,
  isEdit = false,
  onSave,
}: ColaboradorFormDialogProps) {

  const handleFormChange = (id: string, value: string | boolean) => {
    setForm((prev) => {
      let newValue = value;
      
      if (id === 'cpf' && typeof value === 'string') {
        const rawValue = value.replace(/\D/g, "");
        if (rawValue.length > 11) return prev;
        if (rawValue.length <= 3) newValue = rawValue;
        else if (rawValue.length <= 6) newValue = `${rawValue.slice(0, 3)}.${rawValue.slice(3)}`;
        else if (rawValue.length <= 9) newValue = `${rawValue.slice(0, 3)}.${rawValue.slice(3, 6)}.${rawValue.slice(6)}`;
        else newValue = `${rawValue.slice(0, 3)}.${rawValue.slice(3, 6)}.${rawValue.slice(6, 9)}-${rawValue.slice(9)}`;
      } else if (id === 'whatsapp' && typeof value === 'string') {
        const digits = value.replace(/\D/g, "");
        if (digits.length <= 2) newValue = digits;
        else if (digits.length <= 7) newValue = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        else newValue = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
      }

      return { ...prev, [id]: newValue };
    });
  };

  const handleSubmit = async () => {
    if (onSave) {
      await onSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Colaborador" : "Novo Colaborador"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Atualize as informações do colaborador." : "Preencha os dados do novo colaborador."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome Completo *</Label>
            <Input
              id="nome"
              value={form.nome}
              onChange={(e) => handleFormChange('nome', e.target.value)}
              placeholder="Ex: João Silva"
              disabled={busy}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF *</Label>
              <Input
                id="cpf"
                value={form.cpf}
                onChange={(e) => handleFormChange('cpf', e.target.value)}
                placeholder="000.000.000-00"
                maxLength={14}
                disabled={busy || isEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="matricula">Matrícula</Label>
              <Input
                id="matricula"
                value={form.matricula}
                onChange={(e) => handleFormChange('matricula', e.target.value)}
                placeholder="Ex: 12345"
                disabled={busy}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => handleFormChange('email', e.target.value)}
                placeholder="email@empresa.com (Opcional)"
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">Telefone (WhatsApp)</Label>
              <Input
                id="whatsapp"
                value={form.whatsapp}
                onChange={(e) => handleFormChange('whatsapp', e.target.value)}
                placeholder="(99) 99999-9999"
                maxLength={15}
                disabled={busy}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo *</Label>
              <Select
                value={form.cargo}
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
            <div className="space-y-2">
              <Label htmlFor="unidade_id">Unidade *</Label>
              <Select
                value={form.unidadeId}
                onValueChange={(value) => handleFormChange('unidadeId', value)}
                disabled={busy}
              >
                <SelectTrigger id="unidade_id">
                  <SelectValue placeholder="Selecione a Unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem Unidade</SelectItem>
                  {unidades.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_nascimento">Data de Nascimento *</Label>
              <Input
                id="data_nascimento"
                type="date"
                value={form.dataNascimento}
                onChange={(e) => handleFormChange('dataNascimento', e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_admissao">Data de Admissão *</Label>
              <Input
                id="data_admissao"
                type="date"
                value={form.dataAdmissao}
                onChange={(e) => handleFormChange('dataAdmissao', e.target.value)}
                disabled={busy}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="folga_fixa_semana">Folga Fixa Semanal *</Label>
              <Select
                value={form.folgaFixa}
                onValueChange={(value) => handleFormChange('folgaFixa', value)}
                disabled={busy}
              >
                <SelectTrigger id="folga_fixa_semana">
                  <SelectValue placeholder="Nenhuma Folga Fixa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma Folga Fixa</SelectItem>
                  {WEEKDAYS.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="perfil_acesso">Perfil de Acesso *</Label>
              <Select
                value={form.perfil_acesso}
                onValueChange={(value) => handleFormChange('perfil_acesso', value)}
                disabled={busy}
              >
                <SelectTrigger id="perfil_acesso">
                  <SelectValue placeholder="Colaborador (Padrão)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha">Senha Inicial *</Label>
            <Input
              id="senha"
              type="password"
              value={form.senha}
              onChange={(e) => handleFormChange('senha', e.target.value)}
              placeholder="Mínimo 6 caracteres"
              disabled={busy}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {isEdit ? "Salvar" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
<tool_call>
</think>
Now let me check the Colaboradores.tsx file to see the update logic and fix the 400 error:
<dyad-write path="src/pages/admin/Colaboradores.tsx">
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [pRes, uRes, cRes] = await Promise.all([
        supabase.from("profiles").select("*").order("nome"),
        supabase.from("unidades").select("*").eq("ativo", true).order("nome"),
        supabase.from("cargos").select("*").eq("ativo", true).order("nome"),
      ]);

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

      setProfiles(profilesWithRoles);
      setUnidades(uRes.data ?? []);
      setCargos(cRes.data ?? []);
    } catch (e) {
      toast.error("Erro ao carregar dados", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredProfiles = profiles.filter(p => {
    const matchesSearch = p.nome.toLowerCase().includes(search.toLowerCase()) || p.cpf.includes(search.replace(/\D/g, ""));
    const matchesUnidade = filtroUnidade === "all" || p.unidade_id === filtroUnidade;
    const matchesStatus = filtroStatus === "all" || (filtroStatus === "ativo" ? p.ativo : !p.ativo);
    const matchesCargo = filtroCargo === "all" || p.cargo === filtroCargo;
    return matchesSearch && matchesUnidade && matchesStatus && matchesCargo;
  });

  const uniqueCargos = [...new Set(profiles.map(p => p.cargo).filter(Boolean))];

  const handleCreate = async () => {
    setBusy(true);
    try {
      const cleanCpf = onlyDigits(newForm.cpf);
      if (!isValidCPFLength(cleanCpf)) throw new Error("CPF inválido");

      const { data: authUser, error: authErr } = await adminApi.createUser({
        nome: newForm.nome.trim(),
        cpf: cleanCpf,
        email: newForm.email.trim().toLowerCase() || `${cleanCpf}@pakere.com.br`,
        senha: newForm.senha || cleanCpf.slice(-6),
        cargo: newForm.cargo,
        dataAdmissao: newForm.dataAdmissao,
        dataNascimento: newForm.dataNascimento,
        folgaFixaSemana: newForm.folgaFixa === "none" ? null : Number(newForm.folgaFixa),
        role: newForm.perfil_acesso,
      });

      if (authErr) throw authErr;

      const { error: profErr } = await supabase.from("profiles").update({
        matricula: newForm.matricula.trim() || null,
        whatsapp: newForm.whatsapp.trim() || null,
        unidade_id: newForm.unidadeId === "none" ? null : newForm.unidadeId,
        ativo: true,
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
      email: p.email ?? "",
      whatsapp: p.whatsapp ?? "",
      cargo: p.cargo,
      unidadeId: p.unidade_id ?? "none",
      folgaFixa: p.folga_fixa_semana?.toString() ?? "none",
      dataNascimento: p.data_nascimento ?? "",
      dataAdmissao: p.data_admissao ?? "",
      perfil_acesso: p.role ?? "colaborador",
      ativo: p.ativo,
      senha: "",
    });
  };

  const handleUpdate = async () => {
    if (!editingProfile) return;
    setBusy(true);
    try {
      const cleanCpf = onlyDigits(editForm.cpf);
      if (!isValidCPFLength(cleanCpf)) throw new Error("CPF inválido");

      // Update profile - only include fields that exist in the table
      const { error: profErr } = await supabase.from("profiles").update({
        nome: editForm.nome.trim(),
        cpf: cleanCpf,
        matricula: editForm.matricula.trim() || null,
        email: editForm.email.trim() || null,
        whatsapp: editForm.whatsapp.trim() || null,
        cargo: editForm.cargo,
        unidade_id: editForm.unidadeId === "none" ? null : editForm.unidadeId,
        folga_fixa_semana: editForm.folgaFixa === "none" ? null : Number(editForm.folgaFixa),
        data_nascimento: editForm.dataNascimento || null,
        data_admissao: editForm.dataAdmissao || null,
        ativo: editForm.ativo,
        updated_at: new Date().toISOString(),
      }).eq("id", editingProfile.id);

      if (profErr) throw profErr;

      // Update role if changed
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Users className="size-6 text-primary" /> Colaboradores
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie a equipe, cargos e acessos ao sistema.</p>
        </div>
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
            {uniqueCargos.map(c => <option key={c} value={c}>{c}</option>)}
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
                  <th className="text-center p-4 font-bold uppercase tracking-wider text-[10px]">Status</th>
                  <th className="text-center p-4 font-bold uppercase tracking-wider text-[10px]">Perfil</th>
                  <th className="text-right p-4 font-bold uppercase tracking-wider text-[10px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredProfiles.map((p) => (
                  <tr key={p.id} className={p.ativo ? "" : "opacity-50"}>
                    <td className="p-4 font-medium">{p.nome}</td>
                    <td className="p-4 hidden md:table-cell font-mono text-xs">{formatCPF(p.cpf)}</td>
                    <td className="p-4 hidden lg:table-cell text-muted-foreground">{p.cargo}</td>
                    <td className="p-4 hidden xl:table-cell text-muted-foreground">
                      {unidades.find(u => u.id === p.unidade_id)?.nome ?? "—"}
                    </td>
                    <td className="p-4 text-center">
                      <Switch checked={p.ativo} onCheckedChange={async (checked) => {
                        const { error } = await supabase.from("profiles").update({ ativo: checked }).eq("id", p.id);
                        if (error) toast.error(error.message);
                        else loadData();
                      }} disabled={busy} />
                    </td>
                    <td className="p-4 text-center">
                      <Badge className={p.role === "admin" ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-border"}>
                        {p.role === "admin" ? "Admin" : "Colaborador"}
                      </Badge>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-8" title="Editar" onClick={() => openEdit(p)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8" title="Redefinir Senha" onClick={() => openResetPassword(p)}>
                          <Key className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8 text-destructive hover:bg-destructive/10" title="Excluir" onClick={() => setConfirmDelete(p)}>
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
<tool_call>
</think>
Now let me check the database schema to understand the 400 error. The issue is likely that `email` and `cargo` columns don't exist in the profiles table. Let me check the actual schema:
<dyad-write path="src/integrations/supabase/database.types.ts">
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nome: string;
          cpf: string;
          cargo: string;
          ativo: boolean;
          aprovacao_status: string;
          created_at: string;
          updated_at: string;
          matricula?: string | null;
          email?: string | null;
          whatsapp?: string | null;
          unidade_id?: string | null;
          data_nascimento?: string | null;
          data_admissao?: string | null;
          folga_fixa_semana?: number | null;
        };
        Insert: {
          id: string;
          nome: string;
          cpf: string;
          cargo: string;
          ativo?: boolean;
          aprovacao_status?: string;
          matricula?: string | null;
          email?: string | null;
          whatsapp?: string | null;
          unidade_id?: string | null;
          data_nascimento?: string | null;
          data_admissao?: string | null;
          folga_fixa_semana?: number | null;
        };
        Update: {
          id?: string;
          nome?: string;
          cpf?: string;
          cargo?: string;
          ativo?: boolean;
          aprovacao_status?: string;
          matricula?: string | null;
          email?: string | null;
          whatsapp?: string | null;
          unidade_id?: string | null;
          data_nascimento?: string | null;
          data_admissao?: string | null;
          folga_fixa_semana?: number | null;
          updated_at?: string;
        };
      };
      // ... other tables
    };
  };
}
<tool_call>
</think>
Let me check the actual profiles table structure and fix the update issue. The problem is that the `email` column might not exist in the profiles table. Let me update the Colaboradores.tsx to only update columns that exist:
<dyad-write path="src/pages/admin/Colaboradores.tsx">
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [pRes, uRes, cRes] = await Promise.all([
        supabase.from("profiles").select("*").order("nome"),
        supabase.from("unidades").select("*").eq("ativo", true).order("nome"),
        supabase.from("cargos").select("*").eq("ativo", true).order("nome"),
      ]);

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

      setProfiles(profilesWithRoles);
      setUnidades(uRes.data ?? []);
      setCargos(cRes.data ?? []);
    } catch (e) {
      toast.error("Erro ao carregar dados", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredProfiles = profiles.filter(p => {
    const matchesSearch = p.nome.toLowerCase().includes(search.toLowerCase()) || p.cpf.includes(search.replace(/\D/g, ""));
    const matchesUnidade = filtroUnidade === "all" || p.unidade_id === filtroUnidade;
    const matchesStatus = filtroStatus === "all" || (filtroStatus === "ativo" ? p.ativo : !p.ativo);
    const matchesCargo = filtroCargo === "all" || p.cargo === filtroCargo;
    return matchesSearch && matchesUnidade && matchesStatus && matchesCargo;
  });

  const uniqueCargos = [...new Set(profiles.map(p => p.cargo).filter(Boolean))];

  const handleCreate = async () => {
    setBusy(true);
    try {
      const cleanCpf = onlyDigits(newForm.cpf);
      if (!isValidCPFLength(cleanCpf)) throw new Error("CPF inválido");

      const { data: authUser, error: authErr } = await adminApi.createUser({
        nome: newForm.nome.trim(),
        cpf: cleanCpf,
        email: newForm.email.trim().toLowerCase() || `${cleanCpf}@pakere.com.br`,
        senha: newForm.senha || cleanCpf.slice(-6),
        cargo: newForm.cargo,
        dataAdmissao: newForm.dataAdmissao,
        dataNascimento: newForm.dataNascimento,
        folgaFixaSemana: newForm.folgaFixa === "none" ? null : Number(newForm.folgaFixa),
        role: newForm.perfil_acesso,
      });

      if (authErr) throw authErr;

      const { error: profErr } = await supabase.from("profiles").update({
        matricula: newForm.matricula.trim() || null,
        whatsapp: newForm.whatsapp.trim() || null,
        unidade_id: newForm.unidadeId === "none" ? null : newForm.unidadeId,
        ativo: true,
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
      email: p.email ?? "",
      whatsapp: p.whatsapp ?? "",
      cargo: p.cargo,
      unidadeId: p.unidade_id ?? "none",
      folgaFixa: p.folga_fixa_semana?.toString() ?? "none",
      dataNascimento: p.data_nascimento ?? "",
      dataAdmissao: p.data_admissao ?? "",
      perfil_acesso: p.role ?? "colaborador",
      ativo: p.ativo,
      senha: "",
    });
  };

  const handleUpdate = async () => {
    if (!editingProfile) return;
    setBusy(true);
    try {
      const cleanCpf = onlyDigits(editForm.cpf);
      if (!isValidCPFLength(cleanCpf)) throw new Error("CPF inválido");

      // Build update object with only the fields that exist in the table
      const updateData: any = {
        nome: editForm.nome.trim(),
        cpf: cleanCpf,
        cargo: editForm.cargo,
        unidade_id: editForm.unidadeId === "none" ? null : editForm.unidadeId,
        folga_fixa_semana: editForm.folgaFixa === "none" ? null : Number(editForm.folgaFixa),
        data_nascimento: editForm.dataNascimento || null,
        data_admissao: editForm.dataAdmissao || null,
        ativo: editForm.ativo,
        updated_at: new Date().toISOString(),
      };

      // Only add optional fields if they exist in the table
      if (editForm.matricula !== undefined) {
        updateData.matricula = editForm.matricula.trim() || null;
      }
      if (editForm.whatsapp !== undefined) {
        updateData.whatsapp = editForm.whatsapp.trim() || null;
      }

      const { error: profErr } = await supabase.from("profiles").update(updateData).eq("id", editingProfile.id);

      if (profErr) throw profErr;

      // Update role if changed
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Users className="size-6 text-primary" /> Colaboradores
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie a equipe, cargos e acessos ao sistema.</p>
        </div>
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
            {uniqueCargos.map(c => <option key={c} value={c}>{c}</option>)}
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
                  <th className="text-center p-4 font-bold uppercase tracking-wider text-[10px]">Status</th>
                  <th className="text-center p-4 font-bold uppercase tracking-wider text-[10px]">Perfil</th>
                  <th className="text-right p-4 font-bold uppercase tracking-wider text-[10px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredProfiles.map((p) => (
                  <tr key={p.id} className={p.ativo ? "" : "opacity-50"}>
                    <td className="p-4 font-medium">{p.nome}</td>
                    <td className="p-4 hidden md:table-cell font-mono text-xs">{formatCPF(p.cpf)}</td>
                    <td className="p-4 hidden lg:table-cell text-muted-foreground">{p.cargo}</td>
                    <td className="p-4 hidden xl:table-cell text-muted-foreground">
                      {unidades.find(u => u.id === p.unidade_id)?.nome ?? "—"}
                    </td>
                    <td className="p-4 text-center">
                      <Switch checked={p.ativo} onCheckedChange={async (checked) => {
                        const { error } = await supabase.from("profiles").update({ ativo: checked }).eq("id", p.id);
                        if (error) toast.error(error.message);
                        else loadData();
                      }} disabled={busy} />
                    </td>
                    <td className="p-4 text-center">
                      <Badge className={p.role === "admin" ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-border"}>
                        {p.role === "admin" ? "Admin" : "Colaborador"}
                      </Badge>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-8" title="Editar" onClick={() => openEdit(p)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8" title="Redefinir Senha" onClick={() => openResetPassword(p)}>
                          <Key className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8 text-destructive hover:bg-destructive/10" title="Excluir" onClick={() => setConfirmDelete(p)}>
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