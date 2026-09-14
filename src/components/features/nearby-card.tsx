import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/ui/app-icon';
import { availableFeatureTypes, featureShortLabels, homeCategoryLabel, photoSource , withAlpha } from '@/lib/display';
import { M3, DesignType as T } from '@/constants/design-tokens';
import type { Place } from '@/types';

function NearbyCard({ place }: { place: Place }) {
  const types = availableFeatureTypes(place);
  const pill = types.length > 0 ? `${featureShortLabels[types[0]]}${types.length > 1 ? `, +${types.length - 1} more` : ''}` : 'Accessibility reviewed';
  return (
    <View style={styles.nearbyCard}>
      <Image source={photoSource(place)} style={styles.nearbyCardThumb} />
      <View style={styles.nearbyCardBody}>
        <Pressable style={styles.nearbyCategoryRow} onPress={() => router.push({ pathname: '/place/[id]', params: { id: place.id } })}>
          <Text style={styles.nearbyCategory}>{homeCategoryLabel[place.category]}</Text>
          <AppIcon name="arrow-right" size={13} color={M3.primary} />
        </Pressable>
        <Text style={styles.nearbyName} numberOfLines={1}>{place.name}</Text>
        <View style={styles.nearbyAddressRow}>
          <AppIcon name="map-marker" size={14} color={M3.secondary} />
          <Text style={styles.nearbyAddress} numberOfLines={1}>{place.address}</Text>
        </View>
        <View style={styles.nearbyCardFooter}>
          <View style={styles.nearbyFeaturePill}><Text style={styles.nearbyFeaturePillText} numberOfLines={1}>{pill}</Text></View>
          <Pressable style={styles.nearbyDetailsButton} onPress={() => router.push({ pathname: '/place/[id]', params: { id: place.id } })}>
            <Text style={styles.nearbyDetailsText}>View Details</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default NearbyCard;

const styles = StyleSheet.create({
  nearbyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: M3.surfaceContainerLowest,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: withAlpha(M3.outlineVariant, 0.5),
  },
  nearbyCardThumb: { width: 80, height: 80, borderRadius: 8, backgroundColor: M3.surfaceContainer },
  nearbyCardBody: { flex: 1, minWidth: 0, justifyContent: 'center' },
  nearbyCategoryRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 2 },
  nearbyCategory: { color: M3.primary, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600' },
  nearbyName: { color: M3.onSurface, fontSize: T['title-sm'], lineHeight: 20, fontWeight: '600', marginBottom: 2 },
  nearbyAddressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, marginBottom: 8 },
  nearbyAddress: { color: M3.secondary, fontSize: T['body-sm'], lineHeight: 18, flexShrink: 1 },
  nearbyCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nearbyFeaturePill: {
    backgroundColor: M3.surfaceContainerLow,
    borderWidth: 1,
    borderColor: withAlpha(M3.outlineVariant, 0.4),
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    flexShrink: 1,
  },
  nearbyFeaturePillText: { color: M3.secondary, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600' },
  nearbyDetailsButton: { backgroundColor: M3.surfaceContainerLow, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  nearbyDetailsText: { color: M3.primary, fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
