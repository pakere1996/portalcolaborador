import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ColaboradorForm } from "./ColaboradorForm";
import { Tables } from "@/integrations/supabase/types";

type Unidade = Tables<"unidades">;
type Cargo = Tables<"cargos">;

interface ColaboradorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  form: any;
  setForm: (form: any) => void;
  unidades: Unidade[];
  cargos: Cargo[];
  busy: boolean;
  isEdit: boolean;
  onSave: () => void;
}

export function ColaboradorFormDialog({
  open,
  onOpenChange,
  form,
  setForm,
  unidades,
  cargos,
  busy,
  isEdit,
  onSave,
}: ColaboradorFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar Colaborador" : "Novo Colaborador"}
          </DialogTitle>
        </DialogHeader>

        <ColaboradorForm
          form={form}
          setForm={setForm}
          unidades={unidades}
          cargos={cargos}
          busy={busy}
          isEdit={isEdit}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={busy}>
            {busy ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar Colaborador"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ColaboradorFormDialog;