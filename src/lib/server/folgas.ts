import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const assignSchema = z.object({
  colaborador_id: z.string(),
  data: z.string(),
  mes_referencia: z.string(),
  tipo: z.string(),
  criado_por: z.string().optional(),
  force: z.boolean().optional().default(false),
});

export const assignFolgaManual = createServerFn({ method: "POST" })
  .validator((data: unknown) => assignSchema.parse(data))
  .handler(async ({ data: { colaborador_id, data, mes_referencia, tipo, criado_por, force } }) => {
    
    // Se não for forçado, verifica se já existe folga de fim de semana no mês
    if (!force && (tipo === 'sabado' || tipo === 'domingo')) {
      const { data: existing, error: checkError } = await supabaseAdmin
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

    // Prossegue com a inserção
    const { error: insertError } = await supabaseAdmin
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
  });