import { buildFacilityCsv } from '@/components/features/facility-csv';
import { AppIcon } from '@/components/ui/app-icon';
import { useRole } from '@/contexts/role-context';
import { usePlaces } from '@/hooks/usePlaces';
import { photos , withAlpha } from '@/lib/display';
import { M3 } from '@/constants/design-tokens';
import { useClerk , useUser } from '@clerk/clerk-expo';
import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState , useRef } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View , Platform } from 'react-native';

export function AdminSettingsTab() {
  const { user } = useUser();
  const { isAdmin, syncing } = useRole();
  const { signOut } = useClerk();
  const clerk = useClerk();
  const { places } = usePlaces();
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [prefs, setPrefs] = useState({ notifications: true, highContrast: true });
  const [exporting, setExporting] = useState<'idle' | 'preparing' | 'done'>('idle');
  const exportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (exportTimer.current) clearTimeout(exportTimer.current);
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Administrator';

  const runExport = async () => {
    if (exporting !== 'idle' || places.length === 0) return;
    setExporting('preparing');
    const fileName = `accessmap-facility-report-${new Date().toISOString().slice(0, 10)}.csv`;
    try {
      const csv = buildFacilityCsv(places);
      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } else {
        const file = new FileSystem.File(FileSystem.Paths.cache, fileName);
        if (file.exists) file.delete();
        file.write(csv);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, {
            mimeType: 'text/csv',
            dialogTitle: 'Export AccessMap facility report',
            UTI: 'public.comma-separated-values-text',
          });
        } else {
          Alert.alert('Report ready', `Saved to: ${file.uri}`);
        }
      }
      setExporting('done');
      showToast('Report downloaded (CSV)');
      exportTimer.current = setTimeout(() => setExporting('idle'), 2200);
    } catch (exportError) {
      console.warn('Export failed', exportError);
      setExporting('idle');
      Alert.alert('Export failed', 'Could not generate the report. Please try again.');
    }
  };

  const onSignOut = () => {
    Alert.alert('Sign out', 'Sign out of the Admin Console?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          signOut().catch((signOutError) => {
            console.warn('Sign out failed', signOutError);
            Alert.alert('Sign out failed', 'Could not sign out. Please try again.');
          });
        },
      },
    ]);
  };

  const openAccountPortal = () => {
    try {
      if (clerk.openUserProfile) {
        clerk.openUserProfile();
        return;
      }
    } catch {
      // fall through to the dialog
    }
    Alert.alert('Edit Admin Profile', 'Manage your name, email, and photo from your Clerk account profile.', [{ text: 'OK' }]);
  };

  return (
    <View style={styles.adminTabBody}>
      {/* Toast notification */}
      {toast ? (
        <View style={styles.adminToast} pointerEvents="none">
          <AppIcon name="check-circle" size={17} color={M3.tertiaryFixed} />
          <Text style={styles.adminToastText}>{toast}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.adminNewScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Section 1: Admin identity card */}
        <View style={styles.adminIdCard}>
          <View style={styles.adminIdCardRing} pointerEvents="none" />
          <View style={styles.adminIdCardRingSmall} pointerEvents="none" />
          <View style={styles.adminIdCardRow}>
            <View style={styles.adminIdAvatarWrap}>
              <Image source={user?.imageUrl ? { uri: user.imageUrl } : photos.avatar} style={styles.adminIdAvatar} contentFit="cover" />
            </View>
            <View style={styles.adminIdCopy}>
              <View style={styles.adminIdRolePill}>
                <Text style={styles.adminIdRoleText}>{syncing ? 'Checking role…' : isAdmin ? 'Administrator' : 'Community Member'}</Text>
              </View>
              <Text style={styles.adminIdName} numberOfLines={1}>{userName}</Text>
              <View style={styles.adminIdLocRow}>
                <AppIcon name="map-marker-radius" size={14} color={M3.onSecondaryContainer} />
                <Text style={styles.adminIdLocText} numberOfLines={1}>Cainta, Rizal</Text>
              </View>
            </View>
          </View>
          <Pressable
            style={styles.adminIdEditBtn}
            onPress={openAccountPortal}
            accessibilityRole="button"
            accessibilityLabel="Edit admin profile"
          >
            <AppIcon name="pencil" size={17} color={M3.primaryContainer} />
            <Text style={styles.adminIdEditText}>Edit Profile</Text>
          </Pressable>
        </View>

        {/* Section 2: General settings */}
        <Text style={styles.adminSectionLabel}>General Settings</Text>
        <View style={styles.adminToolList}>
          {/* System Notifications toggle */}
          <View style={styles.adminToolRow}>
            <View style={styles.adminToolIconMuted}><AppIcon name="bell-outline" size={19} color={M3.onSurfaceVariant} /></View>
            <View style={styles.adminToolCopy}>
              <Text style={styles.adminToolTitle}>System Notifications</Text>
              <Text style={styles.adminToolSub} numberOfLines={1}>Receive app updates and new listing alerts</Text>
            </View>
            <Pressable
              style={[styles.adminMiniSwitch, prefs.notifications ? styles.adminMiniSwitchOn : styles.adminMiniSwitchOff]}
              onPress={() => {
                setPrefs((current) => ({ ...current, notifications: !current.notifications }));
                showToast(!prefs.notifications ? 'System notifications enabled' : 'System notifications muted');
              }}
              accessibilityRole="switch"
              accessibilityState={{ checked: prefs.notifications }}
              accessibilityLabel="Toggle system notifications"
              hitSlop={8}
            >
              <View style={[styles.adminMiniKnob, prefs.notifications && styles.adminMiniKnobOn]} />
            </Pressable>
          </View>
          <View style={styles.adminToolDivider} />
          {/* Dark / high-contrast toggle */}
          <View style={styles.adminToolRow}>
            <View style={styles.adminToolIconMuted}><AppIcon name="contrast" size={19} color={M3.onSurfaceVariant} /></View>
            <View style={styles.adminToolCopy}>
              <Text style={styles.adminToolTitle}>Dark / High-Contrast Mode</Text>
              <Text style={styles.adminToolSub} numberOfLines={1}>Improve visibility in outdoor sunlight</Text>
            </View>
            <Pressable
              style={[styles.adminMiniSwitch, prefs.highContrast ? styles.adminMiniSwitchOn : styles.adminMiniSwitchOff]}
              onPress={() => {
                setPrefs((current) => ({ ...current, highContrast: !current.highContrast }));
                showToast(!prefs.highContrast ? 'High-contrast field mode active' : 'Standard display mode active');
              }}
              accessibilityRole="switch"
              accessibilityState={{ checked: prefs.highContrast }}
              accessibilityLabel="Toggle dark or high-contrast display mode"
              hitSlop={8}
            >
              <View style={[styles.adminMiniKnob, prefs.highContrast && styles.adminMiniKnobOn]} />
            </Pressable>
          </View>
          <View style={styles.adminToolDivider} />
          {/* Account security */}
          <Pressable
            style={styles.adminToolRow}
            onPress={openAccountPortal}
            accessibilityRole="button"
            accessibilityLabel="Account security and password"
          >
            <View style={styles.adminToolIconMuted}><AppIcon name="lock-outline" size={19} color={M3.onSurfaceVariant} /></View>
            <View style={styles.adminToolCopy}>
              <Text style={styles.adminToolTitle}>Account Security & Password</Text>
              <Text style={styles.adminToolSub} numberOfLines={1}>Update login credentials and passkeys</Text>
            </View>
            <AppIcon name="chevron-right" size={18} color="#747689" />
          </Pressable>
          <View style={styles.adminToolDivider} />
          {/* Data backup & export */}
          <Pressable
            style={styles.adminToolRow}
            onPress={runExport}
            accessibilityRole="button"
            accessibilityLabel="Data backup and export"
          >
            <View style={styles.adminToolIconMuted}>
              {exporting === 'preparing' ? (
                <ActivityIndicator size="small" color={M3.primaryContainer} />
              ) : (
                <AppIcon name="download" size={19} color={M3.onSurfaceVariant} />
              )}
            </View>
            <View style={styles.adminToolCopy}>
              <Text style={styles.adminToolTitle}>Data Backup & Export</Text>
              <Text style={styles.adminToolSub} numberOfLines={1}>
                {exporting === 'preparing'
                  ? 'Generating municipal CSV report…'
                  : exporting === 'done'
                    ? 'Report downloaded'
                    : 'Export municipal reports and CSV data'}
              </Text>
            </View>
            <AppIcon name="chevron-right" size={18} color="#747689" />
          </Pressable>
        </View>
        {/* Section 5: Role switcher & console exit */}
        <Pressable
          style={styles.adminCitizenBtn}
          onPress={() => router.replace('/(tabs)')}
          accessibilityRole="button"
          accessibilityLabel="Switch to citizen view"
        >
          <AppIcon name="account-switch" size={19} color={M3.primaryContainer} />
          <Text style={styles.adminCitizenText}>Switch to Citizen View</Text>
        </Pressable>
        <Pressable
          style={styles.adminSignOutBtn}
          onPress={onSignOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out of admin console"
        >
          <AppIcon name="logout" size={17} color={M3.error} />
          <Text style={styles.adminSignOutText}>Sign Out</Text>
        </Pressable>

        <View style={styles.adminFooterSign}>
          <Text style={styles.adminFooterSignSub}>AccessMap Admin Portal • v1.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  adminTabBody: { flex: 1 },
  adminToast: {
    position: 'absolute',
    top: 76,
    alignSelf: 'center',
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: M3.inverseSurface,
    shadowColor: '#0b1c30',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  adminToastText: { color: M3.inverseOnSurface, fontSize: 13, lineHeight: 16, fontWeight: '500' },
  adminNewScroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 110, gap: 14 },
  adminIdCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c5dcff',
    backgroundColor: M3.surfaceContainerLowest,
    gap: 12,
    overflow: 'hidden',
    shadowColor: '#0b1c30',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  adminIdCardRing: { position: 'absolute', width: 148, height: 148, top: -76, right: -28, borderRadius: 74, borderWidth: 2, borderColor: '#c5dcff', opacity: 0.72 },
  adminIdCardRingSmall: { position: 'absolute', width: 82, height: 82, top: 30, right: 20, borderRadius: 41, borderWidth: 2, borderColor: '#c5dcff', opacity: 0.5 },
  adminIdCardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  adminIdAvatarWrap: { width: 64, height: 64, flexShrink: 0 },
  adminIdAvatar: { width: 64, height: 64, borderRadius: 12, backgroundColor: M3.surfaceContainerLow },
  adminIdCopy: { flex: 1, minWidth: 0, gap: 3 },
  adminIdRolePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#dcfce7',
    marginBottom: 2,
  },
  adminIdRoleText: { color: '#166534', fontSize: 11, lineHeight: 14, fontWeight: '700' },
  adminIdName: { color: M3.onSurface, fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 },
  adminIdLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  adminIdLocText: { color: M3.onSurfaceVariant, fontSize: 11, lineHeight: 14, fontWeight: '600' },
  adminIdEditBtn: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: M3.surfaceContainerLow,
  },
  adminIdEditText: { color: M3.onSurface, fontSize: 13, lineHeight: 16, fontWeight: '500' },
  adminSectionLabel: { color: M3.onSurfaceVariant, fontSize: 13, lineHeight: 16, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase', paddingHorizontal: 4 },
  adminToolList: {
    borderRadius: 12,
    backgroundColor: M3.surfaceContainerLowest,
    overflow: 'hidden',
    shadowColor: '#0b1c30',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  adminToolRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  adminToolIconMuted: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: M3.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  adminToolCopy: { flex: 1, minWidth: 0, gap: 1 },
  adminToolTitle: { color: M3.onSurface, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  adminToolSub: { color: M3.onSurfaceVariant, fontSize: 13, lineHeight: 18 },
  adminMiniSwitch: {
    width: 56,
    height: 32,
    borderRadius: 999,
    padding: 2,
    justifyContent: 'center',
    flexShrink: 0,
  },
  adminMiniSwitchOn: { backgroundColor: M3.primaryContainer, alignItems: 'flex-end' },
  adminMiniSwitchOff: { backgroundColor: M3.surfaceContainerHighest, alignItems: 'flex-start' },
  adminMiniKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: M3.onPrimary,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  adminMiniKnobOn: {},
  adminToolDivider: { height: 1, backgroundColor: M3.surfaceContainer, marginHorizontal: 16 },
  adminCitizenBtn: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: M3.surfaceContainerLowest,
    shadowColor: '#0b1c30',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  adminCitizenText: { color: M3.primaryContainer, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  adminSignOutBtn: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
  },
  adminSignOutText: { color: M3.error, fontSize: 13, lineHeight: 16, fontWeight: '600' },
  adminFooterSign: { alignItems: 'center', paddingTop: 8, paddingBottom: 8 },
  adminFooterSignSub: { color: withAlpha(M3.onSurfaceVariant, 0.6), fontSize: 10, lineHeight: 13 },
});
