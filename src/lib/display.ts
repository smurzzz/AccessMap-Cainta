import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import type { Href } from 'expo-router';
import { DesignColors as C, M3 } from '@/constants/design-tokens';
import {
  FEATURE_LABELS,
  FEATURE_ORDER,
} from '@/constants/catalog';
import { type AppFilters } from '@/contexts/filter-context';
import type { FeatureType, Place, PlaceCategory } from '@/types';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const tabsRoute = '/(tabs)' as Href;

export const categoryIcon: Record<PlaceCategory, IconName> = {
  hospital: 'hospital-box-outline', health_center: 'hospital-building', government: 'bank-outline',
  school: 'school-outline', mall: 'storefront-outline', church: 'church-outline', park: 'tree-outline',
};

export const categoryPillStyle: Record<PlaceCategory, { backgroundColor: string }> = {
  hospital: { backgroundColor: C.navy },
  health_center: { backgroundColor: C.mint },
  government: { backgroundColor: C.navy },
  school: { backgroundColor: C.slate },
  mall: { backgroundColor: C.slate },
  church: { backgroundColor: C.slate },
  park: { backgroundColor: C.mint },
};

export const categoryPillTextColor: Record<PlaceCategory, string> = {
  hospital: C.white, health_center: C.green, government: C.white, school: C.muted,
  mall: C.muted, church: C.muted, park: C.green,
};

export const featureIconName: Record<FeatureType, IconName> = {
  ramp: 'human-wheelchair',
  restroom: 'toilet',
  elevator: 'elevator',
  parking: 'parking',
  entrance: 'door',
  other: 'human-wheelchair',
};

export const featureIcon: Record<FeatureType, IconName> = {
  ramp: 'wheelchair-accessibility', restroom: 'human-male-female', elevator: 'elevator-passenger',
  parking: 'parking', entrance: 'door-open', other: 'checkbox-marked-circle-outline',
};

export const featureShortLabels: Record<FeatureType, string> = {
  ramp: 'Ramp',
  restroom: 'Restroom',
  elevator: 'Elevator',
  parking: 'Parking',
  entrance: 'Entrance',
  other: 'Other',
};

export const homeCategoryLabel: Record<PlaceCategory, string> = {
  hospital: 'Hospital',
  health_center: 'Health Center',
  government: 'Government Office',
  school: 'School',
  mall: 'Mall',
  church: 'Church',
  park: 'Park',
};

export const nearbyChips: { type: FeatureType | null; label: string; dot: string }[] = [
  { type: null, label: 'All', dot: M3.primaryContainer },
  { type: 'ramp', label: 'Ramp', dot: M3.primaryContainer },
  { type: 'restroom', label: 'Accessible Restroom', dot: M3.tertiary },
  { type: 'elevator', label: 'Elevator', dot: M3.primaryContainer },
  { type: 'parking', label: 'Accessible Parking', dot: M3.tertiary },
  { type: 'entrance', label: 'Accessible Entrance', dot: M3.primaryContainer },
];

export const photos = {
  hospital: require('@/assets/images/exterior_photo_of_modern_philippine_community_hospital_or_health_annex_with.png'),
  health: require('@/assets/images/realistic_photo_of_barangay_san_isidro_health_center_exterior_with_wheelchair.png'),
  hall: require('@/assets/images/realistic_photo_of_cainta_municipal_hall_annex_exterior_with_accessible.png'),
  school: require('@/assets/images/exterior_photo_of_modern_public_school_building_in_the_philippines_with_covered.png'),
  avatar: require('@/assets/images/clean_friendly_profile_portrait_avatar_of_a_filipino_civic_volunteer_with.png'),
};

const fallbackPhotoFor: Record<PlaceCategory, number> = {
  hospital: photos.hospital,
  health_center: photos.health,
  government: photos.hall,
  school: photos.school,
  mall: photos.health,
  church: photos.hall,
  park: photos.health,
};

export function photoSource(place: Place) {
  return place.photo_url ? { uri: place.photo_url } : fallbackPhotoFor[place.category];
}

export function availableFeatureLabels(place: Place): string[] {
  return (place.accessibility_features ?? [])
    .filter((feature) => feature.status === 'available')
    .map((feature) => FEATURE_LABELS[feature.feature_type]);
}

export function availableFeatureTypes(place: Place): FeatureType[] {
  return FEATURE_ORDER.filter((type) =>
    (place.accessibility_features ?? []).some(
      (feature) => feature.feature_type === type && feature.status === 'available',
    ),
  );
}

/** True when a place satisfies the app-wide accessibility + category + radius filters. */
export function matchesFilters(
  place: Place,
  filters: Pick<AppFilters, 'features' | 'category' | 'radiusKm'>,
  userLocation?: { latitude: number; longitude: number } | null,
): boolean {
  if (filters.category !== 'all' && place.category !== filters.category) return false;
  const available = new Set(availableFeatureTypes(place));
  for (const feature of filters.features) {
    if (!available.has(feature)) return false;
  }
  if (filters.radiusKm != null && userLocation) {
    const meters = haversineMeters(userLocation, {
      latitude: place.latitude,
      longitude: place.longitude,
    });
    if (meters != null && meters > filters.radiusKm * 1000) return false;
  }
  return true;
}

/** Great-circle distance in meters between two coordinate points (null when incomplete). */
export function haversineMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number | null {
  if (
    !Number.isFinite(a.latitude) || !Number.isFinite(a.longitude) ||
    !Number.isFinite(b.latitude) || !Number.isFinite(b.longitude)
  ) {
    return null;
  }
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export function withAlpha(hex: string, opacity: number): string {
  const value = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${value}`;
}

