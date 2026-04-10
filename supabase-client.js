window.FINANZAS_SUPABASE_CONFIG = window.FINANZAS_SUPABASE_CONFIG || {
  url: 'https://vbjfksmcvpneljgnmoku.supabase.co',
  anonKey: 'sb_publishable_0c7aHkj6VUHmLb7zu0dwzg_DwxA0tsw',
  userEmail: 'admin@local.test',
};

const SUPABASE_URL = window.FINANZAS_SUPABASE_CONFIG.url;
const SUPABASE_ANON_KEY = window.FINANZAS_SUPABASE_CONFIG.anonKey;
const APP_USER_EMAIL = window.FINANZAS_SUPABASE_CONFIG.userEmail;

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.sb = sb;
 
