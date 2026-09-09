import { useAuth } from '@clerk/clerk-expo';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

export type AppRole = 'user' | 'admin';

type RoleContextValue = {
  role: AppRole | null;
  isAdmin: boolean;
  syncing: boolean;
};

const RoleContext = createContext<RoleContextValue>({
  role: null,
  isAdmin: false,
  syncing: true,
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      setSyncing(true);
      if (!isLoaded || !isSignedIn || !userId || !supabase) {
        setRole(null);
        setSyncing(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .rpc('sync_user', { p_clerk_user_id: userId })
          .single();
        if (error) throw error;
        const resolved = data as { role: string } | null;
        if (!cancelled && resolved) setRole(resolved.role as AppRole);
      } catch (error) {
        console.warn('Failed to sync role from Supabase', error);
      } finally {
        if (!cancelled) setSyncing(false);
      }
    }

    sync();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId]);

  return (
    <RoleContext.Provider value={{ role, isAdmin: role === 'admin', syncing }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}