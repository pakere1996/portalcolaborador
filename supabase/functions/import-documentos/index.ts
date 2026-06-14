import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log("[import-documentos] Requisição recebida");

    // 2. Verificar Autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error("[import-documentos] Erro: Cabeçalho de autorização ausente");
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    // 3. Processar FormData (Arquivo)
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      console.error("[import-documentos] Erro: Nenhum arquivo encontrado no payload");
      return new Response(JSON.stringify({ error: 'Nenhum arquivo enviado' }), { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    console.log("[import-documentos] Arquivo detectado:", {
      nome: file.name,
      tipo: file.type,
      tamanho: `${(file.size / 1024).toFixed(2)} KB`
    });

    // Aqui entraria a lógica de processamento do PDF (OCR/Extração)
    // Por enquanto, retornamos sucesso para confirmar que a rota está ativa.

    return new Response(JSON.stringify({ 
      success: true, 
      message: `O arquivo "${file.name}" foi recebido com sucesso e está na fila de processamento.`,
      details: { name: file.name, size: file.size }
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('[import-documentos] Erro crítico no processamento:', error)
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), { 
      status: 500, 
      headers: corsHeaders 
    })
  }
})