import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { adminApi } from "@/lib/admin-api";
import { Tables } from "@/integrations/supabase/types";
import { onlyDigits } from "@/lib/cpf";
import { ColaboradorForm } from "./ColaboradorForm";
import { ExtractedData } from "@/lib/documentos";

type Unidade = Tables<'unidades'>;
type Cargo = Tables<'cargos'>;
type SuggestedProfile = Tables<'suggested_profiles'>;

interface PreCadastroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestion: SuggestedProfile | null;
  unidades: Unidade[];
  cargos: Cargo[];
  onSuccess: () => void;
}

// Estado inicial completo do formulário (deve ser compatível com o ColaboradorForm)
const blankForm = {
  nome: "",
  email: "",
  cpf: "",
  whatsapp: "",
  cargo: "",
  unidade_id: "null",
  folga_fixa_semana: "null",
  data_nascimento: "",
  data_admissao: "",
  perfil_acesso: "user",
};

export function PreCadastroDialog({ open, onOpenChange, suggestion, unidades, cargos, onSuccess }: PreCadastroDialogProps) {
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (suggestion && suggestion.extracted_data) {
      const data = suggestion.extracted_data as ExtractedData;
      
      // Tenta encontrar a Unidade e Cargo correspondentes
      const matchedUnidade = unidades.find(u => u.nome.toLowerCase() === data.unidade?.toLowerCase());
      const matchedCargo = cargos.find(c => c.nome.toLowerCase() === data.cargo?.toLowerCase());

      setForm({
        ...blankForm,
        nome: data.nome || "",
        cpf: data.cpf ? onlyDigits(data.cpf) : "",
        cargo: matchedCargo ? matchedCargo.nome : (data.cargo || ""),
        unidade_id: matchedUnidade ? matchedUnidade.id : "null",
        data_nascimento: data.data_nascimento || "",
        data_admissao: data.data_admissao || "",
        // Outros campos (email, whatsapp, folga_fixa_semana) ficam vazios se não extraídos
      });
    } else if (!open) {
      setForm(blankForm);
    }
  }, [suggestion, open, unidades, cargos]);

  const validateForm = () => {
    const requiredFields = ['nome', 'email', 'cpf', 'cargo', 'unidade_id', 'folga_fixa_semana', 'data_nascimento', 'data_admissao', 'perfil_acesso'];
    
    for (const field of requiredFields) {
      if (field === 'unidade_id' || field === 'folga_fixa_semana') {
        if (form[field] === "null") {
          toast.error(`O campo ${field.replace('_id', '').replace('_', ' ')} é obrigatório.`);
          return false;
        }
      } else if (!form[field].trim()) {
        toast.error(`O campo ${field} é obrigatório.`);
        return false;
      }
    }

    if (onlyDigits(form.cpf).length !== 11) {
      toast.error("CPF inválido.", { description: "O CPF deve conter 11 dígitos." });
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!suggestion || !validateForm()) return;

    setBusy(true);

    const payload = {
      nome: form.nome.trim(),
      email: form.email.trim(),
      cpf: onlyDigits(form.cpf),
      whatsapp: onlyDigits(form.whatsapp) || null,
      cargo: form.cargo,
      unidade_id: form.unidade_id === "null" ? null : form.unidade_id,
      folga_fixa_semana: form.folga_fixa_semana === "null" ? null : Number(form.folga_fixa_semana),
      data_nascimento: form.data_nascimento,
      data_admissao: form.data_admissao,
      role: form.perfil_acesso,
      suggestion_id: suggestion.id, // Passa o ID da sugestão para a Edge Function
    };

    try {
      // A Edge Function 'admin-users' com action 'create' deve ser atualizada para lidar com suggestion_id
      await adminApi.createUser(payload);

      toast.success("Colaborador cadastrado com sucesso.", {
        description: "O usuário foi criado e a sugestão foi marcada como concluída.",
      });
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      toast.error("Erro ao cadastrar colaborador", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Finalizar Cadastro Sugerido</DialogTitle></DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Preencha os campos obrigatórios restantes para finalizar o cadastro do colaborador.
          </p>
          <ColaboradorForm 
            form={form} 
            setForm={setForm} 
            unidades={unidades} 
            cargos={cargos} 
            busy={busy} 
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <UserPlus className="mr-2 size-4" />}
            {busy ? "Cadastrando..." : "Cadastrar Colaborador"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}