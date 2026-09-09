import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { FeatureType, Place, PlaceCategory } from '@/types';

function matchesAllSelected(place: Place, featureTypes: FeatureType[]): boolean {
  const available = new Set(
    (place.accessibility_features ?? [])
      .filter((feature) => feature.status === 'available')
      .map((feature) => feature.feature_type),
  );
  return featureTypes.every((featureType) => available.has(featureType));
}

interface UseAccessibilityFilterResult {
  places: Place[];
  loading: boolean;
  error: string | null;
}

export function useAccessibilityFilter(
  featureTypes: FeatureType[],
  category?: PlaceCategory,
): UseAccessibilityFilterResult {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const featureTypesKey = featureTypes.join(',');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!supabase) {
        setError('Supabase is not configured. Add your env keys to .env.');
        setLoading(false);
        return;
      }

      if (featureTypes.length === 0 && !category) {
        setPlaces([]);
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
        const allPlaces = (data as Place[] | null) ?? [];
        setPlaces(
          featureTypes.length > 0
            ? allPlaces.filter((place) => matchesAllSelected(place, featureTypes))
            : allPlaces,
        );
      }
      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [featureTypesKey, category]);

  return { places, loading, error };
}