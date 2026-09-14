import PlaceCard from '@/components/features/place-card';
import EmptyState from '@/components/ui/empty-state';
import LoadingState from '@/components/ui/loading-state';
import Screen from '@/components/ui/screen';
import { usePlaces } from '@/hooks/usePlaces';
import { DesignColors as C, DesignType as T } from '@/constants/design-tokens';
import { useFilters } from '@/contexts/filter-context';
import { matchesFilters, tabsRoute } from '@/lib/display';
import { router } from 'expo-router';
import React, {  useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/ui/app-icon';
import type { PlaceCategory } from '@/types';

export function ExploreScreen() {
  const [activeCategory, setActiveCategory] = useState<PlaceCategory | null>(null);
  const { places, loading, error } = usePlaces(activeCategory ?? undefined);
  const { filters } = useFilters();
  const categories: { label: string; value: PlaceCategory | null }[] = [
    { label: 'All', value: null },
    { label: 'Health Centers', value: 'health_center' },
    { label: 'Hospitals', value: 'hospital' },
    { label: 'Civic Offices', value: 'government' },
  ];
  // Shared filters from the Filter screen apply on top of the local category chip.
  const filteredPlaces = places.filter((place) => matchesFilters(place, filters));

return (
    <Screen>
      <View style={styles.exploreHeading}>
        <Text style={styles.screenTitle}>Explore Places</Text>
        <Text style={styles.verifiedCount}>{loading ? 'Loading' : `${filteredPlaces.length} listings`}</Text>
      </View>
      <View style={styles.exploreSearchRow}>
        <Pressable
          style={styles.exploreSearch}
          onPress={() => router.push(tabsRoute)}
          accessibilityRole="search"
          accessibilityLabel="Search places on the home screen"
        >
          <AppIcon name="magnify" size={20} color={C.muted} />
          <Text style={styles.exploreSearchText}>Search places, facilities...</Text>
        </Pressable>
        <Pressable
          style={styles.filterShortcut}
          onPress={() => router.push('/(tabs)/filter')}
          accessibilityRole="button"
          accessibilityLabel="Open filters"
        >
          <AppIcon name="tune-variant" size={20} color={C.navy} />
          <Text style={styles.filterShortcutText}>Filter</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.exploreChips}>
        {categories.map((category) => <Pressable key={category.label} onPress={() => setActiveCategory(category.value)} style={[styles.exploreChip, activeCategory === category.value && styles.exploreChipActive]} accessibilityRole="button" accessibilityState={{ selected: activeCategory === category.value }}><Text style={[styles.exploreChipText, activeCategory === category.value && styles.exploreChipTextActive]}>{category.label}</Text></Pressable>)}
      </ScrollView>
      {error ? <EmptyState title="Could not load facilities" message={error} /> : null}
      {loading ? <LoadingState label="Finding places…" /> : null}
      {!loading && !error && filteredPlaces.length === 0 ? <EmptyState message="No facilities match your filters." /> : null}
      {!loading && !error ? filteredPlaces.map((place) => <PlaceCard key={place.id} place={place} featured />) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  exploreHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  screenTitle: { color: C.ink, fontSize: T['display-md'], lineHeight: 32, fontWeight: '800' },
  verifiedCount: { color: C.muted, fontSize: T['label-sm'] },
  exploreSearchRow: { flexDirection: 'row', gap: 8 },
  exploreSearch: { minHeight: 44, borderRadius: 12, backgroundColor: C.card, paddingHorizontal: 12, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#E9ECF6' },
  exploreSearchText: { color: C.muted, fontSize: T['body-sm'] },
  filterShortcut: { minHeight: 44, borderRadius: 12, backgroundColor: C.card, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#E9ECF6' },
  filterShortcutText: { color: C.ink, fontSize: T['label-sm'], fontWeight: '800' },
  exploreChips: { gap: 8, paddingRight: 16 },
  exploreChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: '#E5E9F4' },
  exploreChipActive: { backgroundColor: C.navy, borderColor: C.navy },
  exploreChipText: { color: C.muted, fontSize: T['label-sm'] },
  exploreChipTextActive: { color: C.white },
});
