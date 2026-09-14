import { AppIcon } from '@/components/ui/app-icon';
import { useRole } from '@/contexts/role-context';
import { usePlaces } from '@/hooks/usePlaces';
import { tabsRoute, photoSource , withAlpha , photos } from '@/lib/display';
import { useSavedPlaces } from '@/lib/saved-places';
import { M3, DesignType as T } from '@/constants/design-tokens';
import { Place } from '@/types';
import { useClerk, useUser } from '@clerk/clerk-expo';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function ProfileScreen() {
  const { user } = useUser();
  const { isAdmin } = useRole();
  const { signOut } = useClerk();
  const { places } = usePlaces();
  const clerk = useClerk();
  const { savedIds: storedSavedIds, hydrated, toggleSaved: toggleSavePlace } = useSavedPlaces();

  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'AccessMap User';
  const email = user?.emailAddresses?.[0]?.emailAddress;
  const avatar = user?.imageUrl ? { uri: user.imageUrl } : photos.avatar;

  // Saved list: the user's persisted picks, or the first two catalog places as a starting set
  // until the store hydrates.
  const effectiveSavedIds = hydrated ? storedSavedIds : places.slice(0, 2).map((place) => place.id);
  const savedPlaces = effectiveSavedIds
    .map((savedId) => places.find((place) => place.id === savedId))
    .filter((place): place is Place => !!place)
    .slice(0, 2);
  const savedCount = effectiveSavedIds.filter((savedId) => places.some((place) => place.id === savedId)).length;

  const onSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out of AccessMap?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          signOut().catch((error) => {
            console.warn('Sign out failed', error);
            Alert.alert('Sign out failed', 'Could not sign out. Please try again.');
          });
        },
      },
    ]);
  };

  const showInfoDialog = (title: string, message: string) => Alert.alert(title, message, [{ text: 'OK' }]);

  // Opens Clerk's account portal when the platform supports it; falls back to a dialog.
  const openAccountPortal = () => {
    try {
      if (clerk.openUserProfile) {
        clerk.openUserProfile();
        return;
      }
    } catch {
      // fall through to the informational dialog
    }
    showInfoDialog('Account Settings', 'Manage your account details, email, and password from your profile.');
  };

  return (
    <SafeAreaView style={styles.profileSafe} edges={['top']}>
      {/* Minimal sticky header */}
      <ScrollView contentContainerStyle={styles.profileScrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile header / user card */}
        <View style={styles.profileHeroCard}>
          <View style={styles.profileAvatarWrap}>
            <Image source={avatar} style={styles.profileAvatar} contentFit="cover" />
            <View style={styles.profileOnlineDot} />
          </View>
          <View style={styles.profileUserInfo}>
            <View style={styles.profileNameRow}>
              <Text style={styles.profileName} numberOfLines={1}>{userName}</Text>
              <Pressable
                onPress={openAccountPortal}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Edit profile details"
              >
                <Text style={styles.profileEditLink}>Edit</Text>
              </Pressable>
            </View>
            <Text style={styles.profileEmail} numberOfLines={1}>{email ?? 'Signed in with your account'}</Text>
            <View style={styles.profileMetaRow}>
              <View style={styles.profileLocRow}>
                <AppIcon name="map-marker" size={10} color={M3.outlineVariant} />
                <Text style={styles.profileLocText}>San Isidro, Cainta</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.profileDivider} />

        {/* Saved Places */}
        <View style={styles.profileSection}>
          <View style={styles.profileSectionHeader}>
            <Text style={styles.profileSectionTitle}>Saved Places</Text>
            <Pressable
              onPress={() => router.push(tabsRoute)}
              hitSlop={6}
              accessibilityRole="link"
              accessibilityLabel={`View all saved places (${savedCount})`}
            >
              <Text style={styles.profileViewAll}>View all ({savedCount})</Text>
            </Pressable>
          </View>
          <View style={styles.profileSavedList}>
            {savedPlaces.map((place) => (
              <View style={styles.profileSavedCard} key={place.id}>
                <Pressable onPress={() => router.push({ pathname: '/place/[id]', params: { id: place.id } })} style={styles.profileSavedThumbBtn} accessibilityRole="button" accessibilityLabel={`Open ${place.name}`}>
                  <Image source={photoSource(place)} style={styles.profileSavedThumb} contentFit="cover" />
                </Pressable>
                <Pressable
                  style={styles.profileSavedInfo}
                  onPress={() => router.push({ pathname: '/place/[id]', params: { id: place.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`Open details for ${place.name}`}
                >
                  <Text style={styles.profileSavedName} numberOfLines={1}>{place.name}</Text>
                  <Text style={styles.profileSavedAddress} numberOfLines={1}>{place.address}</Text>
                </Pressable>
                <Pressable
                  style={styles.profileBookmarkBtn}
                  accessibilityLabel={`Remove ${place.name} from saved places`}
                  accessibilityRole="button"
                  hitSlop={6}
                  onPress={() => toggleSavePlace(place.id)}
                >
                  <AppIcon name="bookmark" size={16} color={M3.primaryContainer} />
                </Pressable>
              </View>
            ))}
            {savedPlaces.length === 0 ? <Text style={styles.profileSavedEmpty}>No saved places yet.</Text> : null}
          </View>
        </View>

        <View style={styles.profileDivider} />

        {/* Account & App Info */}
        <View style={styles.profileSection}>
          <Text style={styles.profileSectionTitle}>Account & App Info</Text>
          <View style={styles.profileInfoList}>
            <Pressable
              style={styles.profileInfoRow}
              accessibilityRole="button"
              onPress={() => showInfoDialog(
                'About AccessMap',
                'AccessMap v1.4.0\n\nAdmin-entered accessibility data for public facilities around San Isidro, Cainta — ramps, restrooms, elevators, and accessible parking, maintained by the app administrator.',
              )}
            >
              <Text style={styles.profileInfoText}>About AccessMap</Text>
              <AppIcon name="chevron-right" size={12} color={M3.outlineVariant} />
            </Pressable>
            <Pressable
              style={[styles.profileInfoRow, styles.profileInfoRowBorder]}
              accessibilityRole="button"
              onPress={() => showInfoDialog(
                'Privacy & Terms',
                'Your account data is managed securely through Clerk. Places you save and your accessibility preferences are stored only on this device and never shared.',
              )}
            >
              <Text style={styles.profileInfoText}>Privacy & Terms</Text>
              <AppIcon name="chevron-right" size={12} color={M3.outlineVariant} />
            </Pressable>
            {isAdmin ? (
              <Pressable
                style={[styles.profileInfoRow, styles.profileInfoRowBorder]}
                accessibilityRole="button"
                accessibilityLabel="Open Admin Console"
                onPress={() => router.push('/admin/tabs')}
              >
                <Text style={styles.profileAdminText}>Admin Console</Text>
                <AppIcon name="shield-account-outline" size={13} color={M3.primaryContainer} />
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.profileInfoRow, styles.profileInfoRowBorder]}
              accessibilityRole="button"
              accessibilityLabel="Sign out of account"
              onPress={onSignOut}
            >
              <Text style={styles.profileSignOutText}>Sign Out</Text>
              <AppIcon name="logout" size={12} color="#f87171" />
            </Pressable>
          </View>
        </View>

        <Text style={styles.profileVersion}>AccessMap v1.4.0 • Admin-Verified Data</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

export type AdminTab = 'directory' | 'analytics' | 'settings';

const styles = StyleSheet.create({
  profileSafe: { flex: 1, backgroundColor: '#f8fafc' },
  profileScrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  profileHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: withAlpha('#f8fafc', 0.7),
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  profileAvatarWrap: { position: 'relative', width: 64, height: 64, flexShrink: 0 },
  profileAvatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#ffffff' },
  profileOnlineDot: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#10b981', borderWidth: 2, borderColor: '#ffffff' },
  profileUserInfo: { flex: 1, minWidth: 0 },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  profileName: { color: M3.onSurface, fontSize: 16, lineHeight: 22, fontWeight: '700', flexShrink: 1 },
  profileEditLink: { color: M3.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  profileEmail: { color: M3.secondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  profileMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, minWidth: 0 },
  profileLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ffffff', borderWidth: 1, borderColor: withAlpha('#e2e8f0', 0.6), borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, flexShrink: 1 },
  profileLocText: { color: '#475569', fontSize: 11, lineHeight: 15, fontWeight: '500' },
  profileDivider: { height: 1, backgroundColor: '#f1f5f9', marginTop: 24, marginBottom: 20 },
  profileSection: { minWidth: 0 },
  profileSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  profileSectionTitle: { color: '#94a3b8', fontSize: 11, lineHeight: 16, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', flexShrink: 1 },
  profileViewAll: { color: M3.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  profileSavedList: { gap: 10 },
  profileSavedCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: '#f1f5f9', backgroundColor: M3.surfaceContainerLowest },
  profileSavedThumbBtn: { flexShrink: 0 },
  profileSavedThumb: { width: 48, height: 48, borderRadius: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  profileSavedInfo: { flex: 1, minWidth: 0 },
  profileSavedName: { color: M3.onSurface, fontSize: 14, lineHeight: 19, fontWeight: '600', marginTop: 1 },
  profileSavedAddress: { color: '#94a3b8', fontSize: 11, lineHeight: 15, marginTop: 1 },
  profileBookmarkBtn: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  profileSavedEmpty: { color: '#94a3b8', fontSize: T['body-sm'], lineHeight: 18 },
  profileInfoList: { marginTop: 4, borderRadius: 14, borderWidth: 1, borderColor: '#f1f5f9', backgroundColor: M3.surfaceContainerLowest, overflow: 'hidden' },
  profileInfoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14, paddingVertical: 14 },
  profileInfoText: { color: '#334155', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  profileInfoRowBorder: { borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  profileAdminText: { color: M3.primaryContainer, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  profileSignOutText: { color: '#dc2626', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  profileVersion: { textAlign: 'center', color: '#94a3b8', fontSize: 11, lineHeight: 16, paddingTop: 8 },
});
