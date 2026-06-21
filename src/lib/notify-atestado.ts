import { supabase } from "@/integrations/supabase/client";

export async function notifyAtestadoPendente(atestadoId: string, colaboradorNome: string) {
  try {
    // Verifica se a função existe antes de chamar (opcional)
    const { error } = await supabase.functions.invoke("notify-atestado", {
      body: { atestadoId, colaboradorNome },
    });
    if (error) {
      // Silencia completamente o erro 404
      console.debug("Função de notificação não disponível (ignorado):", error.message);
      return;
    }
  } catch (error) {
    // Silencia completamente
    console.debug("Erro ao notificar (ignorado):", error);
  }
}