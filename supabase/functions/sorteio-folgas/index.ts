import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { ano, mes } = await req.json()
    const targetAno = ano || new Date().getFullYear()
    const targetMes = mes || new Date().getMonth() + 2 // Próximo mês por padrão

    console.log(`[sorteio-folgas] Iniciando sorteio para ${targetMes}/${targetAno}`)

    // Aqui chamamos a função SQL que já existe no banco para realizar o sorteio
    const { data, error } = await supabaseAdmin.rpc('sortear_folgas_mes', { _ano: targetAno, _mes: targetMes })
    
    if (error) throw error

    return new Response(JSON.stringify({ success: true, results: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('[sorteio-folgas] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})