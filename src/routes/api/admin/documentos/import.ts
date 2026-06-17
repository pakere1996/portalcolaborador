import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const importSchema = z.object({
  fileName: z.string(),
  fileSize: z.number(),
  filePath: z.string(),
});

export const importDocumentos = createServerFn({ method: "POST" })
  .validator(importSchema)
  .handler(async ({ fileName, fileSize, filePath }: { fileName: string; fileSize: number; filePath: string }) => {
    // Esta função agora serve apenas como um log ou gatilho, 
    // já que o upload real é feito via Edge Function para maior segurança.
    return {
      success: true,
      message: "Documento registrado para processamento",
      data: { fileName, fileSize, filePath },
    };
  });