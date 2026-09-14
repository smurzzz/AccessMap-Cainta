import { AppIcon } from '@/components/ui/app-icon';
import { M3 } from '@/constants/design-tokens';
import type { IconName } from '@/lib/display';
import { AdminAnalyticsTab } from '@/screens/admin/admin-analytics-tab';
import { AdminDirectoryTab } from '@/screens/admin/admin-directory-tab';
import { AdminSettingsTab } from '@/screens/admin/admin-settings-tab';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withAlpha } from '@/lib/display';

export type AdminTab = 'directory' | 'analytics' | 'settings';

const adminNavItems: { key: AdminTab; label: string; icon: IconName }[] = [
  { key: 'directory', label: 'Directory', icon: 'format-list-bulleted' },
  { key: 'analytics', label: 'Analytics', icon: 'chart-bar' },
  { key: 'settings', label: 'Settings', icon: 'account-cog-outline' },
];

function AdminBottomNav({ active }: { active: AdminTab }) {
  return (
    <View style={styles.adminNav}>
      {adminNavItems.map((item) => {
        const isActive = item.key === active;
        return (
          <Pressable
            key={item.key}
            style={styles.adminNavItem}
            onPress={() => router.setParams({ tab: item.key })}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${item.label} tab`}
          >
            <View>
              <AppIcon name={item.icon} size={21} color={isActive ? M3.primaryContainer : '#94a3b8'} />
            </View>
            <Text style={[styles.adminNavLabel, isActive ? styles.adminNavLabelActive : null]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Shared shell for the admin console: keeps state across tab switches. */
export function AdminTabsScreen() {
  const params = useLocalSearchParams<{ tab?: string; category?: string }>();
  const tab: AdminTab = params.tab === 'analytics' || params.tab === 'settings' ? params.tab : 'directory';

  return (
    <SafeAreaView style={styles.adminNewSafe} edges={['top', 'bottom']}>
      <View style={styles.adminShellBody}>
        {tab === 'directory' ? <AdminDirectoryTab drillCategory={params.category} /> : null}
        {tab === 'analytics' ? <AdminAnalyticsTab /> : null}
        {tab === 'settings' ? <AdminSettingsTab /> : null}
      </View>
      <AdminBottomNav active={tab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  adminNav: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    backgroundColor: M3.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: withAlpha('#e2e8f0', 0.8),
    paddingHorizontal: 8,
  },
  adminNavItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 48 },
  adminNavLabel: { color: '#94a3b8', fontSize: 11, lineHeight: 14, fontWeight: '500' },
  adminNavLabelActive: { color: M3.primaryContainer, fontWeight: '600' },
  adminNewSafe: { flex: 1, backgroundColor: M3.surface },
  adminShellBody: { flex: 1 },
});
