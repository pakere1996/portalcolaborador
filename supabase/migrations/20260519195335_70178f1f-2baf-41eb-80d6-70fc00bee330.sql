
-- Create initial admin user
DO $$
DECLARE
  new_user_id uuid;
  existing_id uuid;
BEGIN
  SELECT id INTO existing_id FROM auth.users WHERE email = '75619245187@pizzaria.local';

  IF existing_id IS NULL THEN
    new_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      '75619245187@pizzaria.local',
      crypt('@Pkradm96', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nome','Administrador Pakerê','cpf','75619245187','cargo','Administrador'),
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), new_user_id,
      jsonb_build_object('sub', new_user_id::text, 'email', '75619245187@pizzaria.local'),
      'email', new_user_id::text, now(), now(), now());
  ELSE
    new_user_id := existing_id;
    UPDATE auth.users SET encrypted_password = crypt('@Pkradm96', gen_salt('bf')), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE id = new_user_id;
  END IF;

  INSERT INTO public.profiles (id, nome, cpf, cargo, ativo)
  VALUES (new_user_id, 'Administrador Pakerê', '75619245187', 'Administrador', true)
  ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, cpf = EXCLUDED.cpf, cargo = EXCLUDED.cargo, ativo = true;

  INSERT INTO public.user_roles (user_id, role) VALUES (new_user_id, 'admin')
  ON CONFLICT DO NOTHING;
END $$;
