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

    const { cpf, senha } = await req.json()

    if (!cpf || !senha) {
      return new Response(JSON.stringify({ error: 'CPF e senha são obrigatórios' }), { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    // Limpar CPF (apenas dígitos)
    const cleanCpf = cpf.replace(/\D/g, '')
    if (cleanCpf.length !== 11) {
      return new Response(JSON.stringify({ error: 'CPF inválido' }), { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    // Buscar o email do usuário pelo CPF
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, email, nome, ativo, aprovacao_status')
      .eq('cpf', cleanCpf)
      .maybeSingle()

    if (profileErr) {
      console.error("[login-with-cpf] Erro ao buscar perfil:", profileErr)
      return new Response(JSON.stringify({ error: 'Erro no servidor' }), { 
        status: 500, 
        headers: corsHeaders 
      })
    }

    if (!profile) {
      return new Response(JSON.stringify({ error: 'CPF não encontrado' }), { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    // Verificar se o usuário está ativo
    if (!profile.ativo) {
      return new Response(JSON.stringify({ error: 'Usuário desativado' }), { 
        status: 403, 
        headers: corsHeaders 
      })
    }

    // Verificar se o cadastro foi aprovado
    if (profile.aprovacao_status !== 'aprovado') {
      return new Response(JSON.stringify({ error: 'Aguardando aprovação do administrador' }), { 
        status: 403, 
        headers: corsHeaders 
      })
    }

    // Fazer login com o email encontrado
    const { data: authData, error: authErr } = await supabaseAdmin.auth.signInWithPassword({
      email: profile.email,
      password: senha,
    })

    if (authErr) {
      console.error("[login-with-cpf] Erro de autenticação:", authErr)
      return new Response(JSON.stringify({ error: 'CPF ou senha incorretos' }), { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    console.log(`[login-with-cpf] Login bem-sucedido para CPF ${cleanCpf}`)

    return new Response(JSON.stringify({ 
      success: true,
      session: authData.session,
      user: authData.user 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('[login-with-cpf] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: corsHeaders 
    })
  }
})