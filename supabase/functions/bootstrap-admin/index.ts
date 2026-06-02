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

    // Check if any admin already exists
    const { data: existingAdmins, error: checkErr } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
      .limit(1)

    if (checkErr) throw checkErr

    if (existingAdmins && existingAdmins.length > 0) {
      return new Response(JSON.stringify({ 
        error: 'Já existe um administrador no sistema. Use a interface administrativa para criar novos usuários.' 
      }), { status: 403, headers: corsHeaders })
    }

    const { nome, cpf, email, senha } = await req.json()

    if (!nome || !cpf || !email || !senha) {
      return new Response(JSON.stringify({ 
        error: 'Todos os campos são obrigatórios: nome, cpf, email, senha' 
      }), { status: 400, headers: corsHeaders })
    }

    // Validate CPF (11 digits)
    const cleanCpf = cpf.replace(/\D/g, '')
    if (cleanCpf.length !== 11) {
      return new Response(JSON.stringify({ error: 'CPF inválido' }), { status: 400, headers: corsHeaders })
    }

    // Create user in Supabase Auth
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: senha,
      email_confirm: true,
      user_metadata: { nome, cpf }
    })

    if (authErr) throw authErr

    const userId = authUser.user.id

    // Create profile
    const { error: profErr } = await supabaseAdmin.from('profiles').insert({
      id: userId,
      nome: nome.trim(),
      cpf: cleanCpf,
      email: email.toLowerCase().trim(),
      cargo: 'Administrador',
      aprovacao_status: 'aprovado',
      ativo: true,
    })

    if (profErr) throw profErr

    // Assign admin role
    const { error: roleErr } = await supabaseAdmin.from('user_roles').insert({
      user_id: userId,
      role: 'admin',
    })

    if (roleErr) throw roleErr

    console.log(`[bootstrap-admin] Primeiro administrador criado: ${email}`)

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Administrador criado com sucesso!',
      userId 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('[bootstrap-admin] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})