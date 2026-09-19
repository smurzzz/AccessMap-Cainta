import PlaceCard from '@/components/features/place-card';
import { AppIcon } from '@/components/ui/app-icon';
import EmptyState from '@/components/ui/empty-state';
import LoadingState from '@/components/ui/loading-state';
import Screen from '@/components/ui/screen';
import { DesignColors as C, DesignType as T } from '@/constants/design-tokens';
import { useFilters } from '@/contexts/filter-context';
import { usePlaces } from '@/hooks/usePlaces';
import { matchesFilters, tabsRoute } from '@/lib/display';
import type { PlaceCategory } from '@/types';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export function ExploreScreen() {
  const [activeCategory, setActiveCategory] = useState<PlaceCategory | null>(null);
  const { places, loading, error, reload } = usePlaces(activeCategory ?? undefined);
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
    <Screen backgroundColor="#f1f6ff">
      <View style={styles.exploreHeader}>
        <View style={styles.exploreHeaderRing} pointerEvents="none" />
        <View style={styles.exploreHeaderRingSmall} pointerEvents="none" />
        <View style={styles.exploreHeaderAccent} />
        <View style={styles.exploreHeading}>
          <View style={styles.exploreHeadingCopy}>
            <Text style={styles.exploreEyebrow}>DISCOVER ACCESSIBLE PLACES</Text>
            <Text style={styles.screenTitle}>Explore Places</Text>
          </View>
          <View style={styles.verifiedCountPill}>
            <Text style={styles.verifiedCount}>{loading ? 'Loading' : `${filteredPlaces.length} listings`}</Text>
          </View>
        </View>
        <Text style={styles.exploreDescription}>Browse verified facilities and services around Cainta.</Text>
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
      {error ? (
        <View>
          <EmptyState title="Could not load facilities" message={error} />
          <Pressable
            style={styles.exploreRetryBtn}
            onPress={reload}
            accessibilityRole="button"
            accessibilityLabel="Retry loading facilities"
          >
            <Text style={styles.exploreRetryText}>↻  Try Again</Text>
          </Pressable>
        </View>
      ) : null}
      {loading ? <LoadingState label="Finding places…" /> : null}
      {!loading && !error && filteredPlaces.length === 0 ? <EmptyState message="No facilities match your filters." /> : null}
      {!loading && !error ? filteredPlaces.map((place) => <PlaceCard key={place.id} place={place} featured />) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  exploreHeader: { padding: 16, borderRadius: 16, backgroundColor: '#e8f1ff', borderWidth: 1, borderColor: '#c5dcff', shadowColor: '#0f2742', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1, gap: 8, overflow: 'hidden' },
  exploreHeaderRing: { position: 'absolute', width: 148, height: 148, top: -76, right: -28, borderRadius: 74, borderWidth: 2, borderColor: '#c5dcff', opacity: 0.72 },
  exploreHeaderRingSmall: { position: 'absolute', width: 82, height: 82, top: 30, right: 20, borderRadius: 41, borderWidth: 2, borderColor: '#c5dcff', opacity: 0.5 },
  exploreHeaderAccent: { height: 3, width: 42, borderRadius: 999, backgroundColor: C.navy, marginBottom: 3 },
  exploreHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  exploreHeadingCopy: { flex: 1, minWidth: 0, gap: 6 },
  exploreEyebrow: { color: C.navy, fontSize: 10, lineHeight: 13, fontWeight: '700', letterSpacing: 1 },
  screenTitle: { color: C.ink, fontSize: T['headline-lg'], lineHeight: 34, fontWeight: '700', letterSpacing: -0.36 },
  verifiedCountPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', flexShrink: 0 },
  verifiedCount: { color: '#1d4ed8', fontSize: T['label-sm'], fontWeight: '700' },
  exploreDescription: { color: C.muted, fontSize: T['body-sm'], lineHeight: 18 },
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
  exploreRetryBtn: { alignSelf: 'center', marginTop: 4, marginBottom: 16, backgroundColor: C.navy, paddingHorizontal: 20, minHeight: 48, justifyContent: 'center', borderRadius: 10 },
  exploreRetryText: { color: C.white, fontSize: T['link-md'], lineHeight: 18, fontWeight: '600' },
});
