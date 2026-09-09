import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Place, PlaceCategory } from '@/types';

interface UsePlacesResult {
  places: Place[];
  loading: boolean;
  error: string | null;
}

export function usePlaces(category?: PlaceCategory): UsePlacesResult {
  const [places, setPlaces] = useState<Place[]>([]);
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
  }, [category]);

  return { places, loading, error };
}