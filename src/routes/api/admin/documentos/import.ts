import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const importSchema = z.object({
  fileName: z.string(),
  fileSize: z.number(),
  filePath: z.string(),
});

export const importDocumentos = createServerFn({ method: "POST" })
  .validator((data: unknown) => importSchema.parse(data))
  .handler(async ({ data }) => {
    // No TanStack v1, os parâmetros validados chegam envelopados em 'data'
    const { fileName, fileSize, filePath } = data;

    // Esta função agora serve apenas como um log ou gatilho, 
    // já que o upload real é feito via Edge Function para maior segurança.
    return {
      success: true,
      message: "Documento registrado para processamento",
      data: { fileName, fileSize, filePath },
    };
  });