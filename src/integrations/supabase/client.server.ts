import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://pjogistzpszkcjucktrv.supabase.co";
// O Service Role Key deve ser usado apenas no servidor (Server Functions)
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});