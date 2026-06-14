import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";

const importSchema = z.object({
  fileName: z.string(),
  fileSize: z.number(),
  filePath: z.string(),
});

export const importDocumentos = createServerFn({ method: "POST" })
  .validator(importSchema)
  .handler(async ({ fileName, fileSize, filePath }) => {
    const supabase = getSupabaseServerClient();
    
    // Verify user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Não autenticado");
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      throw new Error("Apenas administradores podem importar documentos");
    }

    // Log the import
    const { data, error } = await supabase
      .from("documentos_importacao")
      .insert({
        nome_arquivo: fileName,
        tamanho_bytes: fileSize,
        caminho_arquivo: filePath,
        importado_por: user.id,
        status: "processado",
      })
      .select()
      .single();

    if (error) {
      console.error("Error inserting import record:", error);
      throw new Error("Erro ao registrar importação");
    }

    return {
      success: true,
      message: "Documento importado com sucesso",
      data,
    };
  });