import { FileWarning } from "lucide-react";
import { DocumentosAdminBase } from "@/components/DocumentosAdminBase";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  atestadoStoragePath,
  getFileKind,
  formatAtestadoStatus,
  newDocumentId,
  statusClass,
} from "@/lib/documentos-regulatorios";
import { supabase } from "@/integrations/supabase/client";

export default function AtestadosAdmin() {
  return (
    <DocumentosAdminBase
      tipo="atestados"
      titulo="Atestados"
      icone={<FileWarning className="size-6 text-primary" />}
      descricao="Gerencie todos os atestados médicos dos colaboradores."
      importTitle="Importar Atestado"
      campoData="data_atestado"
      gerarStoragePath={async (colaboradorId, data, id, file) => {
        const path = atestadoStoragePath(colaboradorId, data, id, file);
        const kind = getFileKind(file);
        if (!kind) throw new Error("Tipo de arquivo não suportado");
        return { path, kind };
      }}
      formatarStatus={formatAtestadoStatus}
      statusClass={statusClass}
      camposExtras={(form, setForm, busy) => (
        <>
          <div className="space-y-2">
            <Label>Dias de Afastamento *</Label>
            <Input
              type="number"
              min="0"
              value={form.dias_afastamento || ""}
              onChange={(e) => setForm({ ...form, dias_afastamento: e.target.value })}
              placeholder="Ex: 3"
              disabled={busy}
            />
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
        const dataRetorno = new Date(new Date(doc.data + 'T00:00:00').getTime() + dias * 24 * 60 * 60 * 1000);
        return (
          <div className="text-sm space-y-1">
            <div><span className="font-semibold">Dias:</span> {dias}</div>
            <div><span className="font-semibold">Retorno:</span> {dataRetorno.toLocaleDateString('pt-BR')}</div>
            {doc.status && (
              <Badge className={statusClass(doc.status)}>
                {formatAtestadoStatus(doc.status)}
              </Badge>
            )}
          </div>
        );
      }}
      editCamposExtras={(editForm, setEditForm) => (
        <>
          <div className="space-y-1 mt-2">
            <Label className="text-xs">Dias de Afastamento</Label>
            <Input
              type="number"
              min="0"
              value={editForm.dias_afastamento || ""}
              onChange={(e) => setEditForm({ ...editForm, dias_afastamento: e.target.value })}
            />
          </div>
          <div className="space-y-1 mt-2">
            <Label className="text-xs">Status</Label>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-1 text-sm"
              value={editForm.status || "pendente"}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
            >
              <option value="pendente">Pendente</option>
              <option value="aprovado">Aprovado</option>
              <option value="rejeitado">Rejeitado</option>
            </select>
          </div>
          <div className="space-y-1 mt-2">
            <Label className="text-xs">Observação do Admin</Label>
            <Textarea
              rows={2}
              value={editForm.observacao_admin || ""}
              onChange={(e) => setEditForm({ ...editForm, observacao_admin: e.target.value })}
              placeholder="Motivo da rejeição ou observação..."
            />
          </div>
        </>
      )}
      validarForm={(form) => {
        if (!form.dias_afastamento || parseInt(form.dias_afastamento) < 0) {
          return "Informe um número válido de dias de afastamento";
        }
        return null;
      }}
      // 🔥 beforeInsert com auto‑aprovação para admin
      beforeInsert={async (form, path, kind) => {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;

        // Verifica se o usuário é admin
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .maybeSingle();

        const isAdmin = !!roles;

        const baseData = {
          colaborador_id: form.colaborador_id,
          unidade_id: form.unidade_id,
          data_atestado: form.data_documento,
          dias_afastamento: parseInt(form.dias_afastamento) || 0,
          observacao: form.observacao || null,
          storage_path: path,
          storage_type: kind,
          criado_por: userId,
          observacao_admin: null,
        };

        if (isAdmin) {
          // Admin cadastra como aprovado automaticamente
          return {
            ...baseData,
            status: 'aprovado',
            respondido_em: new Date().toISOString(),
            respondido_por: userId,
          };
        } else {
          // Caso não seja admin (nunca deve ocorrer no admin, mas por segurança)
          return {
            ...baseData,
            status: 'pendente',
            respondido_em: null,
            respondido_por: null,
          };
        }
      }}
    />
  );
}