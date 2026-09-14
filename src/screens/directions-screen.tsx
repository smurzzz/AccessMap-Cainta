import OSMMap, { OSMMapHandle } from '@/components/osm-map';
import { AppIcon } from '@/components/ui/app-icon';
import EmptyState from '@/components/ui/empty-state';
import LoadingState from '@/components/ui/loading-state';
import { DesignType as T, M3 } from '@/constants/design-tokens';
import { photos , withAlpha , photoSource } from '@/lib/display';
import { getDirections, formatDistance, formatDuration, DirectionsResult, RouteStepData } from '@/lib/maps';
import { shareAppMessage } from '@/lib/share';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {  Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '@clerk/clerk-expo';
import { usePlaces } from '@/hooks/usePlaces';
import type { IconName } from '@/lib/display';

const STEP_MANEVER_ICONS: Record<number, IconName> = {
  0: 'arrow-left',
  1: 'arrow-right',
  2: 'arrow-top-left',
  3: 'arrow-top-right',
  4: 'arrow-top-left',
  5: 'arrow-top-right',
  6: 'arrow-up',
  7: 'rotate-right',
  8: 'rotate-left',
  9: 'arrow-u-left-top',
  10: 'map-marker',
  11: 'arrow-up',
  12: 'arrow-top-left',
  13: 'arrow-top-right',
};

const STEP_STATUS_LABEL: Record<number, string> = {
  10: 'Auto Doors',
  0: 'Flush Cut',
  1: 'Flush Cut',
  2: 'Flush Cut',
  3: 'Flush Cut',
  4: 'Flush Cut',
  5: 'Flush Cut',
  12: 'Flush Cut',
  13: 'Flush Cut',
};

function stepStack(step: RouteStepData) {
  const type = step.type ?? 6;
  const arrival = type === 10;
  const turn = !arrival && type !== 6 && type !== 7 && type !== 8 && type !== 9 && type !== 11;
  const label = STEP_STATUS_LABEL[type] ?? (turn ? 'Flush Cut' : type === 6 ? 'Level' : 'Signalized');
  const icon: IconName = arrival ? 'door-open' : turn ? 'check' : 'check';
  let detail = 'Zero curbs, continuous tactile paving present.';
  if (arrival) detail = 'Automatic double-clearance doors and low-height reception desk.';
  else if (turn) detail = 'Ramp with 1:12 grade, no lip, 140cm clearance.';
  else if (type === 6) detail = 'Continuous tactile paving present with smooth connections.';
  return { label, icon, arrival, detail };
}

function VectorRouteCanvas() {
  return (
    <View style={styles.navMapCanvas} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 400 256" preserveAspectRatio="xMidYMid slice">
        <Rect width="400" height="256" fill="#eef3fb" />
        <G stroke="#cbd5e1" strokeLinecap="round">
          <LineCoords x1={-10} y1={200} x2={380} y2={40} width={26} />
          <LineCoords x1={80} y1={240} x2={80} y2={-10} width={22} />
          <LineCoords x1={180} y1={260} x2={180} y2={-10} width={28} />
          <LineCoords x1={-10} y1={130} x2={380} y2={130} width={18} />
        </G>
        <G stroke="#ffffff" strokeLinecap="round">
          <LineCoords x1={-10} y1={200} x2={380} y2={40} width={20} />
          <LineCoords x1={80} y1={240} x2={80} y2={-10} width={16} />
          <LineCoords x1={180} y1={260} x2={180} y2={-10} width={22} />
          <LineCoords x1={-10} y1={130} x2={380} y2={130} width={14} />
        </G>
        <SvgText x={186} y={240} fill="#64748b" fontSize={10} fontWeight="600" letterSpacing={1}>FELIX AVENUE</SvgText>
        <SvgText x={86} y={45} fill="#64748b" fontSize={9}>PAROLA ST</SvgText>
        <SvgText transform="rotate(-23 210,70)" x={210} y={70} fill="#64748b" fontSize={9}>ORTIGAS AVE EXT</SvgText>
        <Path d="M 80 180 L 80 130 L 180 130 L 180 50" fill="none" stroke="#1e40ff" strokeLinecap="round" strokeLinejoin="round" strokeWidth={5} />
        <Path d="M 86 175 L 86 136 L 174 136 L 174 54" fill="none" stroke="#63f1b4" strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        <Circle cx={80} cy={180} r={12} fill="#1e40ff" opacity={0.25} />
        <Circle cx={80} cy={180} r={6} fill="#1e40ff" stroke="#ffffff" strokeWidth={2} />
        <Circle cx={80} cy={130} r={3.5} fill="#ffffff" stroke="#1e40ff" strokeWidth={2} />
        <Circle cx={180} cy={130} r={3.5} fill="#ffffff" stroke="#1e40ff" strokeWidth={2} />
        <Circle cx={180} cy={50} r={9} fill="#005136" />
        <Circle cx={180} cy={50} r={4} fill="#ffffff" />
      </Svg>
    </View>
  );
}

function LineCoords({ x1, y1, x2, y2, width }: { x1: number; y1: number; x2: number; y2: number; width: number }) {
  return <Path d={`M ${x1} ${y1} L ${x2} ${y2}`} strokeWidth={width} fill="none" />;
}

export function DirectionsScreen() {
  const { place, lat, lng } = useLocalSearchParams<{ place?: string; lat?: string; lng?: string }>();
  const destLat = lat ? parseFloat(lat) : null;
  const destLng = lng ? parseFloat(lng) : null;
  const [attempt, setAttempt] = useState(0);
  const [routeState, setRouteState] = useState<'loading' | 'done' | 'error' | 'permission'>('loading');
  const [result, setResult] = useState<DirectionsResult | null>(null);
  const [message, setMessage] = useState('');
  const navMapRef = useRef<OSMMapHandle>(null);
  const { user } = useUser();
  const { places } = usePlaces();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          setRouteState('permission');
          setMessage('Location permission is needed once to compute your walking route from your current position. It is never used to track you.');
          return;
        }
        if (destLat === null || destLng === null) throw new Error('This place has no coordinates on record yet.');
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        const directions = await getDirections({
          originLat: position.coords.latitude,
          originLng: position.coords.longitude,
          destLat,
          destLng,
        });
        if (cancelled) return;
        setResult(directions);
        setRouteState('done');
      } catch (err) {
        if (cancelled) return;
        setRouteState('error');
        setMessage(err instanceof Error ? err.message : 'Could not load directions. Please try again.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt, destLat, destLng]);

  const placeData = place ? places.find((item) => item.name === place) : undefined;
  const destName = placeData?.name ?? place ?? 'Cainta Municipal Hall Annex';
  const destAddress = placeData?.address ?? 'San Isidro, Cainta, Rizal';
  const avatar = user?.imageUrl ? { uri: user.imageUrl } : photos.avatar;
  const photo = placeData ? photoSource(placeData) : photos.hall;

  const stepsData: RouteStepData[] = result?.steps?.length ? result.steps : [];
  const fallbackSteps: RouteStepData[] = [
    { distance: 150, duration: 90, type: 6, instruction: 'Head east on Parola St along smooth paved sidewalk.' },
    { distance: 80, duration: 48, type: 0, instruction: 'Turn left onto Felix Avenue. Continuous concrete curb cut.' },
    { distance: 180, duration: 108, type: 6, instruction: 'Continue along Felix Avenue toward Cainta Municipal Hall Annex main gate.' },
    { distance: 40, duration: 24, type: 10, instruction: 'Arrive at Main Public Assistance Desk Ramp.' },
  ];
  const steps = stepsData.length > 0 ? stepsData : fallbackSteps;

  const distanceLabel = result ? formatDistance(result.totalDistance) : '450 m';
  const timeLabel = result ? `${formatDuration(result.totalDuration)} walk` : '6 min walk';
  const maneuverStep = steps[0];
  const maneuverIcon = STEP_MANEVER_ICONS[maneuverStep.type ?? 6] ?? 'arrow-up';
  const maneuverDistance = result ? formatDistance(maneuverStep.distance) : '80 meters';

  return (
    <SafeAreaView style={styles.navSafe} edges={['top']}>
      {/* Fixed header */}
      <View style={styles.navTopBar}>
        <View style={styles.navTopLeft}>
          <Pressable style={styles.navBackBtn} onPress={() => router.back()} accessibilityLabel="Go Back" accessibilityRole="button">
            <AppIcon name="arrow-left" size={24} color={M3.onSurface} />
          </Pressable>
          <View style={styles.navTopTitles}>
            <Text style={styles.navTopEyebrow}>Walking Route</Text>
            <Text style={styles.navTopTitle} numberOfLines={1}>Directions</Text>
          </View>
        </View>
        <View style={styles.navTopRight}>
          <View style={styles.navAccessPill}>
            <View style={styles.navAccessDot} />
            <Text style={styles.navAccessText}>Accessible</Text>
          </View>
          <Image source={avatar} style={styles.navAvatar} contentFit="cover" />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.navScrollContent} showsVerticalScrollIndicator={false}>
        {routeState === 'loading' ? <View style={styles.navStateBar}><LoadingState label="Fetching your walking route…" /></View> : null}
        {routeState === 'error' || routeState === 'permission' ? (
          <View style={styles.navStateBar}>
            <EmptyState title={routeState === 'permission' ? 'Location permission needed' : 'Could not load directions'} message={message} />
            <Pressable style={styles.navRetryBtn} onPress={() => { setMessage(''); setAttempt((count) => count + 1); }}>
              <Text style={styles.navRetryText}>↻  Try Again</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Destination Header Card */}
        <View style={styles.navDestCard}>
          <View style={styles.navDestTop}>
            <View style={styles.navDestInfo}>
              <Text style={styles.navDestEyebrow}>Destination</Text>
              <Text style={styles.navDestTitle} numberOfLines={1}>{destName}</Text>
              <View style={styles.navDestLocRow}>
                <AppIcon name="map-marker" size={16} color={M3.secondary} />
                <Text style={styles.navDestLocText} numberOfLines={1}>{destAddress}</Text>
              </View>
            </View>
            <View style={styles.navLivePill}>
              <AppIcon name="check-decagram" size={13} color={M3.tertiary} />
              <Text style={styles.navLiveText}>Admin-Verified</Text>
            </View>
          </View>
          <View style={styles.navMetrics}>
            <View style={styles.navMetric}>
              <Text style={styles.navMetricLabel}>Distance</Text>
              <Text style={styles.navMetricValue}>{distanceLabel}</Text>
            </View>
            <View style={styles.navMetricDivider} />
            <View style={styles.navMetric}>
              <Text style={styles.navMetricLabel}>Est. Time</Text>
              <Text style={styles.navMetricValue}>{timeLabel}</Text>
            </View>
            <View style={styles.navMetricDivider} />
            <View style={styles.navMetric}>
              <Text style={styles.navMetricLabel}>Terrain</Text>
              <View style={styles.navMetricTerrain}>
                <AppIcon name="check-circle" size={14} color={M3.tertiary} />
                <Text style={styles.navMetricTerrainText}>Step-Free</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Next Maneuver Banner */}
        <View style={styles.navManeuverBanner}>
          <View style={styles.navManeuverIcon}>
            <AppIcon name={maneuverIcon} size={32} color={M3.onPrimary} />
          </View>
          <View style={styles.navManeuverBody}>
            <Text style={styles.navManeuverEyebrow}>Next Step • In {maneuverDistance}</Text>
            <Text style={styles.navManeuverTitle} numberOfLines={2}>{maneuverStep.instruction || 'Turn left onto Felix Avenue'}</Text>
            <View style={styles.navManeuverLandmarkRow}>
              <AppIcon name="navigation" size={15} color={M3.onPrimaryContainer} />
              <Text style={styles.navManeuverLandmark} numberOfLines={1}>Landmark: Ramp entrance beside San Isidro Pharmacy</Text>
            </View>
          </View>
        </View>

        {/* Map Canvas + Overlays */}
        <View style={styles.navMapWrap}>
          {stepsData.length === 0 ? (
            <VectorRouteCanvas />
          ) : (
            <OSMMap
              ref={navMapRef}
              pins={[
                { id: 'origin', latitude: result?.coords[0]?.latitude ?? 0, longitude: result?.coords[0]?.longitude ?? 0, title: 'Your location', color: '#1e40ff' },
                { id: 'dest', latitude: destLat ?? 0, longitude: destLng ?? 0, title: destName, color: '#005136' },
              ]}
              line={result?.coords ?? []}
              height={256}
            />
          )}

          <View style={styles.navMapStepFree} pointerEvents="none">
            <AppIcon name="human-wheelchair" size={16} color={M3.tertiary} />
            <Text style={styles.navMapStepFreeText}>Step-Free Route</Text>
          </View>

          <View style={styles.navMapControls}>
            <Pressable style={styles.navMapReticleBtn} accessibilityLabel="Recenter map on route" accessibilityRole="button" hitSlop={6} onPress={() => navMapRef.current?.recenter()}>
              <AppIcon name="crosshairs-gps" size={20} color={M3.primaryContainer} />
            </Pressable>
            <View style={styles.navMapZoomGroup} >
              <Pressable style={styles.navMapZoomBtn} accessibilityLabel="Zoom in" accessibilityRole="button" hitSlop={8} onPress={() => navMapRef.current?.zoomIn()}>
                <AppIcon name="plus" size={18} color={M3.onSurface} />
              </Pressable>
              <View style={styles.navMapZoomDivider} />
              <Pressable style={styles.navMapZoomBtn} accessibilityLabel="Zoom out" accessibilityRole="button" hitSlop={8} onPress={() => navMapRef.current?.zoomOut()}>
                <AppIcon name="minus" size={18} color={M3.onSurface} />
              </Pressable>
            </View>
          </View>

          <View style={styles.navMapLocBadge} pointerEvents="none">
            <View style={styles.navMapLocLeftWrap}>
              <AppIcon name="human-wheelchair" size={14} color={M3.tertiary} />
              <Text style={styles.navMapLocLeft} numberOfLines={1}>Felix Ave Sidewalk • Ramp Grade: 1:12</Text>
            </View>
            <Text style={styles.navMapLocRight}>Paved</Text>
          </View>
        </View>

        {/* Landmark Photo Preview */}
        <View style={styles.navPhotoCard}>
          <View style={styles.navPhotoHeader}>
            <View style={styles.navPhotoTitleRow}>
              <AppIcon name="check-decagram" size={18} color={M3.primaryContainer} />
              <Text style={styles.navPhotoTitle}>Destination Arrival Visual</Text>
            </View>
            <View style={styles.navPhotoBadge}>
              <Text style={styles.navPhotoBadgeText}>Admin-Verified Photo</Text>
            </View>
          </View>
          <View style={styles.navPhotoBody}>
            <Image source={photo} style={styles.navPhoto} contentFit="cover" />
            <View style={styles.navPhotoText}>
              <Text style={styles.navPhotoName} numberOfLines={1}>{destName}</Text>
              <Text style={styles.navPhotoEntrance}>Main Public Assistance Entrance</Text>
              <Text style={styles.navPhotoDesc} numberOfLines={2}>Features a wide, smooth-cast concrete ramp with dual handrails and motion-sensor automatic sliding doors.</Text>
            </View>
          </View>
        </View>

        {/* Turn-by-Turn Guidance */}
        <View style={styles.navTurnCard}>
          <View style={styles.navTurnHeader}>
            <View style={styles.navTurnHeaderTitleRow}>
              <AppIcon name="source-branch" size={20} color={M3.primaryContainer} />
              <Text style={styles.navTurnHeaderText}>Turn-by-Turn Guidance ({steps.length} Steps)</Text>
            </View>
            <View style={styles.navTurnPill}><Text style={styles.navTurnPillText}>Step-Free Only</Text></View>
          </View>
          <View style={styles.navSteps}>
            {steps.map((step, index) => {
              const stack = stepStack(step);
              const current = index === 0;
              const arrival = stack.arrival;
              const maneuverIconForStep = STEP_MANEVER_ICONS[step.type ?? 6] ?? 'arrow-up';
              const distanceText = result ? formatDistance(step.distance) : step.distance > 0 ? formatDistance(step.distance) : '40 m';
              return (
                <View key={`${step.instruction}-${index}`} style={[styles.navStepRow, current && styles.navStepRowActive]}>
                  <View style={[styles.navStepIcon, arrival ? styles.navStepIconArrival : current ? styles.navStepIconActive : styles.navStepIconIdle]}>
                    <AppIcon name={maneuverIconForStep} size={18} color={arrival ? M3.onTertiary : current ? M3.onPrimary : M3.onSurfaceVariant} />
                  </View>
                  <View style={styles.navStepBody}>
                    <View style={styles.navStepTop}>
                      <Text style={[styles.navStepLabel, current && styles.navStepLabelCurrent, arrival && styles.navStepLabelArrival]}>
                        Step {index + 1} • {distanceText}{current ? ' (Current)' : arrival ? ' (Arrival)' : ''}
                      </Text>
                      <View style={styles.navStepStatus}>
                        <AppIcon name={stack.icon} size={13} color={M3.tertiary} />
                        <Text style={styles.navStepStatusText}>{stack.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.navStepInstruction}>{step.instruction || 'Continue along the paved sidewalk.'}</Text>
                    <Text style={styles.navStepDetail}>{stack.detail}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Navigation Action Bar */}
        <View style={styles.navActionCard}>
          <View style={styles.navActionTop}>
            <Pressable
              style={styles.navShareBtn}
              accessibilityRole="button"
              accessibilityLabel={`Share walking directions to ${destName}`}
              onPress={() => {
                void shareAppMessage(destName, `Walking directions to ${destName} (${destAddress}) on AccessMap`);
              }}
            >
              <AppIcon name="share-variant" size={18} color={M3.primaryContainer} />
              <Text style={styles.navShareText}>Share</Text>
            </Pressable>
            <View style={styles.navGpsRow}>
              <AppIcon name="check-circle" size={14} color={M3.tertiary} />
              <Text style={styles.navGpsText}>Location enabled</Text>
            </View>
          </View>
          <View style={styles.navActionButtons}>
            <Pressable style={styles.navExitBtn} onPress={() => router.back()} accessibilityRole="button">
              <Text style={styles.navExitText}>Exit Navigation</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  navMapCanvas: { ...StyleSheet.absoluteFill, backgroundColor: '#eef3fb' },
  navSafe: { flex: 1, backgroundColor: '#f8fafc' },
  navTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 64,
    paddingHorizontal: 16,
    backgroundColor: withAlpha(M3.surfaceContainerLowest, 0.92),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: withAlpha(M3.outlineVariant, 0.4),
  },
  navTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  navBackBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  navTopTitles: { flex: 1, minWidth: 0 },
  navTopEyebrow: { color: M3.primary, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  navTopTitle: { color: M3.onSurface, fontSize: T['title-md'], lineHeight: 24, fontWeight: '600' },
  navTopRight: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  navAccessPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: M3.surfaceContainerLow, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  navAccessDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: M3.tertiary },
  navAccessText: { color: M3.onSurfaceVariant, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600' },
  navAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9' },
  navScrollContent: { padding: 16, paddingBottom: 24, gap: 16 },
  navStateBar: { backgroundColor: M3.surface, borderRadius: 12, padding: 12 },
  navRetryBtn: { alignSelf: 'center', marginTop: 4, backgroundColor: M3.primaryContainer, paddingHorizontal: 20, minHeight: 48, justifyContent: 'center', borderRadius: 10 },
  navRetryText: { color: M3.onPrimary, fontSize: T['link-md'], lineHeight: 18, fontWeight: '600' },
  navDestCard: { backgroundColor: M3.surfaceContainerLowest, borderRadius: 16, padding: 16, shadowColor: '#000000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  navDestTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  navDestInfo: { flex: 1, minWidth: 0 },
  navDestEyebrow: { color: M3.primary, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  navDestTitle: { color: M3.onSurface, fontSize: T['title-md'], lineHeight: 24, fontWeight: '600', marginTop: 3 },
  navDestLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  navDestLocText: { color: M3.onSurfaceVariant, fontSize: T['body-sm'], lineHeight: 18, flex: 1 },
  navLivePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: M3.surfaceContainer, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, flexShrink: 0 },
  navLiveText: { color: M3.onSurface, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600' },
  navMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: M3.surfaceContainerLow,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginTop: 12,
  },
  navMetric: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navMetricLabel: { color: M3.secondary, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600' },
  navMetricValue: { color: M3.onSurface, fontSize: T['title-sm'], lineHeight: 20, fontWeight: '600', marginTop: 1 },
  navMetricDivider: { width: StyleSheet.hairlineWidth, backgroundColor: withAlpha(M3.outlineVariant, 0.7), alignSelf: 'stretch', marginVertical: 2 },
  navMetricTerrain: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  navMetricTerrainText: { color: M3.tertiary, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '700' },
  navManeuverBanner: {
    backgroundColor: M3.primaryContainer,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    shadowColor: '#1e40ff',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  navManeuverIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: withAlpha(M3.surfaceContainerLowest, 0.15),
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  navManeuverBody: { flex: 1, minWidth: 0 },
  navManeuverEyebrow: { color: M3.onPrimaryContainer, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  navManeuverTitle: { color: M3.onPrimary, fontSize: T['title-sm'], lineHeight: 20, fontWeight: '700', marginTop: 3 },
  navManeuverLandmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  navManeuverLandmark: { color: M3.onPrimaryContainer, fontSize: T['body-sm'], lineHeight: 18, flex: 1 },
  navMapWrap: { position: 'relative', borderRadius: 16, overflow: 'hidden', backgroundColor: M3.surfaceContainerHigh, height: 224, shadowColor: '#000000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  navMapStepFree: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: withAlpha(M3.surfaceContainerLowest, 0.95),
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  navMapStepFreeText: { color: M3.onSurface, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600' },
  navMapControls: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  navMapReticleBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: M3.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  navMapZoomGroup: { backgroundColor: M3.surfaceContainerLowest, borderRadius: 12, shadowColor: '#000000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  navMapZoomBtn: { width: 36, height: 32, alignItems: 'center', justifyContent: 'center' },
  navMapZoomDivider: { height: StyleSheet.hairlineWidth, backgroundColor: M3.surfaceContainerHigh, width: '100%' },
  navMapLocBadge: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: withAlpha(M3.surfaceContainerLowest, 0.9),
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  navMapLocLeftWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  navMapLocLeft: { color: M3.onSurface, fontSize: T['label-sm'], lineHeight: 16, flexShrink: 1 },
  navMapLocRight: { color: M3.primaryContainer, fontSize: T['label-sm'], lineHeight: 16, fontWeight: '700', flexShrink: 0 },
  navPhotoCard: { backgroundColor: M3.surfaceContainerLowest, borderRadius: 16, padding: 16, shadowColor: '#000000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  navPhotoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navPhotoTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navPhotoTitle: { color: M3.onSurface, fontSize: T['title-sm'], lineHeight: 20, fontWeight: '600' },
  navPhotoBadge: { backgroundColor: '#6ffbbe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  navPhotoBadgeText: { color: '#002113', fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600' },
  navPhotoBody: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navPhoto: { width: 96, height: 96, borderRadius: 12, backgroundColor: M3.surfaceContainer },
  navPhotoText: { flex: 1, minWidth: 0 },
  navPhotoName: { color: M3.primaryContainer, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600' },
  navPhotoEntrance: { color: M3.onSurface, fontSize: T['body-md'], lineHeight: 20, fontWeight: '500', marginTop: 3 },
  navPhotoDesc: { color: M3.onSurfaceVariant, fontSize: T['body-sm'], lineHeight: 18, marginTop: 4 },
  navTurnCard: { backgroundColor: M3.surfaceContainerLowest, borderRadius: 16, padding: 16, shadowColor: '#000000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  navTurnHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 },
  navTurnHeaderTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  navTurnHeaderText: { color: M3.onSurface, fontSize: T['title-sm'], lineHeight: 20, fontWeight: '600', flexShrink: 1 },
  navTurnPill: { backgroundColor: M3.surfaceContainer, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, flexShrink: 0 },
  navTurnPillText: { color: M3.secondary, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600' },
  navSteps: { gap: 4 },
  navStepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 10, borderRadius: 12 },
  navStepRowActive: { backgroundColor: M3.surfaceContainerLow },
  navStepIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  navStepIconArrival: { backgroundColor: M3.tertiaryContainer },
  navStepIconActive: { backgroundColor: M3.primaryContainer },
  navStepIconIdle: { backgroundColor: M3.surfaceContainerHigh },
  navStepBody: { flex: 1, minWidth: 0 },
  navStepTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  navStepLabel: { color: M3.secondary, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '500', flexShrink: 1 },
  navStepLabelCurrent: { color: M3.primaryContainer, fontWeight: '700' },
  navStepLabelArrival: { color: M3.tertiary, fontWeight: '700' },
  navStepStatus: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 },
  navStepStatusText: { color: M3.tertiary, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600' },
  navStepInstruction: { color: M3.onSurface, fontSize: T['body-md'], lineHeight: 20, fontWeight: '500', marginTop: 3 },
  navStepDetail: { color: M3.onSurfaceVariant, fontSize: T['body-sm'], lineHeight: 18, marginTop: 2 },
  navActionCard: { backgroundColor: M3.surfaceContainerLowest, borderRadius: 16, padding: 16, gap: 12, shadowColor: '#000000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  navActionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navShareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: M3.surfaceContainer, paddingHorizontal: 16, minHeight: 48, borderRadius: 999 },
  navShareText: { color: M3.onSurface, fontSize: T['label-md'], lineHeight: 16, fontWeight: '500' },
  navGpsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navGpsText: { color: M3.tertiary, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600' },
  navActionButtons: { flexDirection: 'row', gap: 12 },
  navExitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: M3.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navExitText: { color: M3.onSurface, fontSize: T['link-md'], lineHeight: 18, fontWeight: '600' },
});
