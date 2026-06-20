import { ShieldAlert } from "lucide-react";
import { DocumentosAdminBase } from "@/components/DocumentosAdminBase";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  disciplinarStoragePath,
  formatDisciplinarTipo,
  getFileKind,
  newDocumentId,
} from "@/lib/documentos-regulatorios";
import { supabase } from "@/integrations/supabase/client";

/**
 * Página administrativa para gerenciar registros disciplinares.
 * Utiliza a base DocumentosAdminBase com configurações específicas.
 */
export default function RegistrosDisciplinaresAdmin() {
  return (
    <DocumentosAdminBase
      // === Identificação do tipo ===
      tipo="registros_disciplinares"
      titulo="Registros Disciplinares"
      icone={<ShieldAlert className="size-6 text-primary" />}
      descricao="Gerencie advertências, suspensões e outros registros disciplinares."
      importTitle="Importar Registro Disciplinar"

      // === Configuração de campos da tabela ===
      campoData="data" // Nome da coluna de data na tabela 'registros_disciplinares'

      // === Geração do caminho de storage ===
      gerarStoragePath={async (colaboradorId, data, id, file) => {
        // Usa o helper existente que já gera o caminho baseado no colaborador, data, tipo e ID
        const path = disciplinarStoragePath(colaboradorId, data, "outro", id, file);
        const kind = getFileKind(file);
        if (!kind) throw new Error("Tipo de arquivo não suportado");
        return { path, kind };
      }}

      // === Formatação de status (tipo) ===
      formatarStatus={(tipo) => formatDisciplinarTipo(tipo)}

      // === Campos extras no formulário de importação ===
      camposExtras={(form, setForm, busy) => (
        <div className="space-y-2">
          <Label>Tipo de Registro *</Label>
          <Select
            value={form.tipo || ""}
            onValueChange={(value) => setForm({ ...form, tipo: value })}
            disabled={busy}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="advertencia">Advertência</SelectItem>
              <SelectItem value="suspensao">Suspensão</SelectItem>
              <SelectItem value="justa_causa">Justa Causa</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      // === Colunas extras na tabela (observação resumida) ===
      colunasExtras={(doc) => (
        <div className="text-sm">
          {doc.observacao && (
            <div className="text-xs text-muted-foreground max-w-[150px] truncate">
              {doc.observacao}
            </div>
          )}
        </div>
      )}

      // === Campos extras na edição (permitir alterar o tipo) ===
      editCamposExtras={(editForm, setEditForm) => (
        <div className="space-y-1 mt-2">
          <Label className="text-xs">Tipo</Label>
          <Select
            value={editForm.tipo || "outro"}
            onValueChange={(v) => setEditForm({ ...editForm, tipo: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="advertencia">Advertência</SelectItem>
              <SelectItem value="suspensao">Suspensão</SelectItem>
              <SelectItem value="justa_causa">Justa Causa</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      // === Validação customizada do formulário ===
      validarForm={(form) => {
        if (!form.tipo) return "Selecione o tipo de registro disciplinar";
        return null;
      }}

      // === Montagem dos dados para inserção no banco ===
      beforeInsert={async (form, path, kind) => {
        const { data: userData } = await supabase.auth.getUser();
        return {
          colaborador_id: form.colaborador_id,
          unidade_id: form.unidade_id,
          data: form.data_documento, // coluna 'data' da tabela
          tipo: form.tipo || "outro",
          observacao: form.observacao || null,
          storage_path: path,
          storage_type: kind,
          criado_por: userData?.user?.id,
        };
      }}
    />
  );
}