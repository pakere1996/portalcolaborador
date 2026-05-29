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

    // 1. Verify JWT from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error("[sorteio-folgas] No authorization header provided")
      return new Response(JSON.stringify({ error: 'No authorization header' }), { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      console.error("[sorteio-folgas] Invalid token", userError)
      return new Response(JSON.stringify({ error: 'Invalid token' }), { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    // 2. Check if user has the 'admin' role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (roleError || !roleData) {
      console.error("[sorteio-folgas] Unauthorized access attempt", { userId: user.id, roleError })
      return new Response(JSON.stringify({ error: 'Unauthorized: Admin role required' }), { 
        status: 403, 
        headers: corsHeaders 
      })
    }

    const { ano, mes } = await req.json()
    const targetAno = ano || new Date().getFullYear()
    const targetMes = mes || new Date().getMonth() + 2 

    console.log(`[sorteio-folgas] Iniciando sorteio para ${targetMes}/${targetAno}`)

    const { data, error } = await supabaseAdmin.rpc('sortear_folgas_mes', { _ano: targetAno, _mes: targetMes })
    
    if (error) throw error

    return new Response(JSON.stringify({ success: true, results: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('[sorteio-folgas] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})