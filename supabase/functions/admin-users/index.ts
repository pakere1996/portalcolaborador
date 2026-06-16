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

    // 1. Verify JWT from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error("[admin-users] No authorization header provided")
      return new Response(JSON.stringify({ error: 'No authorization header' }), { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      console.error("[admin-users] Invalid token", userError)
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
      console.error("[admin-users] Unauthorized access attempt", { userId: user.id, roleError })
      return new Response(JSON.stringify({ error: 'Unauthorized: Admin role required' }), { 
        status: 403, 
        headers: corsHeaders 
      })
    }

    const { action, ...payload } = await req.json()
    console.log(`[admin-users] Action: ${action}`, payload)

    if (action === 'create') {
      const email = payload.email.toLowerCase().trim()
      
      const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers()
      const existingAuth = users.find(u => u.email === email)

      let userId;

      if (existingAuth) {
        userId = existingAuth.id
        await supabaseAdmin.auth.admin.updateUserById(userId, { password: payload.senha })
      } else {
        const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: payload.senha,
          email_confirm: true,
          user_metadata: { nome: payload.nome, cpf: payload.cpf, cargo: payload.cargo }
        })
        if (authErr) throw authErr
        userId = authUser.user.id
      }

      const { error: profErr } = await supabaseAdmin.from('profiles').upsert({
        id: userId,
        nome: payload.nome,
        cpf: payload.cpf,
        email_contato: email,
        cargo: payload.cargo,
        data_admissao: payload.dataAdmissao,
        data_nascimento: payload.dataNascimento,
        folga_fixa_semana: payload.folgaFixaSemana,
        aprovacao_status: 'aprovado',
        ativo: true,
        updated_at: new Date().toISOString()
      })

      if (profErr) throw profErr

      const { data: existingRoles } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      const roles = (existingRoles || []).map(r => r.role);
      
      if (!roles.includes('admin')) {
        await supabaseAdmin.from('user_roles').upsert({ 
          user_id: userId, 
          role: payload.role || 'funcionario' 
        }, { onConflict: 'user_id,role' })
      }
      
      return new Response(JSON.stringify({ success: true, userId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'approve') {
      const { error: profErr } = await supabaseAdmin
        .from('profiles')
        .update({
          aprovacao_status: payload.approve ? 'aprovado' : 'recusado',
          ativo: payload.approve ? true : false,
          updated_at: new Date().toISOString()
        })
        .eq('id', payload.targetUserId)

      if (profErr) throw profErr
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'reset-password') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(payload.targetUserId, { password: payload.newPassword })
      if (error) throw error
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'delete') {
      try {
        await supabaseAdmin.auth.admin.deleteUser(payload.targetUserId)
      } catch (e) {
        console.warn("[admin-users] Usuário não encontrado no Auth ao deletar")
      }
      await supabaseAdmin.from('profiles').delete().eq('id', payload.targetUserId)
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders })
  } catch (error) {
    console.error('[admin-users] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})