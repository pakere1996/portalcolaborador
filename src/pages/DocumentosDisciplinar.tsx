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

export default function RegistrosDisciplinaresAdmin() {
  return (
    <DocumentosAdminBase
      tipo="registros_disciplinares"
      titulo="Registros Disciplinares"
      icone={<ShieldAlert className="size-6 text-primary" />}
      descricao="Gerencie advertências, suspensões e outros registros disciplinares."
      importTitle="Importar Registro Disciplinar"
      campoData="data_ocorrencia"
      gerarStoragePath={async (colaboradorId, data, id, file) => {
        const path = disciplinarStoragePath(colaboradorId, data, "outro", id, file);
        const kind = getFileKind(file);
        if (!kind) throw new Error("Tipo de arquivo não suportado");
        return { path, kind };
      }}
      formatarStatus={(tipo) => formatDisciplinarTipo(tipo)}
      camposExtras={(form, setForm, busy) => (
        <div className="space-y-2">
          <Label>Tipo de Registro *</Label>
          <Select
            value={form.tipo || ""}
            onValueChange={(value) => setForm({ ...form, tipo: value })}
            disabled={busy}
          >
            <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="advertencia">Advertência</SelectItem>
              <SelectItem value="suspensao">Suspensão</SelectItem>
              <SelectItem value="justa_causa">Justa Causa</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      colunasExtras={(doc) => (
        <div className="text-sm">
          {doc.observacao && (
            <div className="text-xs text-muted-foreground max-w-[150px] truncate">
              {doc.observacao}
            </div>
          )}
        </div>
      )}
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
      validarForm={(form) => {
        if (!form.tipo) return "Selecione o tipo de registro disciplinar";
        return null;
      }}
      beforeInsert={async (form, path, kind) => ({
        colaborador_id: form.colaborador_id,
        unidade_id: form.unidade_id,
        data_ocorrencia: form.data_documento,
        tipo: form.tipo || "outro",
        observacao: form.observacao || null,
        storage_path: path,
        storage_type: kind,
        criado_por: (await supabase.auth.getUser()).data.user?.id,
      })}
    />
  );
}