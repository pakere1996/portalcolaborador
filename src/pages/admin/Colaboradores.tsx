"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Users, Plus, Trash2, Edit, Save, X, Building, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";

type Profile = Tables<'profiles'>;
type Unidade = Tables<'unidades'>;

export default function AdminColaboradores() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [colaboradores, setColaboradores] = useState<Profile[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [formData, setFormData] = useState<Partial<Profile>>({
    nome: "",
    cpf: "",
    cargo: "Funcionário",
    ativo: true,
    folga_fixa_semana: null,
    unidade_id: null,
    tem_adiantamento_individual: false,
  });

  const load = async () => {
    setLoading(true);
    try {
      const [colRes, uniRes] = await Promise.all([
        supabase.from("profiles").select("*").order("nome"),
        supabase.from("unidades").select("*").order("nome"),
      ]);
      setColaboradores(colRes.data ?? []);
      setUnidades(uniRes.data ?? []);
    } catch (error) {
      toast.error("Erro ao carregar dados");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setFormData({
      nome: "",
      cpf: "",
      cargo: "Funcionário",
      ativo: true,
      folga_fixa_semana: null,
      unidade_id: null,
      tem_adiantamento_individual: false,
    });
    setEditandoId(null);
    setCriando(false);
  };

  const handleSave = async () => {
    if (!formData.nome?.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!formData.cpf?.trim()) {
      toast.error("CPF é obrigatório");
      return;
    }
    if (!formData.unidade_id) {
      toast.error("Selecione uma unidade");
      return;
    }

    try {
      if (editandoId) {
        const { error } = await supabase
          .from("profiles")
          .update({
            nome: formData.nome,
            cpf: formData.cpf,
            cargo: formData.cargo || "Funcionário",
            ativo: formData.ativo,
            folga_fixa_semana: formData.folga_fixa_semana || null,
            unidade_id: formData.unidade_id,
            tem_adiantamento_individual: formData.tem_adiantamento_individual || false,
          })
          .eq("id", editandoId);
        if (error) throw error;
        toast.success("Colaborador atualizado");
      } else {
        // Criação via admin: usar auth.admin.createUser ou inserir diretamente?
        // Como estamos usando Supabase Auth, o ideal é criar o usuário primeiro.
        // Para simplificar, vamos assumir que o usuário já existe e estamos apenas criando o perfil.
        // Mas para criar um novo colaborador, normalmente se usa a função de admin do Supabase.
        // Aqui vou apenas inserir no profiles, mas o usuário precisa existir em auth.users.
        // Para este exemplo, vou considerar que o admin já criou o usuário via convite.
        // Na prática, você pode usar supabase.auth.admin.createUser ou um fluxo de convite.
        // Vou apenas alertar que o usuário precisa existir.
        toast.warning("Criação de novo colaborador requer que o usuário já exista no Auth.");
        return;
      }
      resetForm();
      load();
    } catch (error) {
      toast.error("Erro ao salvar", { description: (error as Error).message });
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja desativar este colaborador?")) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ ativo: false })
        .eq("id", id);
      if (error) throw error;
      toast.success("Colaborador desativado");
      load();
    } catch (error) {
      toast.error("Erro ao desativar", { description: (error as Error).message });
    }
  };

  const startEdit = (col: Profile) => {
    setEditandoId(col.id);
    setFormData({
      nome: col.nome,
      cpf: col.cpf,
      cargo: col.cargo || "Funcionário",
      ativo: col.ativo,
      folga_fixa_semana: col.folga_fixa_semana,
      unidade_id: col.unidade_id,
      tem_adiantamento_individual: col.tem_adiantamento_individual || false,
    });
    setCriando(false);
  };

  // Verifica se a unidade selecionada tem adiantamento
  const unidadeSelecionada = unidades.find(u => u.id === formData.unidade_id);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Users className="size-6 text-primary" /> Colaboradores
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie os colaboradores e suas permissões.</p>
        </div>
        <Button onClick={() => { resetForm(); setCriando(true); }}>
          <Plus className="size-4 mr-2" /> Novo Colaborador
        </Button>
      </div>

      {/* Formulário */}
      {(criando || editandoId) && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {editandoId ? "Editar Colaborador" : "Novo Colaborador"}
            </h2>
            <Button variant="ghost" size="icon" onClick={resetForm}>
              <X className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome || ""}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf">CPF *</Label>
              <Input
                id="cpf"
                value={formData.cpf || ""}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                placeholder="000.000.000-00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo</Label>
              <Input
                id="cargo"
                value={formData.cargo || ""}
                onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                placeholder="Funcionário"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unidade">Unidade *</Label>
              <Select
                value={formData.unidade_id || ""}
                onValueChange={(value) => setFormData({ ...formData, unidade_id: value, tem_adiantamento_individual: false })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="folga_fixa_semana">Dia da folga fixa (semanal)</Label>
              <Select
                value={formData.folga_fixa_semana?.toString() || ""}
                onValueChange={(value) => setFormData({ ...formData, folga_fixa_semana: value ? parseInt(value) : null })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  <SelectItem value="1">Segunda-feira</SelectItem>
                  <SelectItem value="2">Terça-feira</SelectItem>
                  <SelectItem value="3">Quarta-feira</SelectItem>
                  <SelectItem value="4">Quinta-feira</SelectItem>
                  <SelectItem value="5">Sexta-feira</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ativo">Status</Label>
              <div className="flex items-center gap-3 pt-1">
                <Switch
                  id="ativo"
                  checked={formData.ativo !== false}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                />
                <span className="text-sm text-muted-foreground">
                  {formData.ativo !== false ? "Ativo" : "Inativo"}
                </span>
              </div>
            </div>

            {/* Campo condicional: adiantamento individual */}
            {unidadeSelecionada?.tem_adiantamento && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="tem_adiantamento_individual">Tem direito a adiantamento quinzenal?</Label>
                <div className="flex items-center gap-3 pt-1">
                  <Switch
                    id="tem_adiantamento_individual"
                    checked={formData.tem_adiantamento_individual || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, tem_adiantamento_individual: checked })}
                  />
                  <span className="text-sm text-muted-foreground">
                    {formData.tem_adiantamento_individual ? "Sim" : "Não"}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  A unidade <b>{unidadeSelecionada?.nome}</b> oferece adiantamento no dia {unidadeSelecionada?.dia_adiantamento}.
                  Habilite se este colaborador tem direito.
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSave}>
              <Save className="size-4 mr-2" /> {editandoId ? "Atualizar" : "Criar"}
            </Button>
            <Button variant="ghost" onClick={resetForm}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : colaboradores.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhum colaborador cadastrado.</div>
        ) : (
          <div className="divide-y divide-border">
            {colaboradores.map((col) => {
              const unidade = unidades.find(u => u.id === col.unidade_id);
              return (
                <div key={col.id} className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-muted/10">
                  <div className="flex items-center gap-4 flex-1 min-w-[200px]">
                    <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="size-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        {col.nome}
                        {col.ativo ? (
                          <CheckCircle className="size-4 text-emerald-500" />
                        ) : (
                          <XCircle className="size-4 text-rose-500" />
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                        <span>{col.cpf}</span>
                        <span>•</span>
                        <span>{col.cargo || "Funcionário"}</span>
                        {unidade && <span>• {unidade.nome}</span>}
                        {col.tem_adiantamento_individual && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            Adiantamento
                          </Badge>
                        )}
                        {col.folga_fixa_semana !== null && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            Folga: {["Seg", "Ter", "Qua", "Qui", "Sex"][col.folga_fixa_semana - 1]}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(col)}>
                      <Edit className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(col.id)}
                      disabled={!col.ativo}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}