import { FileWarning } from "lucide-react";
import { DocumentosAdminBase } from "@/components/DocumentosAdminBase";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  atestadoStoragePath,
  getFileKind,
  formatAtestadoStatus,
  newDocumentId,
  statusClass,
} from "@/lib/documentos-regulatorios";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AtestadosAdmin() {
  const handleStatusAction = async (id: string, newStatus: "aprovado" | "rejeitado", obs?: string) => {
    try {
      const updates: any = {
        status: newStatus,
        respondido_em: new Date().toISOString(),
        respondido_por: (await supabase.auth.getUser()).data.user?.id,
      };
      if (obs) updates.observacao_admin = obs;

      const { error } = await supabase
        .from("atestados")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
      toast.success(`Atestado ${newStatus === "aprovado" ? "aprovado" : "rejeitado"} com sucesso!`);
      window.location.reload();
    } catch (error) {
      toast.error("Erro ao atualizar status", { description: (error as Error).message });
    }
  };

  const handleColaboradorChange = async (colaboradorId: string, setForm: any) => {
    if (!colaboradorId) return;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("unidade_id")
        .eq("id", colaboradorId)
        .single();
      if (data?.unidade_id) {
        setForm((prev: any) => ({ ...prev, unidade_id: data.unidade_id }));
      }
    } catch (error) {
      console.warn("Erro ao buscar unidade do colaborador:", error);
    }
  };

  return (
    <DocumentosAdminBase
      tipo="atestados"
      titulo="Atestados"
      icone={<FileWarning className="size-6 text-primary" />}
      descricao="Gerencie todos os atestados médicos dos colaboradores."
      importTitle="Importar Atestado"
      campoData="data_atestado"
      onColaboradorChange={handleColaboradorChange}
      gerarStoragePath={async (colaboradorId, data, id, file) => {
        const path = atestadoStoragePath(colaboradorId, data, id, file);
        const kind = getFileKind(file);
        if (!kind) throw new Error("Tipo de arquivo não suportado");
        return { path, kind };
      }}
      formatarStatus={formatAtestadoStatus}
      statusClass={statusClass}
      // 🔥 CAMPOS EXTRAS NO FORMULÁRIO DE IMPORTAÇÃO
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
          </div>
        );
      }}
      acoesExtras={(doc) => (
        doc.status === "pendente" ? (
          <div className="flex gap-1 mt-1">
            <Button
              size="sm"
              variant="outline"
              className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 h-7 px-2 text-[10px]"
              onClick={() => handleStatusAction(doc.id, "aprovado")}
            >
              Aprovar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 h-7 px-2 text-[10px]"
              onClick={() => {
                const obs = prompt("Motivo da rejeição (opcional):");
                handleStatusAction(doc.id, "rejeitado", obs || undefined);
              }}
            >
              Rejeitar
            </Button>
          </div>
        ) : null
      )}
      validarForm={(form) => {
        if (!form.dias_afastamento || parseInt(form.dias_afastamento) < 0) {
          return "Informe um número válido de dias de afastamento";
        }
        return null;
      }}
      beforeInsert={async (form, path, kind) => {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
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
          return {
            ...baseData,
            status: 'aprovado',
            respondido_em: new Date().toISOString(),
            respondido_por: userId,
          };
        }
        return { ...baseData, status: 'pendente', respondido_em: null, respondido_por: null };
      }}
      // 🔥 NOVO: prop favorito
      favorito={{ 
        rota: "/admin/documentos/atestados", 
        label: "Atestados", 
        icone: "FileWarning" 
      }}
    />
  );
}