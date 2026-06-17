import { supabase } from "@/integrations/supabase/client";
import { assignFolgaManual } from "./server/folgas";

/**
 * Helper para chamar Edge Functions do Supabase que substituem as antigas Server Functions.
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
  
  // Nova função via TanStack Start Server Function
  assignFolga: (payload: { colaborador_id: string; data: string; mes_referencia: string; tipo: string; criado_por?: string; force?: boolean }) => 
    assignFolgaManual({ data: payload }),
};