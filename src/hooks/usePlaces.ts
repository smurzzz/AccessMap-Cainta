import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

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

  // Refetch when the screen regains focus so content added elsewhere (e.g. the
  // admin Add-Place form) is visible the moment the user navigates back — no
  // manual pull-to-refresh needed. The first focus coincides with the mount
  // fetch below, so it is skipped. Refetches are silent: once data has been
  // shown, later fetches keep the list on screen (no loading flash, no error
  // clobber) and just swap in fresher rows when they arrive.
  const hasData = useRef(false);
  const mounted = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (mounted.current) reload();
      else mounted.current = true;
    }, [reload]),
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!supabase) {
        setError('Supabase is not configured. Add your env keys to .env.');
        setLoading(false);
        return;
      }

      if (!hasData.current) setLoading(true);
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
        if (!hasData.current) setError(queryError.message);
      } else {
        setPlaces((data as Place[] | null) ?? []);
        hasData.current = true;
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [category, attempt]);

  return { places, loading, error, reload };
}
