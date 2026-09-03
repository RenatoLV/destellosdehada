import { createClient } from '@supabase/supabase-js';

const configuredUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const configuredAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

export const isSupabaseConfigured = Boolean(configuredUrl && configuredAnonKey);

// A valid inert URL keeps the visual shell renderable while configuration is
// missing. Every data service checks isSupabaseConfigured before a request.
const supabaseUrl = configuredUrl || 'https://configuration-required.supabase.co';
const supabaseAnonKey = configuredAnonKey || 'configuration-required';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export function requireSupabaseConfiguration() {
  if (!isSupabaseConfigured) {
    throw new Error('Configura EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }
}
