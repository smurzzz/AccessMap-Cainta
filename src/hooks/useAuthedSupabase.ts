import { useSession } from '@clerk/clerk-expo';
import { useMemo } from 'react';

import { createSupabaseClient } from '@/lib/supabase';

export type AuthedSupabase = NonNullable<ReturnType<typeof createSupabaseClient>>;

export function useAuthedSupabase(): AuthedSupabase | null {
  const { session } = useSession();

  return useMemo(() => {
    if (!session) return null;
    return createSupabaseClient(() => session.getToken());
  }, [session]);
}