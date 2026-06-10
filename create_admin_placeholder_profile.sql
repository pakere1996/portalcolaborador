-- Cria um perfil placeholder para ser usado como destinatário de notificações administrativas
-- O ID 00000000-0000-0000-0000-000000000002 é usado no código da aplicação (src/lib/documentos.ts)
-- para o user_id das notificações administrativas.

INSERT INTO public.profiles (
    id,
    nome,
    cpf,
    cargo,
    ativo,
    aprovacao_status,
    data_admissao,
    cpf_validated
) VALUES (
    '00000000-0000-0000-0000-000000000002',
    'Sistema Administrativo',
    '00000000000', -- CPF placeholder
    'Administrador de Sistema',
    TRUE,
    'aprovado',
    NOW(),
    TRUE
)
ON CONFLICT (id) DO NOTHING;

-- O perfil deve existir para satisfazer a FK notificacoes_user_id_fkey