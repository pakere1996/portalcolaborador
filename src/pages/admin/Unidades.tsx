"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Building, Plus, Trash2, Edit, Save, X } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Unidade = Tables<'unidades'>;

export default function AdminUnidades() {
  const { user } = useAuth();
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Unidade>>({
    nome: "",
    tem_adiantamento: false,
    dia_adiantamento: 15,
  });
  const [criando, setCriando] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from("unidades").select("*").order("nome");
      setUnidades(data ?? []);
    } catch (error) {
      toast.error("Erro ao carregar unidades");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setFormData({ nome: "", tem_adiantamento: false, dia_adiantamento: 15 });
    setEditandoId(null);
    setCriando(false);
  };

  const handleSave = async () => {
    if (!formData.nome?.trim()) {
      toast.error("Nome da unidade é obrigatório");
      return;
    }

    try {
      if (editandoId) {
        // Atualizar
        const { error } = await supabase
          .from("unidades")
          .update({
            nome: formData.nome,
            tem_adiantamento: formData.tem_adiantamento,
            dia_adiantamento: formData.tem_adiantamento ? formData.dia_adiantamento : null,
          })
          .eq("id", editandoId);
        if (error) throw error;
        toast.success("Unidade atualizada");
      } else {
        // Criar
        const { error } = await supabase.from("unidades").insert({
          nome: formData.nome,
          tem_adiantamento: formData.tem_adiantamento,
          dia_adiantamento: formData.tem_adiantamento ? formData.dia_adiantamento : null,
        });
        if (error) throw error;
        toast.success("Unidade criada");
      }
      resetForm();
      load();
    } catch (error) {
      toast.error("Erro ao salvar", { description: (error as Error).message });
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta unidade?")) return;
    try {
      const { error } = await supabase.from("unidades").delete().eq("id", id);
      if (error) throw error;
      toast.success("Unidade excluída");
      load();
    } catch (error) {
      toast.error("Erro ao excluir", { description: (error as Error).message });
    }
  };

  const startEdit = (unidade: Unidade) => {
    setEditandoId(unidade.id);
    setFormData({
      nome: unidade.nome,
      tem_adiantamento: unidade.tem_adiantamento,
      dia_adiantamento: unidade.dia_adiantamento || 15,
    });
    setCriando(false);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Building className="size-6 text-primary" /> Unidades
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie as unidades e configurações de adiantamento.</p>
        </div>
        <Button onClick={() => { resetForm(); setCriando(true); }}>
          <Plus className="size-4 mr-2" /> Nova Unidade
        </Button>
      </div>

      {/* Formulário de criação/edição */}
      {(criando || editandoId) && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {editandoId ? "Editar Unidade" : "Nova Unidade"}
            </h2>
            <Button variant="ghost" size="icon" onClick={resetForm}>
              <X className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da Unidade *</Label>
              <Input
                id="nome"
                value={formData.nome || ""}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Garavelo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tem_adiantamento">Tem adiantamento quinzenal?</Label>
              <div className="flex items-center gap-3 pt-1">
                <Switch
                  id="tem_adiantamento"
                  checked={formData.tem_adiantamento || false}
                  onCheckedChange={(checked) => setFormData({ ...formData, tem_adiantamento: checked })}
                />
                <span className="text-sm text-muted-foreground">
                  {formData.tem_adiantamento ? "Sim" : "Não"}
                </span>
              </div>
            </div>

            {formData.tem_adiantamento && (
              <div className="space-y-2">
                <Label htmlFor="dia_adiantamento">Dia do mês do adiantamento (1-31)</Label>
                <Input
                  id="dia_adiantamento"
                  type="number"
                  min={1}
                  max={31}
                  value={formData.dia_adiantamento || ""}
                  onChange={(e) => setFormData({ ...formData, dia_adiantamento: parseInt(e.target.value) || 15 })}
                />
                <span className="text-xs text-muted-foreground">
                  Ex: se for dia 15, o adiantamento é liberado no dia 15 de cada mês.
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

      {/* Lista de unidades */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : unidades.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhuma unidade cadastrada.</div>
        ) : (
          <div className="divide-y divide-border">
            {unidades.map((u) => (
              <div key={u.id} className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-muted/10">
                <div className="flex items-center gap-4 flex-1 min-w-[200px]">
                  <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Building className="size-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold">{u.nome}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                      <span>
                        {u.tem_adiantamento ? (
                          <>✅ Adiantamento: dia {u.dia_adiantamento}</>
                        ) : (
                          <>❌ Sem adiantamento</>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(u)}>
                    <Edit className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(u.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}