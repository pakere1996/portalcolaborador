import { ShieldAlert } from "lucide-react";
import { DocumentosAdminBase } from "@/components/DocumentosAdminBase";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  disciplinarStoragePath,
  getFileKind,
  formatDisciplinarTipo,
  newDocumentId,
} from "@/lib/documentos-regulatorios";
import { supabase } from "@/integrations/supabase/client";

export default function RegistrosDisciplinaresAdmin() {
  return (
    <DocumentosAdminBase
      tipo="registros_disciplinares"
      titulo="Registros Disciplinares"
      icone={<ShieldAlert className="size-6 text-primary" />}
      descricao="Gerencie advertências, suspensões e outros registros disciplinares."
      importTitle="Importar Registro Disciplinar"
      // Campos extras no formulário
      camposExtras={(form, setForm, busy) => (
        <div className="space-y-2">
          <Label>Tipo de Registro *</Label>
          <Select
            value={form.tipo || "advertencia"}
            onValueChange={(value) => setForm({ ...form, tipo: value })}
            disabled={busy}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="advertencia">Advertência</SelectItem>
              <SelectItem value="suspensao">Suspensão</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      // Colunas extras na tabela (tipo)
      colunasExtras={(doc) => (
        <div className="text-sm">
          <Badge className="bg-primary/10 text-primary border-primary/20">
            {formatDisciplinarTipo(doc.tipo || "advertencia")}
          </Badge>
          {doc.observacao && (
            <div className="text-xs text-muted-foreground max-w-[150px] truncate mt-1">
              {doc.observacao}
            </div>
          )}
        </div>
      )}
      // Campos extras na edição (tipo)
      editCamposExtras={(editForm, setEditForm) => (
        <div className="space-y-1 mt-2">
          <Label className="text-xs">Tipo</Label>
          <Select
            value={editForm.tipo || "advertencia"}
            onValueChange={(v) => setEditForm({ ...editForm, tipo: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="advertencia">Advertência</SelectItem>
              <SelectItem value="suspensao">Suspensão</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      // Validação customizada
      validarForm={(form) => {
        if (!form.tipo) return "Selecione o tipo de registro disciplinar";
        return null;
      }}
      // Geração do caminho usando helpers existentes
      gerarStoragePath={async (form, file) => {
        const id = newDocumentId();
        const path = disciplinarStoragePath(
          form.colaborador_id,
          form.data_documento,
          form.tipo || "advertencia",
          id,
          file
        );
        const kind = getFileKind(file);
        if (!kind) throw new Error("Tipo de arquivo não suportado");
        return { path, kind };
      }}
      // Verificação de duplicata
      verificarDuplicata={async (form) => {
        if (!form.colaborador_id || !form.data_documento || !form.tipo) return null;
        const { data } = await supabase
          .from("registros_disciplinares")
          .select("*")
          .eq("colaborador_id", form.colaborador_id)
          .eq("tipo", form.tipo)
          .eq("data", form.data_documento)
          .maybeSingle();
        return data || null;
      }}
      // Montagem dos dados para inserção
      beforeInsert={async (form, path, kind) => {
        const { data: userData } = await supabase.auth.getUser();
        return {
          colaborador_id: form.colaborador_id,
          unidade_id: form.unidade_id,
          data: form.data_documento,
          tipo: form.tipo || "advertencia",
          observacao: form.observacao || null,
          storage_path: path,
          storage_type: kind,
          criado_por: userData?.user?.id,
        };
      }}
    />
  );
}
