-- Create table to track document imports
create table if not exists documentos_importacao (
  id uuid primary key default gen_random_uuid(),
  nome_arquivo text not null,
  tamanho_bytes bigint not null,
  caminho_arquivo text not null,
  importado_por uuid references auth.users not null,
  status text default 'pendente' not null,
  data_importacao timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table documentos_importacao enable row level security;

-- Create policies
create policy "Admins can view all imports"
  on documentos_importacao
  for select
  to authenticated
  using (
    exists (
      select 1 from user_roles
      where user_roles.user_id = auth.uid()
      and user_roles.role = 'admin'
    )
  );

create policy "Admins can insert imports"
  on documentos_importacao
  for insert
  to authenticated
  with check (
    exists (
      select 1 from user_roles
      where user_roles.user_id = auth.uid()
      and user_roles.role = 'admin'
    )
  );

-- Create index for faster queries
create index if not exists idx_documentos_importacao_data_importacao on documentos_importacao(data_importacao desc);
create index if not exists idx_documentos_importacao_status on documentos_importacao(status);