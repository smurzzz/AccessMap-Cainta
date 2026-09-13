import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { FeatureType, PlaceCategory } from '@/types';

/**
 * App-wide accessibility filters, edited on the Filter screen and applied on
 * Home, Explore, and Map. Persisted locally so they survive restarts.
 */
export type AppFilters = {
  /** Required accessibility features — places must have all of them available. */
  features: FeatureType[];
  /** Facility category filter, or 'all'. */
  category: PlaceCategory | 'all';
  /** Distance radius in km from the user, or null for any distance. */
  radiusKm: number | null;
};

export const DEFAULT_FILTERS: AppFilters = {
  features: ['ramp', 'restroom', 'parking', 'entrance'],
  category: 'all',
  radiusKm: 3,
};

const STORAGE_KEY = 'accessmap.filters.v1';

type FilterContextValue = {
  filters: AppFilters;
  setFilters: (next: AppFilters) => void;
  /** True once stored filters have been loaded (avoids overwriting storage too early). */
  ready: boolean;
};

const FilterContext = createContext<FilterContextValue>({
  filters: DEFAULT_FILTERS,
  setFilters: () => {},
  ready: false,
});

function parseFilters(raw: string): AppFilters | null {
  try {
    const parsed = JSON.parse(raw) as Partial<AppFilters> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    const features = Array.isArray(parsed.features)
      ? parsed.features.filter((value): value is FeatureType => typeof value === 'string')
      : DEFAULT_FILTERS.features;
    const category: PlaceCategory | 'all' = parsed.category ?? DEFAULT_FILTERS.category;
    const radiusKm =
      typeof parsed.radiusKm === 'number' || parsed.radiusKm === null
        ? parsed.radiusKm
        : DEFAULT_FILTERS.radiusKm;
    return { features, category, radiusKm };
  } catch {
    return null;
  }
}

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFiltersState] = useState<AppFilters>(DEFAULT_FILTERS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(STORAGE_KEY);
        if (!cancelled && stored) {
          const parsed = parseFilters(stored);
          if (parsed) setFiltersState(parsed);
        }
      } catch {
        // storage unavailable — keep defaults for this session
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setFilters = (next: AppFilters) => {
    setFiltersState(next);
    SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next)).catch(() => {
      // storage unavailable — filters stay in memory for this session
    });
  };

  return (
    <FilterContext.Provider value={{ filters, setFilters, ready }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  return useContext(FilterContext);
}
