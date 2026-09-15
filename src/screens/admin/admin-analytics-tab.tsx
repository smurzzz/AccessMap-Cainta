import { AppIcon } from '@/components/ui/app-icon';
import { usePlaces } from '@/hooks/usePlaces';
import { supabase } from '@/lib/supabase';
import { M3 } from '@/constants/design-tokens';
import { withAlpha } from '@/lib/display';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState , useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { IconName } from '@/lib/display';
import EmptyState from '@/components/ui/empty-state';

const daysAgo = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));

export function AdminAnalyticsTab() {
  const { places, loading, error, reload } = usePlaces();
  const [justRefreshed, setJustRefreshed] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  // Real-time: re-fetch whenever any facility row changes in Supabase.
  useEffect(() => {
    const client = supabase;
    if (!client) return undefined;
    const channel = client
      .channel('admin-analytics-places')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'places' }, () => reload())
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [reload]);

  const facilityCount = places.length;
  const categoryCount = useMemo(() => new Set(places.map((place) => place.category)).size, [places]);
  const featuresLogged = useMemo(
    () => places.reduce((sum, place) => sum + (place.accessibility_features ?? []).length, 0),
    [places],
  );
  const recentUpdates = useMemo(() => places.filter((place) => daysAgo(place.updated_at) <= 30).length, [places]);
  const recentUpdatesWeek = useMemo(() => places.filter((place) => daysAgo(place.updated_at) <= 7).length, [places]);

  const openDirectory = () => router.setParams({ tab: 'directory' });

  const metricCards: { id: string; label: string; value: number; note: string; icon: IconName; onPress?: () => void }[] = [
    {
      id: 'facilities',
      label: 'Total Facilities',
      value: facilityCount,
      note: 'Registered places',
      icon: 'office-building-outline',
      onPress: openDirectory,
    },
    {
      id: 'categories',
      label: 'Categories',
      value: categoryCount,
      note: 'Facility types',
      icon: 'view-grid-outline',
      onPress: openDirectory,
    },
    {
      id: 'features',
      label: 'Features Logged',
      value: featuresLogged,
      note: 'Accessibility markers',
      icon: 'format-list-checks',
    },
    {
      id: 'recent',
      label: 'Recent Updates',
      value: recentUpdates,
      note: recentUpdatesWeek > 0 ? `${recentUpdatesWeek} in the last 7 days` : 'Updated this month',
      icon: 'update',
    },
  ];

  const onManualRefresh = () => {
    reload();
    setJustRefreshed(true);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => setJustRefreshed(false), 2000);
  };

  const summaryRows: { id: string; label: string; value: string; onPress?: () => void }[] = [
    { id: 'status', label: 'Status', value: 'Active Monitoring' },
    { id: 'coverage', label: 'Coverage', value: 'San Isidro District' },
    {
      id: 'categories',
      label: 'Categories',
      value:
        categoryCount === 0
          ? 'None registered'
          : categoryCount === 1
            ? '1 facility type'
            : `${categoryCount} facility types`,
      onPress: openDirectory,
    },
  ];

  return (
    <View style={styles.adminTabBody}>
      <ScrollView contentContainerStyle={styles.adminAnalyticsScroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.adminAnalyticsHeader}>
          <View style={styles.adminAnalyticsBackdropRing} pointerEvents="none" />
          <View style={styles.adminAnalyticsBackdropRingSmall} pointerEvents="none" />
          <View style={styles.adminAnalyticsAccent} />
          <Text style={styles.adminAnalyticsEyebrow}>ADMIN INSIGHTS</Text>
          <View style={styles.adminAnalyticsHeaderRow}>
            <Text style={styles.adminAnalyticsHeading}>Facility Analytics</Text>
            <Pressable
              style={[styles.adminAnalyticsLivePill, justRefreshed ? styles.adminAnalyticsLivePillSynced : null]}
              onPress={onManualRefresh}
              accessibilityRole="button"
              accessibilityLabel="Real-time updates active. Tap to refresh now"
            >
              <Text style={[styles.adminAnalyticsLiveText, justRefreshed ? styles.adminAnalyticsLiveTextSynced : null]}>
                {loading ? 'Syncing…' : justRefreshed ? 'Updated' : 'Real-time'}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.adminTitleBody}>High-level accessibility summary for San Isidro, Cainta.</Text>
        </View>

        {/* Metric cards */}
        <View style={styles.adminAnalyticsCards}>
          {metricCards.map((card) => {
            const Copy = (
              <>
                <Text style={styles.adminAnalyticsCardLabel}>{card.label}</Text>
                <Text style={styles.adminAnalyticsCardValue}>{loading ? '—' : card.value}</Text>
                <Text style={styles.adminAnalyticsCardNote}>{card.note}</Text>
              </>
            );
            const Icon = (
              <View style={styles.adminAnalyticsCardIcon}>
                <AppIcon name={card.icon} size={20} color={M3.primaryContainer} />
              </View>
            );
            return card.onPress ? (
              <Pressable
                key={card.id}
                style={styles.adminAnalyticsCard}
                onPress={card.onPress}
                accessibilityRole="button"
                accessibilityLabel={`${card.label}: ${loading ? 'loading' : card.value}. ${card.note}. Open Directory`}
              >
                <View style={styles.adminAnalyticsCardCopy}>{Copy}</View>
                {Icon}
              </Pressable>
            ) : (
              <View key={card.id} style={styles.adminAnalyticsCard}>
                <View style={styles.adminAnalyticsCardCopy}>{Copy}</View>
                {Icon}
              </View>
            );
          })}
        </View>

        {/* Summary card */}
        <View style={styles.adminAnalyticsSummary}>
          {summaryRows.map((row) => {
            const RowContent = (
              <>
                <Text style={styles.adminAnalyticsSummaryLabel}>{row.label}</Text>
                <View style={styles.adminAnalyticsSummaryValueRow}>
                  <Text style={styles.adminAnalyticsSummaryValue} numberOfLines={1}>
                    {row.value}
                  </Text>
                  {row.onPress ? <AppIcon name="chevron-down" size={14} color={M3.outline} /> : null}
                </View>
              </>
            );
            return row.onPress ? (
              <Pressable
                key={row.id}
                style={styles.adminAnalyticsSummaryRow}
                onPress={row.onPress}
                accessibilityRole="button"
                accessibilityLabel={`${row.label}: ${row.value}. Open Directory`}
              >
                {RowContent}
              </Pressable>
            ) : (
              <View key={row.id} style={styles.adminAnalyticsSummaryRow}>{RowContent}</View>
            );
          })}
        </View>

        {/* States */}
        {error ? <EmptyState title="Could not load analytics" message={error} /> : null}
        {!error && !loading && facilityCount === 0 ? (
          <EmptyState
            title="No facilities yet"
            message="Add facilities in the Directory and this dashboard will update in real time."
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  adminTabBody: { flex: 1 },
  adminAnalyticsScroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120, gap: 20 },
  adminAnalyticsHeader: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#c5dcff',
    backgroundColor: '#e8f1ff',
    gap: 7,
    shadowColor: '#0f2742',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
    overflow: 'hidden',
  },
  adminAnalyticsBackdropRing: { position: 'absolute', width: 148, height: 148, top: -76, right: -28, borderRadius: 74, borderWidth: 2, borderColor: '#c5dcff', opacity: 0.72 },
  adminAnalyticsBackdropRingSmall: { position: 'absolute', width: 82, height: 82, top: 30, right: 20, borderRadius: 41, borderWidth: 2, borderColor: '#c5dcff', opacity: 0.5 },
  adminAnalyticsAccent: { height: 3, width: 42, borderRadius: 999, backgroundColor: M3.primaryContainer, marginBottom: 2 },
  adminAnalyticsEyebrow: { color: M3.primaryContainer, fontSize: 10, lineHeight: 13, fontWeight: '700', letterSpacing: 1 },
  adminAnalyticsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  adminAnalyticsHeading: { color: '#0f172a', fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.36, flexShrink: 1 },
  adminAnalyticsLivePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    flexShrink: 0,
  },
  adminAnalyticsLivePillSynced: { backgroundColor: M3.tertiaryFixed },
  adminAnalyticsLiveText: { color: M3.primaryContainer, fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.33 },
  adminAnalyticsLiveTextSynced: { color: M3.tertiary },
  adminTitleBody: { color: M3.onSurfaceVariant, fontSize: 13, lineHeight: 18 },
  adminAnalyticsCards: { gap: 12 },
  adminAnalyticsCardLabel: { color: M3.onSurfaceVariant, fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.33 },
  adminAnalyticsCardValue: { color: M3.onSurface, fontSize: 24, lineHeight: 30, fontWeight: '600', letterSpacing: -0.36 },
  adminAnalyticsCardNote: { color: M3.onSurfaceVariant, fontSize: 13, lineHeight: 18 },
  adminAnalyticsCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: M3.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  adminAnalyticsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    borderRadius: 8,
    backgroundColor: M3.surfaceContainerLowest,
    shadowColor: '#0b1c30',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  adminAnalyticsCardCopy: { flex: 1, minWidth: 0, gap: 4 },
  adminAnalyticsSummary: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: M3.surfaceContainerLow,
    gap: 4,
  },
  adminAnalyticsSummaryLabel: {
    color: M3.onSurfaceVariant,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.33,
    minWidth: 88,
    flexShrink: 0,
  },
  adminAnalyticsSummaryValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  adminAnalyticsSummaryValue: { color: M3.onSurface, fontSize: 13, lineHeight: 18, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  adminAnalyticsSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: withAlpha(M3.outlineVariant, 0.3),
  },
});
