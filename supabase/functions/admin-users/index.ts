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
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { action, ...payload } = await req.json()
    console.log(`[admin-users] Action: ${action}`, payload)

    if (action === 'create') {
      const email = `${payload.cpf}@pakere.com.br`
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: payload.senha,
        email_confirm: true,
        user_metadata: { nome: payload.nome, cpf: payload.cpf, cargo: payload.cargo }
      })

      if (authErr) throw authErr

      const { error: profErr } = await supabaseAdmin.from('profiles').update({
        nome: payload.nome,
        cargo: payload.cargo,
        data_admissao: payload.dataAdmissao,
        data_nascimento: payload.dataNascimento,
        folga_fixa_semana: payload.folgaFixaSemana,
        aprovacao_status: 'aprovado',
        ativo: true
      }).eq('id', authUser.user.id)

      if (profErr) throw profErr

      await supabaseAdmin.from('user_roles').insert({ user_id: authUser.user.id, role: payload.role || 'funcionario' })
      
      return new Response(JSON.stringify({ success: true, userId: authUser.user.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'reset-password') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(payload.targetUserId, { password: payload.newPassword })
      if (error) throw error
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'delete') {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(payload.targetUserId)
      if (error) throw error
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'approve') {
      const { error } = await supabaseAdmin.from('profiles').update({ aprovacao_status: payload.approve ? 'aprovado' : 'recusado', ativo: payload.approve }).eq('id', payload.targetUserId)
      if (error) throw error
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders })
  } catch (error) {
    console.error('[admin-users] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})