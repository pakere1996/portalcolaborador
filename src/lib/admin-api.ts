import { supabase } from "@/integrations/supabase/client";

/**
 * Helper para chamar Edge Functions do Supabase.
 * Edge Functions são o local correto para lógica que exige privilégios de Service Role.
 */
export async function callAdminFunction(functionName: string, payload: any) {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: payload,
  });

  if (error) {
    console.error(`Erro na função ${functionName}:`, error);
    throw new Error(error.message || "Erro ao processar solicitação administrativa");
  }

  return data;
}

export const adminApi = {
  createUser: (data: any) => callAdminFunction("admin-users", { action: "create", ...data }),
  deleteUser: (targetUserId: string) => callAdminFunction("admin-users", { action: "delete", targetUserId }),
  resetPassword: (targetUserId: string, newPassword: string) => 
    callAdminFunction("admin-users", { action: "reset-password", targetUserId, newPassword }),
  approveUser: (targetUserId: string, approve: boolean) => 
    callAdminFunction("admin-users", { action: "approve", targetUserId, approve }),
  runSorteio: (ano?: number, mes?: number) => callAdminFunction("sorteio-folgas", { ano, mes }),
  acceptSwap: (swapId: string) => callAdminFunction("trocas-handler", { action: "accept", swapId }),
  generateDisciplinaryPdf: (ocorrenciaId: string) => callAdminFunction("generate-disciplinary-pdf", { id: ocorrenciaId }),
  
  /**
   * Atribui uma folga manualmente. 
   * Como o usuário é admin, o RLS permite a inserção direta.
   */
  assignFolga: async (payload: { 
    colaborador_id: string; 
    data: string; 
    mes_referencia: string; 
    tipo: string; 
    criado_por?: string; 
    force?: boolean 
  }) => {
    const { colaborador_id, data, mes_referencia, tipo, criado_por, force } = payload;

    // Validação de duplicidade de fim de semana (regra de negócio)
    if (!force && (tipo === 'sabado' || tipo === 'domingo')) {
      const { data: existing, error: checkError } = await supabase
        .from("folgas")
        .select("id")
        .eq("user_id", colaborador_id)
        .eq("mes", mes_referencia)
        .in("tipo", ["sabado", "domingo"])
        .limit(1);

      if (checkError) throw checkError;

      if (existing && existing.length > 0) {
        return { needs_confirmation: true };
      }
    }

    // Inserção direta via SDK (Admin bypassa triggers de limite se configurado no banco)
    const { error: insertError } = await supabase
      .from("folgas")
      .insert({
        user_id: colaborador_id,
        data: data,
        mes: mes_referencia,
        tipo: tipo,
        criado_por: criado_por || null,
      });

    if (insertError) {
      if (insertError.code === '23505') {
        throw new Error("Este colaborador já possui uma folga registrada nesta data.");
      }
      throw insertError;
    }

    return { success: true };
  },
};