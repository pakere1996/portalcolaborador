import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to generate a simple PDF content (Placeholder)
async function generatePdfContent(data: any): Promise<Uint8Array> {
  // NOTE: PDF generation libraries (like pdf-lib) are complex to run in Deno/Edge environment.
  // This is a placeholder. In a real scenario, you would use a dedicated service or a Deno-compatible library.
  
  // For demonstration, we create a simple text file content
  const content = `
    Ocorrência Disciplinar - ID: ${data.id}
    Colaborador: ${data.colaborador_nome}
    Unidade: ${data.unidade_nome}
    Data: ${data.data_ocorrencia}
    Tipo: ${data.tipo}
    Motivo: ${data.motivo}
    Descrição: ${data.descricao_detalhada || 'N/A'}
    
    Assinatura Colaborador: _________________________
    Assinatura Empresa: _________________________
  `;
  
  const encoder = new TextEncoder();
  return encoder.encode(content);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Use Service Role Key for backend operations
  );

  try {
    const { id: ocorrenciaId } = await req.json();

    if (!ocorrenciaId) {
      return new Response(JSON.stringify({ error: 'Missing ocorrenciaId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch Ocorrencia Data
    const { data: ocorrencia, error: fetchError } = await supabaseClient
      .from('ocorrencias_disciplinares')
      .select(`
        *,
        colaborador:colaborador_id(nome, cargo),
        unidade:unidade_id(nome)
      `)
      .eq('id', ocorrenciaId)
      .single();

    if (fetchError || !ocorrencia) {
      console.error(`[generate-disciplinary-pdf] Error fetching occurrence ${ocorrenciaId}:`, fetchError);
      return new Response(JSON.stringify({ error: 'Occurrence not found or fetch error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const dataForPdf = {
      ...ocorrencia,
      colaborador_nome: (ocorrencia.colaborador as any)?.nome,
      colaborador_cargo: (ocorrencia.colaborador as any)?.cargo,
      unidade_nome: (ocorrencia.unidade as any)?.nome,
    };

    // 2. Generate PDF Content (Placeholder)
    // NOTE: In a real implementation, this would generate a proper PDF file.
    const pdfContent = await generatePdfContent(dataForPdf);
    const fileExtension = '.txt'; // Using TXT for placeholder, should be .pdf
    const contentType = 'text/plain'; // Should be 'application/pdf'

    // 3. Define Storage Path
    const fileName = `${ocorrencia.data_ocorrencia}_${dataForPdf.colaborador_nome.replace(/\s/g, '_')}_${ocorrencia.tipo}${fileExtension}`;
    const storagePath = `documentos/disciplina/${ocorrencia.colaborador_id}/${fileName}`;

    // 4. Upload to Storage
    const { error: uploadError } = await supabaseClient.storage
      .from('documentos')
      .upload(storagePath, pdfContent, {
        contentType: contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error(`[generate-disciplinary-pdf] Error uploading PDF for ${ocorrenciaId}:`, uploadError);
      throw uploadError;
    }

    // 5. Update Ocorrencia with PDF path
    const { error: updateError } = await supabaseClient
      .from('ocorrencias_disciplinares')
      .update({ pdf_storage_path: storagePath })
      .eq('id', ocorrenciaId);

    if (updateError) {
      console.error(`[generate-disciplinary-pdf] Error updating occurrence ${ocorrenciaId}:`, updateError);
      throw updateError;
    }

    return new Response(JSON.stringify({ success: true, path: storagePath }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`[generate-disciplinary-pdf] General error:`, error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});