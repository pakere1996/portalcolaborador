-- Create storage bucket for documents
insert into storage.buckets (id, name, owner, created_at, updated_at)
values ('documentos', 'documentos', 'system', now(), now())
on conflict (id) do nothing;

-- Create policies for the bucket
create policy "Authenticated users can view documents"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'documentos');

create policy "Admins can upload documents"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'documentos'
    and (
      exists (
        select 1 from user_roles
        where user_roles.user_id = auth.uid()
        and user_roles.role = 'admin'
      )
    )
  );

create policy "Admins can delete documents"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'documentos'
    and (
      exists (
        select 1 from user_roles
        where user_roles.user_id = auth.uid()
        and user_roles.role = 'admin'
      )
    )
  );