import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Place, PlaceCategory } from '@/types';

interface UsePlacesResult {
  places: Place[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function usePlaces(category?: PlaceCategory): UsePlacesResult {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!supabase) {
        setError('Supabase is not configured. Add your env keys to .env.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      let query = supabase
        .from('places')
        .select('*, accessibility_features(*)')
        .order('name');

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error: queryError } = await query;

      if (cancelled) return;

      if (queryError) {
        setError(queryError.message);
      } else {
        setPlaces((data as Place[] | null) ?? []);
      }
      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [category, attempt]);

  return { places, loading, error, reload };
}