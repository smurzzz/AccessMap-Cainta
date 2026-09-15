import NearbyCard from '@/components/features/nearby-card';
import { AppIcon } from '@/components/ui/app-icon';
import EmptyState from '@/components/ui/empty-state';
import LoadingState from '@/components/ui/loading-state';
import { M3, DesignType as T } from '@/constants/design-tokens';
import { useFilters } from '@/contexts/filter-context';
import { usePlaces } from '@/hooks/usePlaces';
import { availableFeatureTypes, featureIcon, matchesFilters, nearbyChips, withAlpha } from '@/lib/display';
import type { FeatureType } from '@/types';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function HomeScreen() {
  const [activeFeature, setActiveFeature] = useState<FeatureType | null>(null);
  const [query, setQuery] = useState('');
  const { places, loading, error } = usePlaces();
  const { filters } = useFilters();
  const trimmed = query.trim().toLowerCase();
  const visible = places.filter((place) => {
    if (!matchesFilters(place, filters)) return false;
    if (activeFeature && !availableFeatureTypes(place).includes(activeFeature)) return false;
    if (trimmed && !place.name.toLowerCase().includes(trimmed)) return false;
    return true;
  });

  return (
    <SafeAreaView style={styles.homeSafe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.homeScrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.homeGreeting}>
          <View style={styles.homeGreetingRing} pointerEvents="none" />
          <View style={styles.homeGreetingRingSmall} pointerEvents="none" />
          <View style={styles.homeGreetingAccent} />
          <View style={styles.homeGreetingTop}>
            <View style={styles.homeLocationRow}>
              <AppIcon name="map-marker" size={15} color={M3.primary} />
              <Text style={styles.homeLocationText}>San Isidro, Cainta</Text>
            </View>
          </View>
          <Text style={styles.homeGreetingTitle}>Where would you like to go?</Text>
          <Text style={styles.homeGreetingSubtitle}>Find accessible places and services near you.</Text>
        </View>

        <View style={styles.homeSearchWrap}>
          <View style={styles.homeSearch}>
            <AppIcon name="magnify" size={20} color={M3.secondary} />
            <TextInput
              style={styles.homeSearchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search for a place..."
              placeholderTextColor={M3.secondary}
            />
          </View>
          <View style={styles.homeFilterPanel}>
            <Text style={styles.homeFilterLabel}>Accessibility needs</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.homeChipsRow}>
              {nearbyChips.map((chip) => {
                const active = activeFeature === chip.type;
                return (
                  <Pressable
                    key={chip.label}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter by ${chip.label}`}
                    accessibilityState={{ selected: active }}
                    hitSlop={6}
                    style={[styles.homeChip, active && styles.homeChipActive]}
                    onPress={() => setActiveFeature(chip.type)}
                  >
                    <AppIcon
                      name={chip.type ? featureIcon[chip.type] : 'format-list-bulleted'}
                      size={15}
                      color={active ? M3.onPrimary : chip.dot}
                    />
                    <Text style={[styles.homeChipText, active && styles.homeChipTextActive]}>{chip.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        <View style={styles.homeNearbySection}>
          <View style={styles.homeNearbyHeader}>
            <Text style={styles.homeNearbyTitle}>Nearby Places</Text>
            <Text style={styles.homeNearbyCount}>{loading ? '…' : `${visible.length} locations`}</Text>
          </View>
          {error ? <EmptyState title="Could not load facilities" message={error} /> : null}
          {!error && loading ? <LoadingState label="Loading facilities…" /> : null}
          {!error && !loading && visible.length === 0 ? <EmptyState message="No facilities match your filters." /> : null}
          {!error && !loading ? (
            <View style={styles.homeNearbyList}>
              {visible.map((place) => <NearbyCard key={place.id} place={place} />)}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  homeSafe: { flex: 1, backgroundColor: '#f1f6ff' },
  homeScrollContent: { paddingBottom: 28 },
  homeGreeting: { marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 16, backgroundColor: '#e8f1ff', borderWidth: 1, borderColor: '#c5dcff', shadowColor: '#0f2742', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1, gap: 5, overflow: 'hidden' },
  homeGreetingRing: { position: 'absolute', width: 148, height: 148, top: -76, right: -28, borderRadius: 74, borderWidth: 2, borderColor: '#c5dcff', opacity: 0.72 },
  homeGreetingRingSmall: { position: 'absolute', width: 82, height: 82, top: 30, right: 20, borderRadius: 41, borderWidth: 2, borderColor: '#c5dcff', opacity: 0.5 },
  homeGreetingAccent: { height: 3, width: 42, borderRadius: 999, backgroundColor: M3.primary, marginBottom: 3 },
  homeGreetingTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  homeLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  homeLocationText: { color: M3.primary, fontSize: T['label-md'], lineHeight: 16, fontWeight: '700' },
  homeGreetingTitle: { color: M3.onSurface, fontSize: T['headline-lg'], lineHeight: 34, fontWeight: '700', letterSpacing: -0.36 },
  homeGreetingSubtitle: { color: M3.secondary, fontSize: T['body-sm'], lineHeight: 18, marginTop: 4 },
  homeSearchWrap: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  homeSearch: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    backgroundColor: M3.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: withAlpha(M3.outlineVariant, 0.6),
    borderRadius: 12,
  },
  homeSearchInput: { flex: 1, padding: 0, color: M3.onSurface, fontSize: T['body-md'], lineHeight: 20 },
  homeFilterPanel: { gap: 9, padding: 12, borderRadius: 14, backgroundColor: '#f8fbff', borderWidth: 1, borderColor: '#d8e6f5' },
  homeFilterLabel: { color: M3.onSurfaceVariant, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '700', letterSpacing: 0.4 },
  homeChipsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 4 },
  homeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: M3.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: withAlpha(M3.outlineVariant, 0.6),
  },
  homeChipActive: { backgroundColor: M3.primary, borderColor: M3.primary },
  homeChipText: { color: M3.onSurface, fontSize: T['label-md'], lineHeight: 16, fontWeight: '500' },
  homeChipTextActive: { color: M3.onPrimary },
  homeNearbySection: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 },
  homeNearbyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  homeNearbyTitle: { color: M3.onSurface, fontSize: T['title-md'], lineHeight: 22, fontWeight: '600', letterSpacing: -0.085 },
  homeNearbyCount: { color: M3.secondary, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600', letterSpacing: 0.33 },
  homeNearbyList: { gap: 12 },
});
