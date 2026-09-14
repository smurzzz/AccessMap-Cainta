import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

// --- Shared saved-places store ---
// One bookmark list shared by the map card, place details, and the profile's
// Saved Places section. Bookmarking anywhere syncs everywhere (and persists).
export type SavedPlacesState = { ids: readonly string[]; hydrated: boolean };

// Local persistence key for the profile screen (device keychain / browser storage).
const PROFILE_SAVED_KEY = 'accessmap.profile.saved.v1';

let savedPlacesState: SavedPlacesState = { ids: [], hydrated: false };
const savedPlacesListeners = new Set<() => void>();

function emitSavedPlacesChanged() {
  for (const listener of savedPlacesListeners) listener();
}

function setSavedPlacesState(next: SavedPlacesState) {
  savedPlacesState = next;
  emitSavedPlacesChanged();
}

// Loads the persisted saved list once; resolves when the store is ready.
function hydrateSavedPlaces(): Promise<void> {
  if (savedPlacesState.hydrated) return Promise.resolve();
  setSavedPlacesState({ ...savedPlacesState, hydrated: true });
  return SecureStore.getItemAsync(PROFILE_SAVED_KEY)
    .then((stored) => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as unknown;
          if (Array.isArray(parsed)) {
            setSavedPlacesState({
              ids: parsed.filter((value): value is string => typeof value === 'string'),
              hydrated: true,
            });
          }
        } catch {
          // ignore malformed stored saved list
        }
      }
    })
    .catch(() => {
      // storage unavailable — run with an in-memory list for this session
    });
}

function persistSavedPlaces(ids: readonly string[]) {
  SecureStore.setItemAsync(PROFILE_SAVED_KEY, JSON.stringify(ids)).catch(() => {
    // storage unavailable — saved places stay in memory for this session
  });
}

function toggleSavedPlaceInStore(placeId: string) {
  const ids = savedPlacesState.ids.includes(placeId)
    ? savedPlacesState.ids.filter((value) => value !== placeId)
    : [...savedPlacesState.ids, placeId];
  setSavedPlacesState({ ids, hydrated: true });
  persistSavedPlaces(ids);
}

export function useSavedPlaces() {
  const state = useSyncExternalStore(
    (listener) => {
      savedPlacesListeners.add(listener);
      void hydrateSavedPlaces();
      return () => savedPlacesListeners.delete(listener);
    },
    () => savedPlacesState,
    () => savedPlacesState,
  );
  return { savedIds: state.ids, hydrated: state.hydrated, toggleSaved: toggleSavedPlaceInStore };
}
