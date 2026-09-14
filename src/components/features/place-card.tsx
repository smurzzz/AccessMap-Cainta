import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/ui/app-icon';
import Button from '@/components/ui/button';
import { availableFeatureLabels, categoryIcon, categoryPillStyle, categoryPillTextColor, photoSource } from '@/lib/display';
import { CATEGORY_SHORT_LABELS } from '@/constants/catalog';
import { DesignColors as C, DesignType as T } from '@/constants/design-tokens';
import type { Place } from '@/types';

function PlaceCard({ place, featured = false }: { place: Place; featured?: boolean }) {
  const labels = availableFeatureLabels(place);
  if (featured) {
    return (
      <View style={styles.featuredPlaceCard}>
        <View>
          <Image source={photoSource(place)} style={styles.featuredPlacePhoto} />
          <View style={styles.verifiedBadge}><AppIcon name="check-decagram" size={13} color={C.green} /><Text style={styles.verifiedBadgeText}>Admin-Verified</Text></View>
        </View>
        <View style={styles.featuredPlaceMeta}><Text style={styles.featuredCategory}>{CATEGORY_SHORT_LABELS[place.category]} <Text style={styles.featuredArrow}>→</Text></Text><Text style={styles.featuredDistance}>0.4 km</Text></View>
        <Text style={styles.featuredPlaceName}>{place.name}</Text>
        <View style={styles.addressRow}><AppIcon name="map-marker-outline" size={16} color={C.muted} /><Text style={styles.address} numberOfLines={1}>{place.address}</Text></View>
        <View style={styles.featuredFooter}><View style={styles.featureBadge}><AppIcon name="wheelchair-accessibility" size={14} color={C.green} /><Text style={styles.featureBadgeText}>{labels[0] ?? 'Accessibility reviewed'}{labels.length > 1 ? `, +${labels.length - 1} more` : ''}</Text></View><Pressable style={styles.featuredButton} onPress={() => router.push({ pathname: '/place/[id]', params: { id: place.id } })}><Text style={styles.featuredButtonText}>View Details</Text></Pressable></View>
      </View>
    );
  }
  return (
    <View style={styles.placeCard}>
      <View style={styles.placeTop}>
        <Image source={photoSource(place)} style={styles.placePhoto} />
        <View style={styles.placeInfo}>
          <Text style={styles.placeName} numberOfLines={1}>{place.name}</Text>
          <View style={[styles.categoryPill, categoryPillStyle[place.category]]}><AppIcon name={categoryIcon[place.category]} size={15} color={categoryPillTextColor[place.category]} /><Text style={[styles.categoryText, { color: categoryPillTextColor[place.category] }]}>{CATEGORY_SHORT_LABELS[place.category]}</Text></View>
          <View style={styles.addressRow}><AppIcon name="map-marker-outline" size={20} color={C.softGray} /><Text style={styles.address} numberOfLines={1}>{place.address}</Text></View>
          <Text style={styles.featureLine}>{labels.length > 0 ? labels.slice(0, 2).join(', ') + (labels.length > 2 ? ', +1 more' : '') : 'No accessibility features on record yet'}</Text>
        </View>
        <AppIcon name="bookmark-outline" size={27} color={C.softGray} />
      </View>
      <View style={styles.placeCardActions}>
        <Button secondary onPress={() => router.push({ pathname: '/place/[id]', params: { id: place.id } })}>View Details</Button>
        <Button accessibility onPress={() => router.push({
          pathname: '/directions',
          params: { place: place.name, lat: String(place.latitude), lng: String(place.longitude) } })}>⌖  Route</Button>
      </View>
    </View>
  );
}

export default PlaceCard;

const styles = StyleSheet.create({
  featuredPlaceCard: { backgroundColor: C.card, borderRadius: 16, padding: 12, gap: 7, borderWidth: 1, borderColor: '#EDF0F7' },
  featuredPlacePhoto: { height: 176, width: '100%', borderRadius: 12 },
  verifiedBadge: { position: 'absolute', top: 9, right: 9, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  verifiedBadgeText: { color: '#126642', fontSize: 10, fontWeight: '800' },
  featuredPlaceMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  featuredCategory: { color: C.navy, fontSize: T['label-sm'], fontWeight: '800' },
  featuredArrow: { fontSize: T['body-md'] },
  featuredDistance: { color: C.muted, fontSize: 11 },
  featuredPlaceName: { color: C.ink, fontSize: T['headline-sm'], fontWeight: '700' },
  featuredFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  featureBadge: { backgroundColor: '#E8F0FF', borderRadius: 14, paddingHorizontal: 8, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  featureBadgeText: { color: C.muted, fontSize: 10, flexShrink: 1 },
  featuredButton: { backgroundColor: C.navy, minHeight: 34, borderRadius: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  featuredButtonText: { color: C.white, fontSize: T['label-sm'], fontWeight: '800' },
  placeCard: { backgroundColor: C.card, borderRadius: 18, padding: 14, gap: 14, borderWidth: 1, borderColor: '#EDF0F7', shadowColor: '#101B35', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  placeTop: { flexDirection: 'row', gap: 14, minHeight: 120 },
  placePhoto: { width: 120, height: 120, borderRadius: 10 },
  placeInfo: { flex: 1, gap: 7 },
  placeName: { color: C.ink, fontSize: T['headline-md'], fontWeight: '800' },
  categoryPill: { backgroundColor: C.slate, alignSelf: 'flex-start', borderRadius: 14, paddingHorizontal: 8, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5 },
  categoryText: { color: C.white, fontSize: T['label-md'], fontWeight: '800' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
  address: { color: C.muted, fontSize: T['body-md-tight'], flex: 1 },
  featureLine: { color: C.muted, fontSize: T['label-md'], fontWeight: '700', lineHeight: 20 },
  placeCardActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', borderTopWidth: 1, borderTopColor: C.line, paddingTop: 16 },
});
