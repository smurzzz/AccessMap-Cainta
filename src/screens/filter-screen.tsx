import { AppIcon } from '@/components/ui/app-icon';
import { DesignType as T, M3 } from '@/constants/design-tokens';
import { useFilters, AppFilters, DEFAULT_FILTERS } from '@/contexts/filter-context';
import { router } from 'expo-router';
import React, {  useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withAlpha } from '@/lib/display';
import type { IconName } from '@/lib/display';
import type { PlaceCategory , FeatureType } from '@/types';

export function FilterScreen() {
  const { filters, setFilters } = useFilters();
  const [draft, setDraft] = useState<AppFilters>(filters);
  const [lastFilters, setLastFilters] = useState<AppFilters>(filters);
  const activeCount = draft.features.length;

  // Adopt newly applied/persisted filters (tabs stay mounted, so reset on change during render).
  if (lastFilters !== filters) {
    setLastFilters(filters);
    setDraft(filters);
  }

  const filterFeatures: { type: FeatureType; title: string; subtitle: string; icon: IconName }[] = [
    { type: 'ramp', title: 'Step-Free / Ramp Access', subtitle: 'Prioritize entrance ramps, wide slope grade ≤ 1:12', icon: 'wheelchair-accessibility' },
    { type: 'restroom', title: 'Accessible Restroom', subtitle: 'Ground floor, grab bars, wide door ≥ 80cm', icon: 'toilet' },
    { type: 'elevator', title: 'Elevator Available', subtitle: 'Braille tactile buttons & multi-level clearance', icon: 'elevator-passenger' },
    { type: 'parking', title: 'Accessible Parking', subtitle: 'Designated PWD vehicle spaces adjacent to entrance', icon: 'parking' },
    { type: 'entrance', title: 'Automatic / Wide Entrance', subtitle: 'Power-assisted sliding or wide double clearance doors', icon: 'door-open' },
  ];

  const facilityTypes: { value: PlaceCategory | 'all'; label: string; icon: IconName }[] = [
    { value: 'all', label: 'All Facilities', icon: 'domain' },
    { value: 'hospital', label: 'Hospitals & Clinics', icon: 'hospital' },
    { value: 'government', label: 'Civic & Public', icon: 'bank' },
    { value: 'health_center', label: 'Community Hubs', icon: 'account-group' },
  ];

  const radiusOptions: { label: string; value: number | null }[] = [
    { label: '1 km', value: 1 },
    { label: '3 km', value: 3 },
    { label: '5 km', value: 5 },
    { label: 'Any', value: null },
  ];

  const reset = () => setDraft(DEFAULT_FILTERS);

  return (
    <SafeAreaView style={styles.filterSafe} edges={['top']}>
      {/* Header: close + reset */}
      <View style={styles.filterTopBar}>
        <Pressable style={styles.filterIconBtn} onPress={() => router.back()} accessibilityLabel="Close modal" accessibilityRole="button">
          <AppIcon name="close" size={24} color={M3.onSurface} />
        </Pressable>
        <Pressable onPress={reset} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.filterResetText}>Reset</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.filterScrollContent} showsVerticalScrollIndicator={false}>
        {/* Admin-verified status note */}
        <View style={styles.filterNote}>
          <AppIcon name="check-decagram" size={16} color={M3.primaryContainer} />
          <Text style={styles.filterNoteText}>ADMIN-VERIFIED LISTINGS  •  SAN ISIDRO, CAINTA</Text>
        </View>

        {/* Active filter summary */}
        <View style={styles.filterSummaryRow}>
          <View style={styles.filterSummaryLeft}>
            <AppIcon name="tune-variant" size={18} color={M3.primaryContainer} />
            <Text style={styles.filterActiveText}>{activeCount} mobility {activeCount === 1 ? 'requirement' : 'requirements'} active</Text>
          </View>
          <View style={styles.filterActivePill}>
            <Text style={styles.filterActivePillText}>Active</Text>
          </View>
        </View>

        {/* Section: Core Mobility Features */}
        <View style={styles.filterSection}>
          <View style={styles.filterSectionHeader}>
            <Text style={styles.filterSectionTitle}>Core Mobility Features</Text>
            <Text style={styles.filterSectionCaption}>Physical Access</Text>
          </View>
          <View style={styles.filterCard}>
            {filterFeatures.map((feature) => {
              const active = draft.features.includes(feature.type);
              const toggleFeature = () =>
                setDraft((current) => ({
                  ...current,
                  features: current.features.includes(feature.type)
                    ? current.features.filter((value) => value !== feature.type)
                    : [...current.features, feature.type],
                }));
              return (
                <Pressable
                  key={feature.type}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`Toggle ${feature.title}`}
                  style={styles.filterFeatureRow}
                  onPress={toggleFeature}
                >
                  <View style={[styles.filterFeatureIcon, !active && styles.filterFeatureIconOff]}>
                    <AppIcon name={feature.icon} size={20} color={active ? M3.primaryContainer : M3.secondary} />
                  </View>
                  <View style={styles.filterFeatureTexts}>
                    <Text style={styles.filterFeatureTitle}>{feature.title}</Text>
                    <Text style={styles.filterFeatureSub}>{feature.subtitle}</Text>
                  </View>
                  <View style={[styles.filterSwitchTrack, active && styles.filterSwitchTrackOn]}>
                    <View style={[styles.filterSwitchThumb, active && styles.filterSwitchThumbOn]} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Section: Facility Type */}
        <View style={styles.filterSection}>
          <View style={styles.filterSectionHeader}>
            <Text style={styles.filterSectionTitle}>Facility Type</Text>
            <Text style={styles.filterSectionCaption}>San Isidro District</Text>
          </View>
          <View style={styles.filterCatGrid}>
            {facilityTypes.map((item) => {
              const active = draft.category === item.value;
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Show ${item.label}`}
                  style={[styles.filterCatPill, active && styles.filterCatPillActive]}
                  onPress={() => setDraft((current) => ({ ...current, category: item.value }))}
                >
                  <AppIcon name={item.icon} size={18} color={active ? M3.onPrimary : M3.secondary} />
                  <Text style={[styles.filterCatPillText, active && styles.filterCatPillTextActive]} numberOfLines={1}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Section: Distance Radius */}
        <View style={styles.filterSection}>
          <View style={styles.filterSectionHeader}>
            <Text style={styles.filterSectionTitle}>Distance Radius</Text>
            <Text style={styles.filterRadiusValue}>{draft.radiusKm === null ? 'Any radius' : `Within ${draft.radiusKm} km`}</Text>
          </View>
          <View style={styles.filterRadiusGroup}>
            {radiusOptions.map((option) => {
              const active = draft.radiusKm === option.value;
              return (
                <Pressable
                  key={option.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.filterRadiusOption, active && styles.filterRadiusOptionActive]}
                  onPress={() => setDraft((current) => ({ ...current, radiusKm: option.value }))}
                >
                  <Text style={[styles.filterRadiusOptionText, active && styles.filterRadiusOptionTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Bottom apply bar */}
      <View style={styles.filterApplyBar}>
        <Pressable
          style={styles.filterApplyBtn}
          onPress={() => {
            setFilters(draft);
            router.back();
          }}
          accessibilityRole="button"
          accessibilityLabel="Apply filters and go back"
        >
          <Text style={styles.filterApplyText}>Apply Filters</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  filterSafe: { flex: 1, backgroundColor: '#f8fafc' },
  filterTopBar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: withAlpha('#f8fafc', 0.9),
  },
  filterIconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  filterResetText: { color: M3.primaryContainer, fontSize: T['link-md'], lineHeight: 18, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  filterScrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
  filterNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: M3.surfaceContainerLow,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  filterNoteText: { color: M3.onSurfaceVariant, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  filterSummaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12 },
  filterSummaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterActiveText: { color: M3.secondary, fontSize: T['body-sm'], lineHeight: 18, fontWeight: '500' },
  filterActivePill: {
    backgroundColor: M3.secondaryContainer,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  filterActivePillText: { color: M3.onSecondaryContainer, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600' },
  filterSection: { paddingTop: 18 },
  filterSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  filterSectionTitle: { color: M3.onSurface, fontSize: T['title-md'], lineHeight: 22, fontWeight: '600' },
  filterSectionCaption: { color: M3.secondary, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '500' },
  filterCard: {
    backgroundColor: M3.surfaceContainerLowest,
    borderRadius: 16,
    padding: 8,
    flexDirection: 'column',
    gap: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  filterFeatureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  filterFeatureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: M3.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  filterFeatureIconOff: { backgroundColor: M3.surfaceContainerLow },
  filterFeatureTexts: { flex: 1, minWidth: 0, gap: 2 },
  filterFeatureTitle: { color: M3.onSurface, fontSize: T['title-sm'], lineHeight: 20, fontWeight: '600' },
  filterFeatureSub: { color: M3.secondary, fontSize: T['body-sm'], lineHeight: 18 },
  filterSwitchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: M3.surfaceContainer,
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginTop: 8,
  },
  filterSwitchTrackOn: { backgroundColor: M3.primaryContainer },
  filterSwitchThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: M3.surfaceContainerLowest,
    alignSelf: 'flex-start',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  filterSwitchThumbOn: { alignSelf: 'flex-end' },
  filterCatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  filterCatPill: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: M3.surfaceContainerLowest,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  filterCatPillActive: { backgroundColor: M3.primaryContainer },
  filterCatPillText: { color: M3.onSurface, fontSize: T['body-md'], lineHeight: 20, fontWeight: '500', flexShrink: 1 },
  filterCatPillTextActive: { color: M3.onPrimary, fontWeight: '600' },
  filterRadiusValue: { color: M3.primaryContainer, fontSize: T['link-md'], lineHeight: 18, fontWeight: '600' },
  filterRadiusGroup: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: M3.surfaceContainerLowest,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  filterRadiusOption: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  filterRadiusOptionActive: { backgroundColor: M3.primaryContainer },
  filterRadiusOptionText: { color: M3.secondary, fontSize: T['label-md'], lineHeight: 16, fontWeight: '500' },
  filterRadiusOptionTextActive: { color: M3.onPrimary, fontWeight: '600' },
  filterApplyBar: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: withAlpha(M3.outlineVariant, 0.5),
    backgroundColor: withAlpha('#f8fafc', 0.95),
  },
  filterApplyBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: M3.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1e40ff',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  filterApplyText: { color: M3.onPrimary, fontSize: T['link-md'], lineHeight: 18, fontWeight: '600' },
});
