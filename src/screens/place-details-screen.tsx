import OSMMap from '@/components/osm-map';
import { AppIcon } from '@/components/ui/app-icon';
import EmptyState from '@/components/ui/empty-state';
import LoadingState from '@/components/ui/loading-state';
import { FEATURE_LABELS, CATEGORY_SHORT_LABELS } from '@/constants/catalog';
import { DesignColors as C, DesignType as T, M3 } from '@/constants/design-tokens';
import { usePlace } from '@/hooks/usePlace';
import { tabsRoute, featureIconName, photoSource , withAlpha } from '@/lib/display';
import { useSavedPlaces } from '@/lib/saved-places';
import { shareAppMessage } from '@/lib/share';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export function PlaceDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { place, loading, error } = usePlace(id);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { savedIds: savedPlaceIds, toggleSaved: toggleSavedPlace } = useSavedPlaces();
  const saved = place ? savedPlaceIds.includes(place.id) : false;
  const [mapSectionTop, setMapSectionTop] = useState<number | null>(null);
  const [bottomBarHeight, setBottomBarHeight] = useState(136);

  const features = place?.accessibility_features ?? [];
  const availableCount = features.filter((feature) => feature.status === 'available').length;

  // Stretch the location map down toward the bottom action bar so there is no dead
  // background strip after the map card (a small gap is still kept for breathing room).
  const detailMapHeight =
    mapSectionTop == null
      ? 176
      : Math.max(176, height - insets.top - insets.bottom - mapSectionTop - bottomBarHeight - 12);

  const sharePlace = async () => {
    if (!place) return;
    await shareAppMessage(place.name, `Check out ${place.name} on AccessMap — ${place.address}`);
  };

  return (
    <SafeAreaView style={styles.detailSafe} edges={['top', 'bottom']}>
      {error ? <EmptyState title="Could not load this facility" message={error} /> : null}
      {!error && loading ? <LoadingState label="Loading facility details…" /> : null}
      {!error && !loading && !place ? <EmptyState message="This facility could not be found." /> : null}

      {!error && !loading && place ? (
        <View style={styles.detailBody}>
          <ScrollView contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator={false}>
            {/* Hero Image with overlaid floating elements */}
            <View style={styles.detailHero}>
              <Image source={photoSource(place)} style={styles.detailHeroImage} contentFit="cover" transition={200} />
              <View style={styles.detailHeroShade} pointerEvents="none" />
              {/* Floating Back Button Pill */}
              <Pressable onPress={() => router.back()} style={styles.detailHeroBack} accessibilityLabel="Back" hitSlop={8}>
                <AppIcon name="chevron-left" size={20} color={M3.onSurface} />
              </Pressable>
              {/* Live Status Quick Pill */}
              <View style={styles.detailLivePill}>
                <View style={styles.detailLiveDot} />
                <Text style={styles.detailLiveText}>Admin-Verified</Text>
              </View>
            </View>

            {/* Primary Content Card */}
            <View style={styles.detailContentCard}>
              {/* Category & Quick Actions */}
              <View style={styles.rowBetween}>
                <Pressable style={styles.detailCategoryLink} onPress={() => router.push(tabsRoute)}>
                  <Text style={styles.detailCategoryText}>{CATEGORY_SHORT_LABELS[place.category]}</Text>
                  <AppIcon name="arrow-right" size={15} color={M3.primaryContainer} />
                </Pressable>
                <View style={styles.detailQuickActions}>
                  <Pressable
                    style={styles.detailQuickAction}
                    accessibilityLabel="Share location"
                    accessibilityRole="button"
                    hitSlop={6}
                    onPress={sharePlace}
                  >
                    <AppIcon name="share-variant" size={18} color={M3.secondary} />
                  </Pressable>
                  <Pressable
                    style={styles.detailQuickAction}
                    accessibilityLabel={saved ? 'Remove bookmark' : 'Save location'}
                    accessibilityRole="button"
                    accessibilityState={{ selected: saved }}
                    hitSlop={6}
                    onPress={() => {
                      if (place) toggleSavedPlace(place.id);
                    }}
                  >
                    <AppIcon
                      name={saved ? 'bookmark' : 'bookmark-outline'}
                      size={18}
                      color={saved ? M3.primaryContainer : M3.secondary}
                    />
                  </Pressable>
                </View>
              </View>

              {/* Title & Location */}
              <Text style={styles.detailName}>{place.name}</Text>
              <View style={styles.detailAddressRow}>
                <AppIcon name="map-marker" size={16} color={M3.secondary} />
                <Text style={styles.detailAddressText} numberOfLines={1}>{place.address}</Text>
              </View>

              {/* Description */}
              {place.description ? (
                <View style={styles.detailDescriptionBox}>
                  <Text style={styles.detailDescriptionText}>{place.description}</Text>
                </View>
              ) : null}

              {/* Accessibility Features Section */}
              <View style={styles.detailSection}>
                <View style={styles.detailSectionHeader}>
                  <Text style={styles.detailSectionTitle}>Accessibility Features</Text>
                  <Text style={styles.detailCountPill}>Available: {availableCount} of {features.length}</Text>
                </View>
                <View style={styles.detailFeatureList}>
                  {features.map((feature, index) => {
                    const available = feature.status === 'available';
                    return (
                      <View key={feature.id}>
                        {index > 0 ? <View style={styles.detailFeatureDivider} /> : null}
                        <View style={styles.detailFeatureRow}>
                          <View style={styles.detailFeatureIconBox}>
                            <AppIcon name={featureIconName[feature.feature_type]} size={18} color={M3.primaryContainer} />
                          </View>
                          <Text style={styles.detailFeatureName}>{FEATURE_LABELS[feature.feature_type]}</Text>
                          <View style={[styles.detailFeatureStatus, available ? styles.detailFeatureStatusOk : styles.detailFeatureStatusNo]}>
                            <Text style={[styles.detailFeatureStatusText, available ? styles.detailFeatureStatusTextOk : styles.detailFeatureStatusTextNo]}>
                              {available ? '✓' : '✕'} {available ? 'Available' : 'Not Available'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                  {features.length === 0 ? <Text style={styles.detailEmptyText}>No accessibility features on record yet.</Text> : null}
                </View>
              </View>

              {/* Location Preview Section */}
              <View
                style={styles.detailSection}
                onLayout={(event) => setMapSectionTop(event.nativeEvent.layout.y)}
              >
                <View style={styles.detailSectionHeader}>
                  <Text style={styles.detailSectionTitle}>Location</Text>
                  <Text style={styles.detailSectionSub}>{place.address}</Text>
                </View>
                <View style={styles.detailMapCard}>
                  {Platform.OS === 'web' ? (
                    <View style={[styles.detailMapMock, { height: detailMapHeight }]}>
                      <Text style={styles.mapRoad}>CAINTA</Text>
                      <Text style={[styles.mapRoad, { top: 60, left: 45 }]}>PAROLA ST.</Text>
                      <View style={[styles.mapPin, { top: 65, left: 140 }]}><Text>⊞</Text></View>
                    </View>
                  ) : (
                    <OSMMap pins={[{ id: place.id, latitude: place.latitude, longitude: place.longitude, title: place.name }]} focus={{ latitude: place.latitude, longitude: place.longitude }} height={detailMapHeight} />
                  )}
                  {/* Subtle Location Badge overlay */}
                  <View style={styles.detailMapBadge} pointerEvents="box-none">
                    <View style={styles.detailMapBadgeText}>
                      <Text style={styles.detailMapStreet} numberOfLines={1}>{place.name}</Text>
                      <Text style={styles.detailMapSubtext} numberOfLines={1}>{place.address}</Text>
                    </View>
                    <Pressable style={styles.detailMapNav} onPress={() => router.push({ pathname: '/(tabs)/map', params: { place: place.id } })} accessibilityLabel="Open in map">
                      <AppIcon name="navigation" size={16} color={M3.onPrimary} />
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Bottom Floating Action Bar */}
          <View
            style={styles.detailBottomBar}
            onLayout={(event) => setBottomBarHeight(event.nativeEvent.layout.height)}
          >
            <View style={styles.detailBottomPad}>
              <Pressable style={styles.detailDirectionsButton} onPress={() => router.push({
                pathname: '/directions',
                params: { place: place.name, lat: String(place.latitude), lng: String(place.longitude) } })} accessibilityLabel="Get Directions">
                <AppIcon name="directions" size={20} color={M3.onPrimary} />
                <Text style={styles.detailDirectionsText}>Get Directions</Text>
              </Pressable>
            </View>
            <View style={styles.detailDock}>
              <Pressable style={styles.detailDockItem} onPress={() => router.push('/(tabs)/explore')}>
                <View style={styles.detailDockIconActive}><AppIcon name="compass-outline" size={22} color={M3.primaryContainer} /></View>
                <Text style={styles.detailDockLabelActive}>Explore</Text>
              </Pressable>
              <Pressable style={styles.detailDockItem} onPress={() => router.push(tabsRoute)}>
                <View style={styles.detailDockIcon}><AppIcon name="home-outline" size={22} color={M3.secondary} /></View>
                <Text style={styles.detailDockLabel}>Home</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  detailSafe: { flex: 1, backgroundColor: '#f8fafc' },
  detailBody: { flex: 1 },
  detailScrollContent: { paddingBottom: 0 },
  detailHero: { position: 'relative', height: 288 },
  detailHeroImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  detailHeroShade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: withAlpha('#000000', 0.22) },
  detailHeroBack: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 48,
    height: 48,
    borderRadius: 20,
    backgroundColor: withAlpha(M3.surfaceContainerLowest, 0.95),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    zIndex: 10,
  },
  detailLivePill: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: withAlpha(M3.surfaceContainerLowest, 0.95),
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    zIndex: 10,
  },
  detailLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: M3.tertiaryContainer },
  detailLiveText: {
    color: M3.tertiaryContainer,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.33,
    textTransform: 'uppercase',
  },
  detailContentCard: {
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: M3.surfaceContainerLowest,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 2,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  detailCategoryLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailCategoryText: { color: M3.primaryContainer, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  detailQuickActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailQuickAction: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: M3.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailName: { color: M3.onSurface, fontSize: T['headline-md'], lineHeight: 30, fontWeight: '600', letterSpacing: -0.36, marginTop: 4 },
  detailAddressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  detailAddressText: { color: M3.secondary, fontSize: 13, lineHeight: 18, flexShrink: 1 },
  detailDescriptionBox: { backgroundColor: M3.surfaceContainerLow, borderRadius: 12, padding: 14, marginTop: 16 },
  detailDescriptionText: { color: M3.onSurfaceVariant, fontSize: T['body-md'], lineHeight: 20 },
  detailSection: { marginTop: 24 },
  detailSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 },
  detailSectionTitle: { color: M3.onSurface, fontSize: T['title-md'], lineHeight: 22, fontWeight: '600', letterSpacing: -0.085 },
  detailCountPill: {
    color: M3.secondary,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.33,
    backgroundColor: M3.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  detailFeatureList: {
    backgroundColor: M3.surfaceContainerLowest,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  detailFeatureDivider: { height: StyleSheet.hairlineWidth, backgroundColor: M3.surfaceContainer, marginHorizontal: 16 },
  detailFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  detailFeatureIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: M3.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailFeatureName: { color: M3.onSurface, fontSize: T['title-sm'], lineHeight: 20, fontWeight: '600', flex: 1 },
  detailFeatureStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  detailFeatureStatusOk: { backgroundColor: '#ecfdf5' },
  detailFeatureStatusNo: { backgroundColor: '#fbe9e9' },
  detailFeatureStatusText: { fontSize: 12, lineHeight: 14, fontWeight: '600' },
  detailFeatureStatusTextOk: { color: '#059669' },
  detailFeatureStatusTextNo: { color: '#b3261e' },
  detailEmptyText: { color: M3.onSurfaceVariant, fontSize: T['body-md'], padding: 16 },
  detailSectionSub: { color: M3.secondary, fontSize: T['body-sm'], lineHeight: 18, flexShrink: 1 },
  detailMapCard: { position: 'relative', borderRadius: 16, overflow: 'hidden', backgroundColor: M3.surfaceContainer },
  detailMapMock: { height: 176, backgroundColor: C.mapSurface, position: 'relative', overflow: 'hidden' },
  mapRoad: { position: 'absolute', top: 35, left: 80, color: C.mapLabel, fontSize: T['label-md'], fontWeight: '700', transform: [{ rotate: '-15deg' }] },
  mapPin: { width: 42, height: 42, borderRadius: 22, backgroundColor: C.green, borderWidth: 3, borderColor: C.white, alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  detailMapBadge: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: withAlpha(M3.surfaceContainerLowest, 0.95),
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    zIndex: 10,
  },
  detailMapBadgeText: { flex: 1, minWidth: 0, paddingRight: 10 },
  detailMapStreet: { color: M3.onSurface, fontSize: T['title-sm'], lineHeight: 20, fontWeight: '600' },
  detailMapSubtext: { color: M3.secondary, fontSize: T['body-sm'], lineHeight: 18 },
  detailMapNav: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: M3.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailBottomBar: {
    backgroundColor: M3.surfaceContainerLowest,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: withAlpha('#1B3A5C', 0.08),
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 4,
  },
  detailBottomPad: { padding: 16 },
  detailDirectionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: M3.primaryContainer,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  detailDirectionsText: { color: M3.onPrimary, fontSize: T['title-sm'], lineHeight: 20, fontWeight: '600' },
  detailDock: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 16 },
  detailDockItem: { flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1 },
  detailDockIconActive: { width: 40, height: 40, borderRadius: 20, backgroundColor: M3.surfaceContainerLow, alignItems: 'center', justifyContent: 'center' },
  detailDockLabelActive: { color: M3.primaryContainer, fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.33 },
  detailDockIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  detailDockLabel: { color: M3.secondary, fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.33 },
});
