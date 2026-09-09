import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  if (__DEV__) {
    console.warn(
      'Missing Supabase environment variables. Add them to your .env file.',
    );
  }
}

// Public (anon) client — used for reads that are open to everyone.
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const supabasePublicUrl = supabaseUrl ?? '';
export const supabaseBucketName = 'place-photos';

// Authenticated client for admin writes. The accessToken is Clerk's session
// token, which (via the native Supabase + Clerk integration) carries the
// role=authenticated claim so RLS's auth.jwt()->>'sub' resolves to the
// Clerk user id.
export function createSupabaseClient(getAccessToken: () => Promise<string | null>) {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    accessToken: getAccessToken,
  });
}