import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Place } from '@/types';

interface UsePlaceResult {
  place: Place | null;
  loading: boolean;
  error: string | null;
}

export function usePlace(id: string | undefined): UsePlaceResult {
  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!supabase) {
        setError('Supabase is not configured. Add your env keys to .env.');
        setLoading(false);
        return;
      }

      if (!id) {
        setPlace(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('places')
        .select('*, accessibility_features(*)')
        .eq('id', id)
        .maybeSingle();

      if (cancelled) return;

      if (queryError) {
        setError(queryError.message);
      } else {
        setPlace((data as Place | null) ?? null);
      }
      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { place, loading, error };
}