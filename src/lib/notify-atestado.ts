// src/lib/notify-atestado.ts
import { supabase } from "@/integrations/supabase/client";

/**
 * Notifica os administradores sobre um novo atestado pendente.
 * Se a edge function não estiver disponível (404), apenas registra um log silencioso.
 */
export async function notifyAtestadoPendente(atestadoId: string, colaboradorNome: string) {
  try {
    const { error } = await supabase.functions.invoke("notify-atestado", {
      body: { atestadoId, colaboradorNome },
    });
    
    if (error) {
      // Se for 404, a função não está implantada - apenas log silencioso
      if (error.status === 404) {
        console.warn(`⚠️ Função notify-atestado não implantada. Atestado ${atestadoId} não notificado.`);
        return;
      }
      // Para outros erros, log mas não lança
      console.warn("Erro ao notificar administradores:", error);
      return;
    }
    
    console.log(`✅ Notificação para atestado ${atestadoId} enviada com sucesso.`);
  } catch (error) {
    // Qualquer erro inesperado é logado mas não interrompe o fluxo
    console.warn("Erro ao notificar administradores (ignorado):", error);
  }
}