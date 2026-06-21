import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FolgaRecord {
  user_id: string;
  data: string;
  mes: string;
  tipo: 'sabado' | 'domingo';
  extra: boolean;
  criado_por?: string | null;
}

interface Profile {
  id: string;
  data_nascimento?: string | null;
}

interface Prioridade {
  user_id: string;
  data: string;
  status: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Verifica autenticação e permissão de admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Verifica role admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Admin role required' }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const { ano, mes } = await req.json();
    const targetAno = ano || new Date().getFullYear();
    const targetMes = mes || new Date().getMonth() + 2; // próximo mês

    console.log(`[sorteio-folgas] Iniciando sorteio para ${targetMes}/${targetAno}`);

    // 1. Buscar colaboradores ativos e aprovados
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, data_nascimento')
      .eq('ativo', true)
      .eq('aprovacao_status', 'aprovado');

    if (profilesError) throw profilesError;

    // 2. Buscar prioridades de aniversário ativas para o mês alvo
    const startDate = `${targetAno}-${String(targetMes).padStart(2, '0')}-01`;
    const endDate = new Date(targetAno, targetMes, 0);
    const endStr = `${targetAno}-${String(targetMes).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    const { data: prioridades, error: prioError } = await supabaseAdmin
      .from('prioridade_aniversario')
      .select('user_id, data, status')
      .eq('status', 'ativa')
      .gte('data', startDate)
      .lte('data', endStr);

    if (prioError) throw prioError;

    const prioridadeMap = new Map<string, Prioridade>();
    for (const p of prioridades || []) {
      prioridadeMap.set(p.user_id, p);
    }

    // 3. Buscar folgas já marcadas para o mês alvo (apenas mensais, não extra)
    const { data: folgasExistentes, error: folgasError } = await supabaseAdmin
      .from('folgas')
      .select('user_id, data')
      .eq('mes', `${targetAno}-${String(targetMes).padStart(2, '0')}`)
      .or('tipo.eq.sabado,tipo.eq.domingo')
      .eq('extra', false);

    if (folgasError) throw folgasError;

    const usersWithFolga = new Set(folgasExistentes?.map(f => f.user_id) || []);
    const datesWithFolga = new Set(folgasExistentes?.map(f => f.data) || []);

    // 4. Buscar limites por dia (dayLimits)
    const { data: dayLimitsData, error: limitsError } = await supabaseAdmin
      .from('dia_config')
      .select('data, limite_colaboradores')
      .gte('data', startDate)
      .lte('data', endStr);

    if (limitsError) throw limitsError;

    const dayLimits = new Map<string, number>();
    for (const item of dayLimitsData || []) {
      dayLimits.set(item.data, item.limite_colaboradores);
    }

    // 5. Buscar bloqueios manuais (datas_bloqueadas com liberada=false)
    const { data: blockedData, error: blockedError } = await supabaseAdmin
      .from('datas_bloqueadas')
      .select('data')
      .eq('liberada', false)
      .gte('data', startDate)
      .lte('data', endStr);

    if (blockedError) throw blockedError;

    const blockedDates = new Set(blockedData?.map(b => b.data) || []);

    // 6. Gerar lista de sábados e domingos do mês alvo
    const dates: Date[] = [];
    const current = new Date(targetAno, targetMes - 1, 1);
    while (current.getMonth() === targetMes - 1) {
      const day = current.getDay();
      if (day === 0 || day === 6) {
        dates.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }

    // 7. Lógica de sorteio
    const resultados: { user_id: string; data: string }[] = [];
    const usuariosSemFolga = profiles.filter(p => !usersWithFolga.has(p.id));

    for (const profile of usuariosSemFolga) {
      const userId = profile.id;
      const birthDate = profile.data_nascimento ? new Date(profile.data_nascimento) : null;
      let dataEscolhida: string | null = null;

      // 7a. Se tem aniversário em fim de semana e prioridade ativa, atribui automaticamente no dia do aniversário
      if (birthDate) {
        const birthDay = birthDate.getDate();
        const birthMonth = birthDate.getMonth() + 1;
        // Verifica se o aniversário cai no mês alvo
        if (birthMonth === targetMes) {
          const aniversario = new Date(targetAno, targetMes - 1, birthDay);
          const dayOfWeek = aniversario.getDay();
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            const iso = aniversario.toISOString().split('T')[0];
            // Verifica se a prioridade está ativa
            const prio = prioridadeMap.get(userId);
            if (prio && prio.status === 'ativa') {
              // Atribui a folga no aniversário
              dataEscolhida = iso;
              // Marca prioridade como usada
              await supabaseAdmin
                .from('prioridade_aniversario')
                .update({ status: 'usada' })
                .eq('user_id', userId)
                .eq('data', iso);
            }
          }
        }
      }

      // 7b. Se não tiver data por aniversário, tenta encontrar um fim de semana disponível
      if (!dataEscolhida) {
        // Ordena as datas por preferência: primeiro os sábados, depois domingos? ou aleatório?
        const shuffled = [...dates].sort(() => Math.random() - 0.5);
        for (const d of shuffled) {
          const iso = d.toISOString().split('T')[0];
          // Verifica se não está bloqueado, não está ocupada, e respeita limite
          if (blockedDates.has(iso)) continue;
          if (datesWithFolga.has(iso)) continue;
          const limite = dayLimits.get(iso) || 1;
          // Conta quantas folgas mensais (extra=false) já existem nessa data
          const count = folgasExistentes?.filter(f => f.data === iso).length || 0;
          if (count < limite) {
            dataEscolhida = iso;
            break;
          }
        }
      }

      // 7c. Se ainda não encontrou data (devido a lotação), aplica a regra de último recurso
      if (!dataEscolhida) {
        // Tenta os últimos fins de semana do mês, permitindo ultrapassar limite (atribuição forçada extra)
        const reversed = [...dates].reverse();
        for (const d of reversed) {
          const iso = d.toISOString().split('T')[0];
          if (blockedDates.has(iso)) continue;
          // Não verifica limite, apenas se não está bloqueado
          dataEscolhida = iso;
          break;
        }
        // Se mesmo assim não tiver data, pula (não deveria acontecer)
        if (!dataEscolhida) continue;
      }

      // 8. Insere a folga
      const tipo: 'sabado' | 'domingo' = new Date(dataEscolhida).getDay() === 6 ? 'sabado' : 'domingo';
      const mesKey = `${targetAno}-${String(targetMes).padStart(2, '0')}`;

      const novaFolga: FolgaRecord = {
        user_id: userId,
        data: dataEscolhida,
        mes: mesKey,
        tipo: tipo,
        extra: false, // será false para sorteios normais, mas se for último recurso pode ser true? A regra: se ultrapassar limite, deve ser extra? A descrição: "atribuição forçada de último recurso, marcada com a flag de inserção administrativa (para não contar contra o limite de ninguém depois)." Então se foi por último recurso (ultrapassou limite), setamos extra=true.
      };

      // Verifica se ultrapassou o limite (se a data escolhida já tem count >= limite)
      const limite = dayLimits.get(dataEscolhida) || 1;
      const count = folgasExistentes?.filter(f => f.data === dataEscolhida).length || 0;
      if (count >= limite) {
        novaFolga.extra = true; // força extra
      }

      const { error: insertError } = await supabaseAdmin
        .from('folgas')
        .insert(novaFolga);

      if (insertError) {
        console.error(`Erro ao inserir folga para ${userId}:`, insertError);
        continue;
      }

      resultados.push({ user_id: userId, data: dataEscolhida });

      // Atualiza o conjunto de datas ocupadas
      datesWithFolga.add(dataEscolhida);
    }

    // 9. Notificar admin sobre folgas forçadas (extra)
    const extras = resultados.filter(r => {
      const folga = folgasExistentes?.find(f => f.data === r.data);
      const count = folgasExistentes?.filter(f => f.data === r.data).length || 0;
      const limite = dayLimits.get(r.data) || 1;
      return count > limite; // se ultrapassou, é extra
    });

    if (extras.length > 0) {
      await supabaseAdmin
        .from('notificacoes')
        .insert({
          user_id: user.id, // admin que chamou a função
          tipo: 'sorteio_extra',
          titulo: 'Folgas forçadas atribuídas',
          mensagem: `${extras.length} colaboradores receberam folgas extras por falta de vagas.`,
          link: '/admin/calendario',
        });
    }

    return new Response(JSON.stringify({ success: true, results: resultados }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[sorteio-folgas] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});