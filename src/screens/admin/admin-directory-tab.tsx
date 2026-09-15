import { AppIcon } from '@/components/ui/app-icon';
import EmptyState from '@/components/ui/empty-state';
import LoadingState from '@/components/ui/loading-state';
import { CATEGORY_SHORT_LABELS } from '@/constants/catalog';
import { M3 } from '@/constants/design-tokens';
import { useAuthedSupabase } from '@/hooks/useAuthedSupabase';
import { usePlaces } from '@/hooks/usePlaces';
import { featureShortLabels, photoSource, withAlpha } from '@/lib/display';
import type { PlaceCategory } from '@/types';
import { Place } from '@/types';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export function AdminDirectoryTab({ drillCategory }: { drillCategory?: string }) {
  const authed = useAuthedSupabase();
  const { places, loading, error, reload } = usePlaces();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<PlaceCategory | 'all'>('all');

  // Analytics drill-down: when a category is requested, focus the matching pill.
  const [lastDrill, setLastDrill] = useState<string | undefined>(undefined);
  if (drillCategory !== lastDrill) {
    setLastDrill(drillCategory);
    setCategoryFilter(drillCategory ? (drillCategory as PlaceCategory) : 'all');
  }

  const confirmDelete = (place: Place) => {
    Alert.alert('Delete facility', `Delete "${place.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePlace(place.id) },
    ]);
  };

  const deletePlace = async (id: string) => {
    if (!authed) {
      Alert.alert('Session not ready', 'Sign-in session is still loading. Please try again.');
      return;
    }
    setDeleting(id);
    try {
      const { error: deleteError } = await authed.from('places').delete().eq('id', id);
      if (deleteError) throw deleteError;
      reload();
    } catch (deleteError) {
      console.warn('Delete failed', deleteError);
      Alert.alert('Delete failed', 'Could not delete the facility. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const trimmed = query.trim().toLowerCase();
  const visiblePlaces = places.filter((place) => {
    if (categoryFilter !== 'all' && place.category !== categoryFilter) return false;
    if (!trimmed) return true;
    return place.name.toLowerCase().includes(trimmed) || (place.address ?? '').toLowerCase().includes(trimmed);
  });
  const adminFilterPills: { value: PlaceCategory | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'hospital', label: 'Hospitals' },
    { value: 'health_center', label: 'Health Centers' },
    { value: 'government', label: 'Govt Offices' },
    { value: 'school', label: 'Schools' },
  ];

  return (
    <View style={styles.adminTabBody}>
      <ScrollView contentContainerStyle={styles.adminNewScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Directory page header */}
        <View style={styles.adminDirHeader}>
          <View style={styles.adminDirBackdropRing} pointerEvents="none" />
          <View style={styles.adminDirBackdropRingSmall} pointerEvents="none" />
          <View style={styles.adminDirAccent} />
          <View style={styles.adminDirHeaderTop}>
            <View style={styles.adminDirHeaderCopy}>
              <Text style={styles.adminDirEyebrow}>ADMIN DIRECTORY</Text>
              <Text style={styles.adminDirTitle}>Directory</Text>
            </View>
            <View style={styles.adminDirCountPill}>
              <Text style={styles.adminDirCount}>{loading ? '…' : `${places.length} places`}</Text>
            </View>
          </View>
          <Text style={styles.adminDirDescription}>Manage and view registered places and establishments in the directory.</Text>
          <View style={styles.adminDirStatusRow}>
            <View style={styles.adminDirStatusDot} />
            <Text style={styles.adminDirStatusText}>Registry synced and ready for updates</Text>
          </View>
          <View style={styles.adminDirStatsRow}>
            <View style={styles.adminDirStat}>
              <Text style={styles.adminDirStatValue}>{loading ? '—' : visiblePlaces.length}</Text>
              <Text style={styles.adminDirStatLabel}>SHOWING NOW</Text>
            </View>
            <Text style={styles.adminDirStatCaption}>Filtered directory results</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.adminSearchBox}>
          <AppIcon name="magnify" size={18} color="#94a3b8" />
          <TextInput
            style={styles.adminSearchInput}
            placeholder="Search facilities or streets..."
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={setQuery}
            accessibilityLabel="Search facilities"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} accessibilityLabel="Clear search" hitSlop={8}>
              <AppIcon name="close-circle" size={18} color="#94a3b8" />
            </Pressable>
          ) : null}
        </View>

        {/* Category filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.adminPillsRow}>
          {adminFilterPills.map((pill) => {
            const active = categoryFilter === pill.value;
            return (
              <Pressable
                key={pill.value}
                style={[styles.adminPill, active && styles.adminPillActive]}
                onPress={() => setCategoryFilter(pill.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Filter by ${pill.label}`}
                hitSlop={10}
              >
                <Text style={[styles.adminPillText, active && styles.adminPillTextActive]}>{pill.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Facility cards */}
        {error ? <EmptyState title="Could not load facilities" message={error} /> : null}
        {!error && loading ? <LoadingState label="Loading facility directory…" /> : null}
        {!error && !loading && places.length === 0 ? <EmptyState message="No facilities are registered yet. Add the first one below." /> : null}
        {!error && !loading && places.length > 0 && visiblePlaces.length === 0 ? (
          <EmptyState message="No facilities match your search or filter." />
        ) : null}
        {!error && !loading
          ? visiblePlaces.map((place) => {
            const availableFeatures = (place.accessibility_features ?? []).filter((feature) => feature.status === 'available');
            const unavailableFeatures = (place.accessibility_features ?? []).filter((feature) => feature.status === 'not_available');
            return (
              <View style={styles.adminFacilityCard} key={place.id}>
                <View style={styles.adminFacilityTop}>
                  <Image
                    source={photoSource(place)}
                    style={styles.adminFacilityPhoto}
                    contentFit="cover"
                    accessibilityLabel={`${place.name} sample photo`}
                  />
                  <View style={styles.adminFacilityMeta}>
                    <Text style={styles.adminFacilityCategory}>{CATEGORY_SHORT_LABELS[place.category]}</Text>
                    <Text style={styles.adminFacilityName} numberOfLines={2}>{place.name}</Text>
                    <Text style={styles.adminFacilityAddress} numberOfLines={1}>{place.address ?? 'Address not set'}</Text>
                  </View>
                  <View style={styles.adminFacilityActions}>
                    <Pressable
                      style={styles.adminFacilityActionBtn}
                      onPress={() => router.push({ pathname: '/admin/place-form', params: { id: place.id } })}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${place.name}`}
                      hitSlop={4}
                    >
                      <AppIcon name="pencil" size={18} color="#94a3b8" />
                    </Pressable>
                    {deleting === place.id ? (
                      <View style={styles.adminFacilityActionBtn}><ActivityIndicator size="small" color="#dc2626" /></View>
                    ) : (
                      <Pressable
                        style={styles.adminFacilityActionBtn}
                        onPress={() => confirmDelete(place)}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${place.name}`}
                        hitSlop={4}
                      >
                        <AppIcon name="delete-outline" size={18} color="#94a3b8" />
                      </Pressable>
                    )}
                  </View>
                </View>
                <View style={styles.adminFacilityBadges}>
                  {availableFeatures.slice(0, 3).map((feature) => (
                    <View style={styles.adminBadgeOk} key={feature.id}>
                      <Text style={styles.adminBadgeOkText}>{featureShortLabels[feature.feature_type]}</Text>
                    </View>
                  ))}
                  {unavailableFeatures.slice(0, 1).map((feature) => (
                    <View style={styles.adminBadgeNo} key={feature.id}>
                      <Text style={styles.adminBadgeNoText}>No {featureShortLabels[feature.feature_type]}</Text>
                    </View>
                  ))}
                  {availableFeatures.length === 0 && unavailableFeatures.length === 0 ? (
                    <Text style={styles.adminFacilityNoFeatures}>No accessibility features on record yet.</Text>
                  ) : null}
                </View>
              </View>
            );
          })
          : null}
      </ScrollView>

      {/* Sticky Add New Facility button */}
      <View style={styles.adminAddBar} pointerEvents="box-none">
        <Pressable
          style={styles.adminAddBtn}
          onPress={() => router.push('/admin/place-form')}
          accessibilityRole="button"
          accessibilityLabel="Add new facility to directory"
        >
          <AppIcon name="plus" size={18} color={M3.onPrimary} />
          <Text style={styles.adminAddBtnText}>Add Facility</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  adminTabBody: { flex: 1 },
  adminNewScroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 110, gap: 14 },
  adminDirHeader: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#c5dcff',
    backgroundColor: '#e8f1ff',
    gap: 10,
    shadowColor: '#0f2742',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
    overflow: 'hidden',
  },
  adminDirBackdropRing: { position: 'absolute', width: 148, height: 148, top: -76, right: -28, borderRadius: 74, borderWidth: 2, borderColor: '#c5dcff', opacity: 0.72 },
  adminDirBackdropRingSmall: { position: 'absolute', width: 82, height: 82, top: 30, right: 20, borderRadius: 41, borderWidth: 2, borderColor: '#c5dcff', opacity: 0.5 },
  adminDirAccent: { height: 3, width: 42, borderRadius: 999, backgroundColor: M3.primaryContainer },
  adminDirHeaderTop: { flexDirection: 'row', alignItems: 'center' },
  adminDirHeaderCopy: { flex: 1, minWidth: 0, gap: 1 },
  adminDirEyebrow: { color: M3.primaryContainer, fontSize: 10, lineHeight: 13, fontWeight: '700', letterSpacing: 1 },
  adminDirTitle: { color: '#0f172a', fontSize: 22, lineHeight: 27, fontWeight: '700', letterSpacing: -0.4 },
  adminDirCountPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
  },
  adminDirCount: { color: '#1d4ed8', fontSize: 11, lineHeight: 14, fontWeight: '700' },
  adminDirDescription: { color: '#64748b', fontSize: 12, lineHeight: 17 },
  adminDirStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2 },
  adminDirStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16a34a' },
  adminDirStatusText: { color: '#47705a', fontSize: 11, lineHeight: 14, fontWeight: '600' },
  adminDirStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#dbeafe' },
  adminDirStat: { gap: 2 },
  adminDirStatValue: { color: '#12345b', fontSize: 18, lineHeight: 21, fontWeight: '700' },
  adminDirStatLabel: { color: '#6b86a3', fontSize: 9, lineHeight: 12, fontWeight: '800', letterSpacing: 0.7 },
  adminDirStatCaption: { color: '#7790aa', fontSize: 11, lineHeight: 14, fontWeight: '500' },
  adminSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withAlpha('#e2e8f0', 0.9),
    backgroundColor: M3.surfaceContainerLowest,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  adminSearchInput: { flex: 1, color: M3.onSurface, fontSize: 12, paddingVertical: 0 },
  adminPillsRow: { gap: 8, paddingVertical: 2 },
  adminPill: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: M3.surfaceContainerLowest,
  },
  adminPillActive: { backgroundColor: M3.primaryContainer, borderColor: M3.primaryContainer },
  adminPillText: { color: '#475569', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  adminPillTextActive: { color: M3.onPrimary, fontWeight: '600' },
  adminFacilityCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withAlpha('#e2e8f0', 0.9),
    backgroundColor: M3.surfaceContainerLowest,
    gap: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  adminFacilityTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  adminFacilityPhoto: { width: 76, height: 76, borderRadius: 10, backgroundColor: M3.surfaceContainer },
  adminFacilityMeta: { flex: 1, minWidth: 0, gap: 2 },
  adminFacilityCategory: { color: '#94a3b8', fontSize: 10, lineHeight: 14, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  adminFacilityName: { color: '#0f172a', fontSize: 14, lineHeight: 20, fontWeight: '600', marginTop: 2 },
  adminFacilityAddress: { color: '#64748b', fontSize: 12, lineHeight: 17, flex: 1, marginTop: 4 },
  adminFacilityActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  adminFacilityActionBtn: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  adminFacilityBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  adminBadgeOk: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#ecfdf5',
  },
  adminBadgeOkText: { color: '#065f46', fontSize: 11, lineHeight: 15, fontWeight: '500' },
  adminBadgeNo: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#f1f5f9',
  },
  adminBadgeNoText: { color: '#64748b', fontSize: 11, lineHeight: 15, fontWeight: '500' },
  adminFacilityNoFeatures: { color: '#94a3b8', fontSize: 12, lineHeight: 16 },
  adminAddBar: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  adminAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 999,
    backgroundColor: M3.primaryContainer,
    shadowColor: '#2563eb',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  adminAddBtnText: { color: M3.onPrimary, fontSize: 12, lineHeight: 16, fontWeight: '600' },
});
