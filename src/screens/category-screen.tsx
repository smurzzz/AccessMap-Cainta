import Header from '@/components/ui/header';
import Screen from '@/components/ui/screen';
import SearchBar from '@/components/ui/search-bar';
import { DesignColors as C, DesignType as T } from '@/constants/design-tokens';
import { usePlaces } from '@/hooks/usePlaces';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tabsRoute } from '@/lib/display';
import { CATEGORY_DETAILS, CATEGORY_ICONS, CATEGORY_LABELS } from '@/constants/catalog';
import type { PlaceCategory } from '@/types';
import EmptyState from '@/components/ui/empty-state';
import LoadingState from '@/components/ui/loading-state';

export function CategoryScreen() {
  const { places, loading, error } = usePlaces();
  const countFor = (category: PlaceCategory) => places.filter((place) => place.category === category).length;
  const essential: PlaceCategory[] = ['hospital', 'health_center', 'government'];
  const secondary: PlaceCategory[] = ['school', 'mall', 'church', 'park'];
  return (
    <Screen>
      <Header />
      <View style={styles.filterSummary}><Text style={styles.filterSummaryText}>◉  Admin-Verified Listings</Text></View>
      <Text style={styles.screenTitle}>Browse Facilities by Category</Text>
      <Text style={styles.body}>Select a category to view accessible entrances, ramps, restrooms, and parking.</Text>
      <SearchBar placeholder="Search facility types, ramps, services" />
      {error ? <EmptyState title="Could not load categories" message={error} /> : null}
      {!error && loading ? <LoadingState label="Loading categories…" /> : null}
      {!error && !loading && places.length === 0 ? <EmptyState message="No facilities are registered yet. Check back soon." /> : null}
      <Text style={styles.sectionTitle}>● Essential Public Services</Text>
      {essential.map((category) => (
        <Pressable key={category} style={styles.categoryListCard} onPress={() => router.push(tabsRoute)}>
          <Text style={styles.categoryLargeIcon}>{CATEGORY_ICONS[category]}</Text>
          <View style={styles.flex}><Text style={styles.cardHeading}>{CATEGORY_LABELS[category]}</Text><Text style={styles.body}>{CATEGORY_DETAILS[category]}</Text><Text style={styles.greenLabel}>✓ Step-Free Entry  •  ✓ Accessible Restroom</Text></View>
          <Text style={styles.countPill}>{countFor(category)}</Text>
        </Pressable>
      ))}
      <Text style={styles.sectionTitle}>Commercial & Community Places</Text>
      <View style={styles.categoryGrid}>{secondary.map((category) => <Pressable key={category} style={styles.categoryCard} onPress={() => router.push(tabsRoute)}><Text style={styles.categoryIcon}>{CATEGORY_ICONS[category]}</Text><Text style={styles.cardHeading}>{CATEGORY_LABELS[category]}</Text><Text style={styles.body}>{CATEGORY_DETAILS[category]}</Text><Text style={styles.greenLabel}>{countFor(category)} locations</Text></Pressable>)}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterSummary: { backgroundColor: C.mint, minHeight: 52, borderRadius: 6, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterSummaryText: { color: C.green, fontSize: T['body-md-tight'], fontWeight: '800' },
  screenTitle: { color: C.ink, fontSize: T['display-md'], lineHeight: 32, fontWeight: '800' },
  body: { color: C.muted, fontSize: T['body-md'], lineHeight: 24 },
  sectionTitle: { color: C.ink, fontSize: T['body-xl'], lineHeight: 28, fontWeight: '800' },
  categoryListCard: { backgroundColor: C.card, borderRadius: 12, padding: 20, minHeight: 128, flexDirection: 'row', alignItems: 'flex-start', gap: 14, borderWidth: 1, borderColor: C.line },
  categoryLargeIcon: { width: 54, height: 54, borderRadius: 8, backgroundColor: C.mint, color: C.green, textAlign: 'center', paddingTop: 12, fontSize: T['icon-lg'] },
  flex: { flex: 1 },
  cardHeading: { color: C.ink, fontSize: T['body-md'], lineHeight: 22, fontWeight: '800' },
  greenLabel: { color: C.green, fontSize: T['label-md'], fontWeight: '800' },
  countPill: { backgroundColor: C.slate, color: C.muted, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 8, fontSize: T['label-sm'], fontWeight: '800' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryCard: { backgroundColor: C.card, borderRadius: 12, padding: 16, minHeight: 126, flexBasis: '47%', flexGrow: 1, gap: 10, borderWidth: 1, borderColor: C.line },
  categoryIcon: { color: C.green, fontSize: T['icon-lg'] },
});
