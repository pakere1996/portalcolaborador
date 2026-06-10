"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tables } from "@/integrations/supabase/types";
import { onlyDigits } from "@/lib/cpf";
import { ColaboradorForm } from "./ColaboradorForm";
import { ExtractedData, PageResult } from "@/lib/documentos";
import { adminApi } from "@/lib/admin-api";
import { toast } from "sonner";

type Unidade = Tables<"unidades">;
type Cargo = Tables<"cargos">;
type SuggestedProfile = Tables<"suggested_profiles">;

// Definindo o estado completo do formulário (incluindo Matrícula)
export interface ColaboradorFormState {
  nome: string;
  cpf: string;
  matricula: string; // Novo campo
  email: string;
  whatsapp: string;
  cargo: string;
  unidade_id: string;
  data_nascimento: string;
  data_admissao: string;
  folga_fixa_semana: string;
  perfil_acesso: string;
  ativo?: boolean;
}

// Define a estrutura de dados iniciais que pode vir de uma sugestão (DB) ou de um PageResult (imediato)
export type InitialData = {
  extractedData: ExtractedData;
  suggestionId?: string; // Presente se vier do painel de sugestões
  pageNumber?: number; // Presente se vier do Documentos.tsx (cadastro imediato)
};

interface ColaboradorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: InitialData | null; // Dados para pré-preenchimento
  unidades: Unidade[];
  cargos: Cargo[];
  onSuccess: (newProfileId?: string, pageNumber?: number) => void;
  isEditing?: boolean; // Se estiver editando um perfil existente
  profileToEdit?: Tables<"profiles"> & { role: string } | null;
}

const blankForm: ColaboradorFormState = {
  nome: "",
  cpf: "",
  matricula: "", // Inicializando Matrícula
  email: "",
  whatsapp: "",
  cargo: "",
  unidade_id: "null",
  data_nascimento: "",
  data_admissao: "",
  folga_fixa_semana: "null",
  perfil_acesso: "colaborador",
};

export const ColaboradorFormDialog: React.FC<ColaboradorFormDialogProps> = ({
  open,
  onOpenChange,
  initialData,
  unidades,
  cargos,
  onSuccess,
  isEditing = false,
  profileToEdit,
}) => {
  const [form, setForm] = useState<ColaboradorFormState>(blankForm);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isEditing && profileToEdit) {
      // Lógica de edição
      setForm({
        nome: profileToEdit.nome || "",
        cpf: profileToEdit.cpf || "",
        matricula: profileToEdit.matricula || "", // Carregando Matrícula
        email: profileToEdit.email_contato || "",
        whatsapp: profileToEdit.whatsapp || "",
        cargo: profileToEdit.cargo || "",
        unidade_id: profileToEdit.unidade_id || "null",
        data_nascimento: profileToEdit.data_nascimento || "",
        data_admissao: profileToEdit.data_admissao || "",
        folga_fixa_semana: profileToEdit.folga_fixa_semana?.toString() || "null",
        perfil_acesso: profileToEdit.role || "colaborador",
        ativo: profileToEdit.ativo,
      });
    } else if (initialData) {
      // Lógica de pré-preenchimento (Criação)
      const data = initialData.extractedData;

      // Tenta encontrar a Unidade e Cargo correspondentes
      const matchedUnidade = unidades.find(u => u.nome.toLowerCase() === data.unidade?.toLowerCase());
      // Ponto 8: Integração com Tabela de Cargos
      const matchedCargo = cargos.find(c => c.nome.toLowerCase() === data.cargo?.toLowerCase());

      setForm({
        ...blankForm,
        nome: data.nome || "",
        cpf: data.cpf ? onlyDigits(data.cpf) : "",
        matricula: data.matricula || "", // Pré-preenchendo Matrícula
        cargo: matchedCargo ? matchedCargo.nome : (data.cargo || ""),
        unidade_id: matchedUnidade ? matchedUnidade.id : "null",
        data_nascimento: data.data_nascimento || "",
        data_admissao: data.data_admissao || "",
        // Outros campos (email, whatsapp, folga_fixa_semana) ficam vazios se não extraídos
      });
    } else if (!open) {
      // Resetar formulário ao fechar (se não for edição)
      setForm(blankForm);
    }
  }, [initialData, open, unidades, cargos, isEditing, profileToEdit]);

  const validateForm = () => {
    // Ponto 9: E-mail não é mais obrigatório.
    if (!form.nome || !form.cpf || !form.cargo || form.unidade_id === "null") {
      toast.error("Preencha todos os campos obrigatórios (Nome, CPF, Cargo, Unidade).");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setBusy(true);

    const payload = {
      nome: form.nome.trim(),
      email: form.email.trim() || null, // Ponto 10: Usa o email informado ou null
      cpf: onlyDigits(form.cpf),
      matricula: form.matricula.trim() || null, // Incluindo Matrícula
      whatsapp: onlyDigits(form.whatsapp) || null,
      cargo: form.cargo,
      unidade_id: form.unidade_id === "null" ? null : form.unidade_id,
      folga_fixa_semana: form.folga_fixa_semana === "null" ? null : Number(form.folga_fixa_semana),
      data_nascimento: form.data_nascimento || null,
      data_admissao: form.data_admissao || null,
      role: form.perfil_acesso,
      suggestion_id: initialData?.suggestionId, // Passa o ID da sugestão SE existir
    };

    try {
      let newProfileId: string;

      if (isEditing && profileToEdit) {
        // Lógica de Edição
        // Ponto 4: Atualizar Matrícula
        await adminApi.updateUser(profileToEdit.id, payload);
        toast.success("Colaborador atualizado com sucesso.");
        newProfileId = profileToEdit.id;
      } else {
        // Lógica de Criação
        // Ponto 4: Criar com Matrícula
        const newProfile = await adminApi.createUser(payload);
        toast.success("Colaborador cadastrado com sucesso.", {
          description: initialData?.suggestionId ? "A sugestão foi marcada como concluída." : undefined,
        });
        newProfileId = newProfile.id;
      }

      onOpenChange(false);

      // Se for um cadastro imediato (vindo de pageResult), retorna o ID do novo perfil e o número da página
      if (initialData?.pageNumber) {
        onSuccess(newProfileId, initialData.pageNumber);
      } else {
        onSuccess(newProfileId); // Se for do painel de sugestões ou cadastro manual, apenas recarrega os dados
      }
    } catch (e) {
      // Ponto 11: Validação de Matrícula (se a Edge Function retornar erro de duplicidade)
      toast.error(isEditing ? "Erro ao atualizar colaborador" : "Erro ao cadastrar colaborador", {
        description: (e as Error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  const title = isEditing ? "Editar Colaborador" : (initialData ? "Cadastrar Colaborador (Pré-preenchido)" : "Novo Colaborador");
  const description = isEditing ? "Atualize os dados do perfil." : (initialData ? "Dados extraídos do documento. Preencha os campos obrigatórios restantes." : "Preencha os dados para criar um novo colaborador.");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ColaboradorForm
          form={form}
          setForm={setForm}
          unidades={unidades}
          cargos={cargos}
          onSubmit={handleSubmit}
          busy={busy}
          isEdit={isEditing} // Corrigido para isEdit
        />
      </DialogContent>
    </Dialog>
  );
};