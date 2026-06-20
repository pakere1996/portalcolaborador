import { ShieldAlert } from "lucide-react";
import { DocumentosAdminBase } from "@/components/DocumentosAdminBase";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
        <>
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
          <div className="space-y-2">
            <Label>Dias de Afastamento (se aplicável)</Label>
            <Input
              type="number"
              min="0"
              value={form.dias_afastamento || 0}
              onChange={(e) => setForm({ ...form, dias_afastamento: e.target.value })}
              placeholder="Ex: 0"
              disabled={busy}
            />
            <p className="text-xs text-muted-foreground">
              Preencha com 0 se não houver afastamento.
            </p>
          </div>
          {form.data_documento && form.dias_afastamento && parseInt(form.dias_afastamento) > 0 && (
            <div className="rounded-xl bg-muted/30 p-3 text-sm">
              <span className="font-semibold">Data de retorno:</span>{" "}
              {(() => {
                const dt = new Date(form.data_documento + 'T00:00:00');
                dt.setDate(dt.getDate() + parseInt(form.dias_afastamento));
                return dt.toLocaleDateString('pt-BR');
              })()}
            </div>
          )}
        </>
      )}
      colunasExtras={(doc) => {
        const dias = (doc as any).dias_afastamento || 0;
        return (
          <div className="text-sm space-y-1">
            <div><span className="font-semibold">Tipo:</span> {doc.tipo || "—"}</div>
            {dias > 0 && (
              <div><span className="font-semibold">Dias:</span> {dias}</div>
            )}
            {doc.observacao && (
              <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                <span className="font-semibold">Obs:</span> {doc.observacao}
              </div>
            )}
          </div>
        );
      }}
      editCamposExtras={(editForm, setEditForm) => (
        <>
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
          <div className="space-y-1 mt-2">
            <Label className="text-xs">Dias de Afastamento</Label>
            <Input
              type="number"
              min="0"
              value={editForm.dias_afastamento || 0}
              onChange={(e) => setEditForm({ ...editForm, dias_afastamento: e.target.value })}
            />
          </div>
        </>
      )}
      validarForm={(form) => {
        if (!form.tipo) return "Selecione o tipo de registro disciplinar";
        if (form.dias_afastamento && parseInt(form.dias_afastamento) < 0) {
          return "Dias de afastamento não pode ser negativo";
        }
        return null;
      }}
      beforeInsert={async (form, path, kind) => ({
        colaborador_id: form.colaborador_id,
        unidade_id: form.unidade_id,
        data_ocorrencia: form.data_documento,
        tipo: form.tipo || "outro",
        dias_afastamento: parseInt(form.dias_afastamento) || 0,
        observacao: form.observacao || null,
        storage_path: path,
        storage_type: kind,
        criado_por: (await supabase.auth.getUser()).data.user?.id,
      })}
    />
  );
}