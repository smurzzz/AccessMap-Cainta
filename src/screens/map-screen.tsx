import OSMMap, { type OSMMapHandle } from '@/components/osm-map';
import { AppIcon } from '@/components/ui/app-icon';
import EmptyState from '@/components/ui/empty-state';
import LoadingState from '@/components/ui/loading-state';
import { M3, DesignType as T } from '@/constants/design-tokens';
import { useFilters } from '@/contexts/filter-context';
import { usePlaces } from '@/hooks/usePlaces';
import { availableFeatureTypes, featureShortLabels, haversineMeters, homeCategoryLabel, matchesFilters, nearbyChips, photoSource, tabsRoute, withAlpha } from '@/lib/display';
import { SAN_ISIDRO_BOUNDS, formatDistance } from '@/lib/maps';
import { useSavedPlaces } from '@/lib/saved-places';
import type { FeatureType, Place } from '@/types';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function MapScreen() {
  const params = useLocalSearchParams<{ place?: string }>();
  const { places, loading, error } = usePlaces();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [tappedPlaceId, setTappedPlaceId] = useState<string | null>(params.place ?? null);
  const { savedIds, toggleSaved } = useSavedPlaces();
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [query, setQuery] = useState('');
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FeatureType | null>(null);
  const mapRef = useRef<OSMMapHandle>(null);

  const matchesQuery = (place: Place, text: string) => {
    const q = text.trim().toLowerCase();
    if (!q) return true;
    return (
      place.name.toLowerCase().includes(q) ||
      (place.address ?? '').toLowerCase().includes(q) ||
      homeCategoryLabel[place.category].toLowerCase().includes(q)
    );
  };

  const hasFeature = (place: Place, type: FeatureType) =>
    (place.accessibility_features ?? []).some((feature) => feature.feature_type === type && feature.status === 'available');

  const isFullyAccessible = (place: Place) =>
    hasFeature(place, 'entrance') && availableFeatureTypes(place).length >= 3;

  const { filters } = useFilters();
  const visiblePlaces = places.filter(
    (place) =>
      matchesQuery(place, query) &&
      matchesFilters(place, filters, userLocation) &&
      (!activeFilter || hasFeature(place, activeFilter)) &&
      (!accessibleOnly || isFullyAccessible(place)),
  );

  const activePlaceId = params.place ?? tappedPlaceId ?? (visiblePlaces[0]?.id ?? null);
  const activePlace = visiblePlaces.find((place) => place.id === activePlaceId) ?? null;
  const mapHeight = Math.max(240, height - insets.top - insets.bottom - 68);

  const recenterOnUser = () => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setTappedPlaceId(null);
        mapRef.current?.recenter();
      } catch {
        // location unavailable — keep the map where it is
      }
    })();
  };

  return (
    <View style={styles.mapSafe}>
      {/* Map viewport */}
      <View style={[styles.mapViewport, { height: mapHeight }]}>
        {!error && loading && places.length === 0 ? <LoadingState label="Loading facilities…" /> : null}
        {!error && !loading && visiblePlaces.length > 0 ? (
          <OSMMap
            ref={mapRef}
            pins={visiblePlaces.map((place) => ({ id: place.id, latitude: place.latitude, longitude: place.longitude, title: place.name }))}
            focus={activePlace ? { latitude: activePlace.latitude, longitude: activePlace.longitude } : undefined}
            bounds={SAN_ISIDRO_BOUNDS}
            activePinId={activePlaceId}
            userLocation={userLocation}
            height={mapHeight}
            onPinPress={(id) => setTappedPlaceId(id)}
          />
        ) : null}

        {error ? <View style={styles.mapOverlayCenter}><EmptyState title="Could not load facilities" message={error} /></View> : null}
        {!error && !loading && places.length > 0 && visiblePlaces.length === 0 ? (
          <View style={styles.mapOverlayCenter} pointerEvents="box-none">
            <View style={styles.mapNoResultsCard} pointerEvents="none">
              <Text style={styles.mapNoResultsTitle}>No matching places</Text>
              <Text style={styles.mapNoResultsText}>Try a different search or clear the accessibility filters.</Text>
            </View>
          </View>
        ) : null}

        {/* Search bar (functional: filters pins live) */}
        <View style={styles.mapSearchBar} pointerEvents="box-none">
          <AppIcon name="magnify" size={20} color={M3.secondary} />
          <TextInput
            style={styles.mapSearchInput}
            placeholder="Search hospitals, clinics, municipal offices..."
            placeholderTextColor={M3.secondary}
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setTappedPlaceId(null);
            }}
            accessibilityLabel="Search accessible places"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} accessibilityLabel="Clear search" hitSlop={8}>
              <AppIcon name="close-circle" size={18} color={M3.secondary} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setActiveFilter(activeFilter === 'ramp' ? null : 'ramp')}
              accessibilityLabel="Filter places with ramps"
              hitSlop={8}
            >
              <AppIcon name="tune" size={18} color={activeFilter === 'ramp' ? M3.primaryContainer : M3.secondary} />
            </Pressable>
          )}
        </View>

        {/* Filter chip row (visible when a query or ramp filter is active) */}
        {query.trim().length > 0 || activeFilter === 'ramp' ? (
          <View style={styles.mapFilterRow} pointerEvents="box-none">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mapFilterRowInner}>
              {nearbyChips.map((chip) => {
                const isActive = chip.type === null ? activeFilter === null : activeFilter === chip.type;
                return (
                  <Pressable
                    key={chip.label}
                    style={[styles.mapFilterChip, isActive && styles.mapFilterChipActive]}
                    onPress={() => setActiveFilter(chip.type)}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter by ${chip.label}`}
                  >
                    <View style={[styles.mapFilterDot, { backgroundColor: isActive ? M3.onPrimary : chip.dot }]} />
                    <Text style={[styles.mapFilterChipText, isActive && styles.mapFilterChipTextActive]}>{chip.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Top-right controls (prototype layout) */}
        <View style={styles.mapControls}>
          <View style={styles.mapZoomGroup}>
            <Pressable style={styles.mapControlBtn} accessibilityLabel="Zoom In" accessibilityRole="button" onPress={() => mapRef.current?.zoomIn()}>
              <AppIcon name="plus" size={20} color={M3.onSurface} />
            </Pressable>
            <View style={styles.mapControlDivider} />
            <Pressable style={styles.mapControlBtn} accessibilityLabel="Zoom Out" accessibilityRole="button" onPress={() => mapRef.current?.zoomOut()}>
              <AppIcon name="minus" size={20} color={M3.onSurface} />
            </Pressable>
          </View>
          <Pressable style={styles.mapControlReticle} accessibilityLabel="Recenter Current Location" accessibilityRole="button" onPress={recenterOnUser}>
            <AppIcon name="crosshairs-gps" size={22} color={M3.primaryContainer} />
          </Pressable>
          <Pressable
            style={[styles.mapControlLayer, accessibleOnly && styles.mapControlLayerActive]}
            accessibilityLabel="Toggle fully-accessible places only"
            accessibilityRole="button"
            accessibilityState={{ selected: accessibleOnly }}
            hitSlop={4}
            onPress={() => setAccessibleOnly((value) => !value)}
          >
            <AppIcon name="human-wheelchair" size={20} color={accessibleOnly ? M3.primaryContainer : M3.secondary} />
          </Pressable>
        </View>

        {/* Floating bottom card (prototype layout with live distance) */}
        {activePlace ? (
          <View style={styles.mapCard}>
            <View style={styles.mapCardTop}>
              <View style={styles.mapCardThumb}>
                <Image source={photoSource(activePlace)} style={styles.mapCardThumbImg} contentFit="cover" />
                <Text style={styles.mapCardVerified}>Admin-Verified</Text>
              </View>
              <View style={styles.mapCardInfo}>
                <View style={styles.mapCardInfoRow}>
                  <Pressable style={styles.mapCardCategory} onPress={() => router.push(tabsRoute)}>
                    <Text style={styles.mapCardCategoryText}>{homeCategoryLabel[activePlace.category]}</Text>
                    <AppIcon name="arrow-right" size={14} color={M3.primaryContainer} />
                  </Pressable>
                  <Pressable onPress={() => toggleSaved(activePlace.id)} accessibilityRole="button" accessibilityLabel={savedIds.includes(activePlace.id) ? 'Remove bookmark' : 'Save location'} hitSlop={8}>
                    <AppIcon name={savedIds.includes(activePlace.id) ? 'bookmark' : 'bookmark-outline'} size={20} color={savedIds.includes(activePlace.id) ? M3.primaryContainer : M3.secondary} />
                  </Pressable>
                </View>
                <Text style={styles.mapCardTitle} numberOfLines={1}>{activePlace.name}</Text>
                <View style={styles.mapCardLocRow}>
                  <AppIcon name="map-marker" size={14} color={M3.secondary} />
                  <Text style={styles.mapCardLocText} numberOfLines={1}>{activePlace.address}</Text>
                </View>
                <View style={styles.mapCardPills}>
                  <View style={styles.mapCardFeaturePill}>
                    <Text style={styles.mapCardCheck}>✓</Text>
                    <Text style={styles.mapCardFeaturePillText} numberOfLines={1}>{(() => {
                      const types = availableFeatureTypes(activePlace);
                      return types.length > 0 ? `${featureShortLabels[types[0]]}${types.length > 1 ? `, +${types.length - 1} more` : ''}` : 'Accessibility reviewed';
                    })()}</Text>
                  </View>
                  <Text style={styles.mapCardDistance}>{(() => {
                    if (!userLocation) return '• San Isidro, Cainta';
                    const meters = haversineMeters(userLocation, { latitude: activePlace.latitude, longitude: activePlace.longitude });
                    return meters != null ? `• ${formatDistance(meters)} away` : '• San Isidro, Cainta';
                  })()}</Text>
                </View>
              </View>
            </View>
            <View style={styles.mapCardActions}>
              <Pressable style={styles.mapCardDetailsBtn} onPress={() => router.push({ pathname: '/place/[id]', params: { id: activePlace.id } })}>
                <Text style={styles.mapCardDetailsText}>View Details</Text>
              </Pressable>
              <Pressable style={styles.mapCardDirectionsBtn} onPress={() => router.push({
                pathname: '/directions',
                params: { place: activePlace.name, lat: String(activePlace.latitude), lng: String(activePlace.longitude) } })} accessibilityLabel="Get Directions">
                <AppIcon name="directions" size={18} color={M3.onPrimary} />
                <Text style={styles.mapCardDirectionsText}>Directions</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapSafe: { flex: 1, backgroundColor: '#f8fafc' },
  mapViewport: { position: 'relative', width: '100%', overflow: 'hidden', backgroundColor: M3.surfaceContainerLow },
  mapOverlayCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 30 },
  mapNoResultsCard: {
    backgroundColor: withAlpha(M3.surfaceContainerLowest, 0.95),
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginHorizontal: 32,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  mapNoResultsTitle: { color: M3.onSurface, fontSize: T['title-sm'], lineHeight: 20, fontWeight: '600', marginBottom: 4 },
  mapNoResultsText: { color: M3.secondary, fontSize: T['body-sm'], lineHeight: 18, textAlign: 'center' },
  mapSearchBar: {
    position: 'absolute',
    top: 30,
    left: 16,
    right: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: withAlpha(M3.surfaceContainerLowest, 0.95),
    borderWidth: 1,
    borderColor: withAlpha(M3.outlineVariant, 0.4),
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    zIndex: 15,
  },
  mapSearchInput: { flex: 1, minWidth: 0, color: M3.onSurface, fontSize: T['body-sm'], lineHeight: 18, paddingVertical: 0 },
  mapFilterRow: {
    position: 'absolute',
    top: 74,
    left: 16,
    right: 88,
    zIndex: 14,
  },
  mapFilterRowInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 },
  mapFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: withAlpha(M3.surfaceContainerLowest, 0.95),
    borderWidth: 1,
    borderColor: withAlpha(M3.outlineVariant, 0.5),
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  mapFilterChipActive: {
    backgroundColor: M3.primaryContainer,
    borderColor: M3.primaryContainer,
  },
  mapFilterDot: { width: 6, height: 6, borderRadius: 3 },
  mapFilterChipText: { color: M3.onSurface, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600' },
  mapFilterChipTextActive: { color: M3.onPrimary },
  mapControls: { position: 'absolute', top: 30, right: 16, alignItems: 'center', gap: 8, zIndex: 20 },
  mapZoomGroup: {
    backgroundColor: M3.surfaceContainerLowest,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  mapControlBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: M3.surfaceContainerLowest,
  },
  mapControlDivider: { height: StyleSheet.hairlineWidth, backgroundColor: M3.surfaceContainerHigh, width: '100%' },
  mapControlReticle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: M3.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  mapControlLayer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: M3.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  mapControlLayerActive: {
    backgroundColor: M3.surfaceContainer,
    borderWidth: 1.5,
    borderColor: M3.primaryContainer,
  },
  mapCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    zIndex: 25,
    backgroundColor: M3.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  mapCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, minWidth: 0 },
  mapCardThumb: { position: 'relative', width: 80, height: 80, borderRadius: 12, backgroundColor: M3.surfaceContainer, overflow: 'hidden' },
  mapCardThumbImg: { width: '100%', height: '100%' },
  mapCardVerified: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: withAlpha(M3.surfaceContainerLowest, 0.9),
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    fontSize: 9,
    fontWeight: '600',
    color: M3.tertiary,
    overflow: 'hidden',
  },
  mapCardInfo: { flex: 1, minWidth: 0, flexDirection: 'column', justifyContent: 'space-between', alignSelf: 'stretch' },
  mapCardInfoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  mapCardCategory: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1 },
  mapCardCategoryText: { color: M3.primaryContainer, fontSize: T['link-md'], lineHeight: 18, fontWeight: '600' },
  mapCardTitle: { color: M3.onSurface, fontSize: T['headline-sm'], lineHeight: 26, fontWeight: '600', letterSpacing: -0.2, marginTop: 2 },
  mapCardLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, minWidth: 0 },
  mapCardLocText: { color: M3.secondary, fontSize: T['body-sm'], lineHeight: 18, flexShrink: 1 },
  mapCardPills: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  mapCardFeaturePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#ECFDF5',
  },
  mapCardCheck: { color: '#059669', fontSize: 13, lineHeight: 14, fontWeight: '700' },
  mapCardFeaturePillText: { color: '#059669', fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600', flexShrink: 1 },
  mapCardDistance: { color: M3.secondary, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600' },
  mapCardActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  mapCardDetailsBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: M3.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: withAlpha(M3.outlineVariant, 0.6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapCardDetailsText: { color: M3.onSurface, fontSize: T['title-sm'], lineHeight: 20, fontWeight: '600' },
  mapCardDirectionsBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: M3.primaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  mapCardDirectionsText: { color: M3.onPrimary, fontSize: T['title-sm'], lineHeight: 20, fontWeight: '600' },
});
