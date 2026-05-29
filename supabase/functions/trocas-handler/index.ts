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

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) return new Response('Invalid token', { status: 401, headers: corsHeaders })

    const { action, swapId } = await req.json()
    console.log(`[trocas-handler] Action: ${action} for swap ${swapId} by user ${user.id}`)

    if (action === 'accept') {
      // 1. Buscar a troca para validar
      const { data: swap, error: swapErr } = await supabaseAdmin
        .from('trocas_folga')
        .select('*')
        .eq('id', swapId)
        .single()

      if (swapErr || !swap) throw new Error('Troca não encontrada')
      if (swap.status !== 'pendente' || swap.destinatario_id !== null) {
        throw new Error('Esta troca não está mais disponível')
      }
      if (swap.solicitante_id === user.id) {
        throw new Error('Você não pode aceitar sua própria solicitação')
      }

      // 2. Validar se o usuário tem folga na data solicitada
      const { data: folga, error: folgaErr } = await supabaseAdmin
        .from('folgas')
        .select('id')
        .eq('user_id', user.id)
        .eq('data', swap.data_destinatario)
        .maybeSingle()

      if (folgaErr || !folga) {
        throw new Error('Você precisa ter uma folga agendada neste dia para realizar a troca')
      }

      // 3. Processar a troca (Transação simulada)
      // Atualizar a troca
      const { error: updateErr } = await supabaseAdmin
        .from('trocas_folga')
        .update({ 
          status: 'aprovada', 
          destinatario_id: user.id,
          respondido_em: new Date().toISOString() 
        })
        .eq('id', swapId)

      if (updateErr) throw updateErr

      // Criar nova folga para o solicitante
      await supabaseAdmin.from('folgas').insert({
        user_id: swap.solicitante_id,
        data: swap.data_destinatario,
        mes: swap.data_destinatario.substring(0, 7),
        tipo: 'troca',
        criado_por: user.id
      })

      // Cancelar a folga original do destinatário (quem está aceitando)
      await supabaseAdmin.from('folgas_canceladas').insert({
        user_id: user.id,
        data: swap.data_destinatario,
        motivo: 'Troca de folga aprovada'
      })

      // Notificar o solicitante
      await supabaseAdmin.from('notificacoes').insert({
        user_id: swap.solicitante_id,
        tipo: 'troca_aprovada',
        titulo: 'Troca de folga aprovada!',
        mensagem: `Sua solicitação de troca para o dia ${swap.data_destinatario} foi aceita.`,
        link: '/historico'
      })

      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders })
  } catch (error) {
    console.error('[trocas-handler] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})