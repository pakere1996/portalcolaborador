import { supabase } from "@/integrations/supabase/client";

export async function notifyAtestadoPendente(atestadoId: string, colaboradorNome: string) {
  const { data, error } = await supabase.functions.invoke("notify-atestado", {
    body: { atestadoId, colaboradorNome },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}