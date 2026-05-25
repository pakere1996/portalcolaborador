## Visão geral

Você pediu um conjunto grande de mudanças. Vou organizar em **6 entregas** que podem ser implementadas em sequência, para você validar cada uma antes de seguir. Isso evita um único deploy gigante e difícil de testar.

---

## Entrega 1 — Remover badge "Edit with Lovable"

- Ocultar o badge nos sites publicados deste projeto (Folgas).
- Para os outros projetos da Pakerê (Trabalhe Conosco e os 2 sites públicos), preciso aplicar a mesma configuração — cada projeto Lovable tem essa flag separada. **Faço aqui agora e te aviso o que fazer nos outros**, ou me autoriza eu aplicar nos outros projetos via cross-project.
- Requer plano Pro+ (já é o caso, presumo).

---

## Entrega 2 — Limpeza do módulo admin (rápido)

- Remover do menu admin o "Calendário individual do colaborador".
- Manter apenas o **Calendário Geral** consolidado (já existe em `/admin/calendario`).
- Adicionar à visão geral indicadores de: ocupação por dia, dias bloqueados, trocas pendentes (contadores no topo).

---

## Entrega 3 — Limite configurável por dia + folga fixa semanal

**Banco:**
- Nova tabela `dia_config (data, limite_colaboradores int default 1)` — só armazena dias com limite ≠ 1.
- `profiles`: adicionar `data_nascimento date`, `folga_fixa_semana int` (0=dom … 6=sáb, nullable).
- Atualizar índice único de `folgas (data)` → permitir múltiplas folgas no mesmo dia até o limite.
- Validação via trigger: `count(folgas where data=X) <= limite_do_dia`.

**Frontend:**
- Calendário admin: clicar num dia → editar "limite de colaboradores".
- Indicador visual: badge "2/3 ocupado" / "lotado".
- Cadastro de funcionário: campos data de nascimento + folga fixa semanal.

---

## Entrega 4 — Prioridade de aniversário

- Quando `data_nascimento` cair em sábado/domingo de um mês "aberto para escolha":
  - O sistema cria uma **reserva de prioridade** automática (nova tabela `prioridades_aniversario` ou flag em `datas_bloqueadas` com `user_id_prioridade`).
  - Para os demais colaboradores, o dia aparece como 🎂 "Reservado para [Nome] (aniversário)" e não selecionável.
  - O aniversariante vê o dia destacado e pode escolher OU desistir.
  - Se ele escolher outra data ou clicar "desistir", o dia libera para os outros (respeitando o limite do dia).
- Job/cron mensal junto com o sorteio automático.

---

## Entrega 5 — Troca de folgas semanais

**Banco — nova tabela `trocas_folga`:**
- `solicitante_id`, `destinatario_id`
- `dia_original` (folga semanal do solicitante), `dia_solicitado` (folga semanal do destinatário)
- `solicitante_aprovou` bool, `destinatario_aprovou` bool
- `status` enum: pendente / aguardando_aprovacao / aprovada / recusada / cancelada
- `created_at`, `respondido_em`

**Fluxo:**
1. Colaborador A abre tela "Trocar folga" → escolhe colaborador B → propõe troca.
2. B recebe notificação → aprova ou recusa.
3. Quando ambos aprovam → atualiza `profiles.folga_fixa_semana` de cada um.
4. Admin recebe notificação e vê histórico em `/admin/trocas`.

**Telas novas:**
- `/trocas` (colaborador): solicitar, lista pendentes/históricas.
- `/admin/trocas`: histórico completo + filtros por status.

**Notificações:** tabela `notificacoes (user_id, tipo, payload, lida, created_at)` + indicador no topo do AppShell (sino com contador). Realtime via Supabase channels.

---

## Entrega 6 — Polimento visual

- Badges coloridos por status (verde/amarelo/vermelho).
- 🎂 ícone de aniversário no calendário.
- Tooltips nos badges de ocupação.
- Transições suaves nos cards do calendário.
- Atualização em tempo real (Realtime nas tabelas `folgas`, `trocas_folga`, `notificacoes`).

---

## Perguntas antes de começar

1. **Badge Lovable nos outros projetos**: aplico apenas neste projeto agora ou quer que eu rode nos 4 projetos? (Preciso confirmação para mexer nos outros.)
2. **Ordem**: começo pelas Entregas 1+2 (rápidas, alto impacto visual) e depois 3→4→5→6?
3. **Folga fixa semanal vs folga de fim de semana atual**: hoje o sistema é só sábado/domingo escolhível por mês. A "folga fixa semanal" (qualquer dia da semana) é um conceito **adicional** que coexiste? Ou substitui a lógica atual? (Pelo texto, parece coexistir — fixa semanal + folga extra de fds. Confirme.)
4. **Notificações**: in-app (sino) é suficiente, ou também por email?

Me responda essas 4 e já começo pelas Entregas 1 e 2 no mesmo turno.