import NearbyCard from '@/components/features/nearby-card';
import { AppIcon } from '@/components/ui/app-icon';
import EmptyState from '@/components/ui/empty-state';
import LoadingState from '@/components/ui/loading-state';
import { DesignType as T, M3 } from '@/constants/design-tokens';
import { usePlaces } from '@/hooks/usePlaces';
import { nearbyChips , withAlpha, matchesFilters, availableFeatureTypes } from '@/lib/display';
import React, {  useState } from 'react';
import {  Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFilters } from '@/contexts/filter-context';
import type { FeatureType } from '@/types';

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
          <View style={styles.homeLocationRow}>
            <AppIcon name="map-marker" size={16} color={M3.primary} />
            <Text style={styles.homeLocationText}>San Isidro, Cainta</Text>
          </View>
          <Text style={styles.homeGreetingTitle}>Where would you like to go?</Text>
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
                  <View style={[styles.homeChipDot, { backgroundColor: active ? M3.onPrimary : chip.dot }]} />
                  <Text style={[styles.homeChipText, active && styles.homeChipTextActive]}>{chip.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.homeNearbySection}>
          <View style={styles.homeNearbyHeader}>
            <Text style={styles.homeNearbyTitle}>Nearby Places</Text>
            <Text style={styles.homeNearbyCount}>{loading ? '…' : `${visible.length} locations`}</Text>
          </View>
          {error ? <EmptyState title="Could not load facilities" message={error} /> : null}
          {!error && loading ? <LoadingState label="Loading facilities…" /> : null}
          {!error && !loading && visible.length === 0 ? <EmptyState message="No facilities match your filters." /> : null}
          {!error && !loading ? visible.map((place) => <NearbyCard key={place.id} place={place} />) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  homeSafe: { flex: 1, backgroundColor: '#f8fafc' },
  homeScrollContent: { paddingBottom: 28 },
  homeGreeting: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 },
  homeLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  homeLocationText: { color: M3.secondary, fontSize: T['label-md'], lineHeight: 16, fontWeight: '500' },
  homeGreetingTitle: { color: M3.onSurface, fontSize: T['headline-md'], lineHeight: 30, fontWeight: '700', letterSpacing: -0.36, marginTop: -1 },
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
  homeChipsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 4 },
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
  homeChipDot: { width: 6, height: 6, borderRadius: 3 },
  homeChipText: { color: M3.onSurface, fontSize: T['label-md'], lineHeight: 16, fontWeight: '500' },
  homeChipTextActive: { color: M3.onPrimary },
  homeNearbySection: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 },
  homeNearbyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  homeNearbyTitle: { color: M3.onSurface, fontSize: T['title-md'], lineHeight: 22, fontWeight: '600', letterSpacing: -0.085 },
  homeNearbyCount: { color: M3.secondary, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600', letterSpacing: 0.33 },
});
