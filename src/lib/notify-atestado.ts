// src/lib/notify-atestado.ts
import { supabase } from "@/integrations/supabase/client";

export async function notifyAtestadoPendente(atestadoId: string, colaboradorNome: string) {
  try {
    const response = await supabase.functions.invoke("notify-atestado", {
      body: { atestadoId, colaboradorNome },
    });

    if (response.error) {
      console.warn("Função de notificação não disponível (404):", response.error);
      // Não lança erro para não quebrar o fluxo do usuário
      return;
    }

    console.log("Notificação enviada com sucesso para administradores.");
  } catch (error) {
    console.warn("Erro ao notificar administradores:", error);
    // Não lança erro para não quebrar o fluxo do usuário
  }
}