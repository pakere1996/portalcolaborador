import { supabase } from "@/integrations/supabase/client";

export async function notifyAtestadoPendente(atestadoId: string, colaboradorNome: string) {
  try {
    const { error } = await supabase.functions.invoke("notify-atestado", {
      body: { atestadoId, colaboradorNome },
    });
    if (error) {
      // Silencia o erro 404 (função não implantada)
      console.warn("Função de notificação não disponível:", error.message);
      return;
    }
  } catch (error) {
    // Silencia qualquer erro para não quebrar o fluxo
    console.warn("Erro ao notificar administradores:", error);
  }
}