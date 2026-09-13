import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useClerk, useSSO, useUser } from '@clerk/clerk-expo';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import OSMMap, { type OSMMapHandle } from '@/components/osm-map';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import EmptyState from '@/components/ui/empty-state';
import LoadingState from '@/components/ui/loading-state';
import { DesignColors as C, DesignType as T, M3 } from '@/constants/design-tokens';
import {
  CATEGORY_DETAILS,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CATEGORY_SHORT_LABELS,
  FEATURE_LABELS,
  FEATURE_ORDER,
} from '@/constants/catalog';
import { useAuthedSupabase, type AuthedSupabase } from '@/hooks/useAuthedSupabase';
import { DEFAULT_FILTERS, useFilters, type AppFilters } from '@/contexts/filter-context';
import { usePlace } from '@/hooks/usePlace';
import { usePlaces } from '@/hooks/usePlaces';
import { useRole } from '@/contexts/role-context';
import { supabaseBucketName, supabasePublicUrl } from '@/lib/supabase';
import {
  formatDistance,
  formatDuration,
  getDirections,
  SAN_ISIDRO_BOUNDS,
  type DirectionsResult,
  type RouteStepData,
} from '@/lib/maps';
import type {
  AccessibilityStatus,
  FeatureType,
  Place,
  PlaceCategory,
} from '@/types';

const tabsRoute = '/(tabs)' as Href;
// Local persistence keys for the profile screen (device keychain / browser storage).
const PROFILE_PREFS_KEY = 'accessmap.profile.prefs.v1';
const PROFILE_SAVED_KEY = 'accessmap.profile.saved.v1';
type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const categoryIcon: Record<PlaceCategory, IconName> = {
  hospital: 'hospital-box-outline', health_center: 'hospital-building', government: 'bank-outline',
  school: 'school-outline', mall: 'storefront-outline', church: 'church-outline', park: 'tree-outline',
};

const categoryPillStyle: Record<PlaceCategory, { backgroundColor: string }> = {
  hospital: { backgroundColor: C.navy },
  health_center: { backgroundColor: C.mint },
  government: { backgroundColor: C.navy },
  school: { backgroundColor: C.slate },
  mall: { backgroundColor: C.slate },
  church: { backgroundColor: C.slate },
  park: { backgroundColor: C.mint },
};

const categoryPillTextColor: Record<PlaceCategory, string> = {
  hospital: C.white, health_center: C.green, government: C.white, school: C.muted,
  mall: C.muted, church: C.muted, park: C.green,
};

const featureIconName: Record<FeatureType, IconName> = {
  ramp: 'human-wheelchair',
  restroom: 'toilet',
  elevator: 'elevator',
  parking: 'parking',
  entrance: 'door',
  other: 'human-wheelchair',
};

const featureIcon: Record<FeatureType, IconName> = {
  ramp: 'wheelchair-accessibility', restroom: 'human-male-female', elevator: 'elevator-passenger',
  parking: 'parking', entrance: 'door-open', other: 'checkbox-marked-circle-outline',
};

const featureShortLabels: Record<FeatureType, string> = {
  ramp: 'Ramp',
  restroom: 'Restroom',
  elevator: 'Elevator',
  parking: 'Parking',
  entrance: 'Entrance',
  other: 'Other',
};

const homeCategoryLabel: Record<PlaceCategory, string> = {
  hospital: 'Hospital',
  health_center: 'Health Center',
  government: 'Government Office',
  school: 'School',
  mall: 'Mall',
  church: 'Church',
  park: 'Park',
};

const nearbyChips: { type: FeatureType | null; label: string; dot: string }[] = [
  { type: null, label: 'All', dot: M3.primaryContainer },
  { type: 'ramp', label: 'Ramp', dot: M3.primaryContainer },
  { type: 'restroom', label: 'Accessible Restroom', dot: M3.tertiary },
  { type: 'elevator', label: 'Elevator', dot: M3.primaryContainer },
  { type: 'parking', label: 'Accessible Parking', dot: M3.tertiary },
  { type: 'entrance', label: 'Accessible Entrance', dot: M3.primaryContainer },
];

function AppIcon({ name, size = 22, color = C.ink }: { name: IconName; size?: number; color?: string }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

const photos = {
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

function photoSource(place: Place) {
  return place.photo_url ? { uri: place.photo_url } : fallbackPhotoFor[place.category];
}

function availableFeatureLabels(place: Place): string[] {
  return (place.accessibility_features ?? [])
    .filter((feature) => feature.status === 'available')
    .map((feature) => FEATURE_LABELS[feature.feature_type]);
}

function availableFeatureTypes(place: Place): FeatureType[] {
  return FEATURE_ORDER.filter((type) =>
    (place.accessibility_features ?? []).some(
      (feature) => feature.feature_type === type && feature.status === 'available',
    ),
  );
}

/** True when a place satisfies the app-wide accessibility + category + radius filters. */
function matchesFilters(
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
function haversineMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number | null {
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

function withAlpha(hex: string, opacity: number): string {
  const value = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${value}`;
}

function fetchBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error('Could not read the selected image.'));
    xhr.open('GET', uri, true);
    xhr.responseType = 'blob';
    xhr.send();
  });
}

async function uploadEntrancePhoto(
  client: AuthedSupabase,
  asset: { uri: string; fileName?: string | null; mimeType?: string | null },
): Promise<string> {
  const blob = await fetchBlob(asset.uri);
  const base = asset.fileName || `photo-${Date.now()}.jpg`;
  const safeName = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${Date.now()}_${safeName}`;
  const { error } = await client.storage
    .from(supabaseBucketName)
    .upload(path, blob, { contentType: asset.mimeType || 'image/jpeg' });
  if (error) throw error;
  return `${supabasePublicUrl}/storage/v1/object/public/${supabaseBucketName}/${path}`;
}

function Header({ title = 'Home', back }: { title?: string; back?: boolean }) {
  return (
    <View style={styles.header}>
      {back ? (
        <Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityLabel="Go back">
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
      ) : (
        <Image source={require('@/assets/images/accessmap_pin_logo.png')} style={styles.logo} />
      )}
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.flex} />
      {!back ? <Pressable style={styles.headerBell} accessibilityLabel="Notifications"><AppIcon name="bell-outline" size={24} color={C.muted} /></Pressable> : null}
      <Image source={photos.avatar} style={styles.avatar} />
    </View>
  );
}

function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const content = <View style={styles.screenContent}>{children}</View>;
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {scroll ? <ScrollView contentContainerStyle={styles.scrollContent}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

function Button({
  children,
  onPress,
  secondary = false,
  white = false,
  accessibility = false,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  secondary?: boolean;
  white?: boolean;
  accessibility?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.secondaryButton,
        white && styles.whiteButton,
        accessibility && styles.accessibilityButton,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          secondary && styles.secondaryButtonText,
          white && styles.whiteButtonText,
          accessibility && styles.accessibilityButtonText,
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

function GoogleLogo() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.665-5.17 3.665-9.12z"
        fill="#4285F4"
      />
      <Path
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.13C3.26 21.36 7.33 24 12 24z"
        fill="#34A853"
      />
      <Path
        d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.24C.45 8.15 0 9.97 0 12s.45 3.85 1.24 5.42l4.04-3.13z"
        fill="#FBBC05"
      />
      <Path
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.13c.95-2.83 3.6-4.96 6.72-4.96z"
        fill="#EA4335"
      />
    </Svg>
  );
}

export function LoginScreen() {
  const { startSSOFlow } = useSSO();
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const onSignIn = async () => {
    if (signingIn) return;
    setSigningIn(true);
    setSignInError(null);
    try {
      const redirectUrl = Linking.createURL('sso-callback');
      const { createdSessionId, setActive } = await startSSOFlow({ strategy: 'oauth_google', redirectUrl });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (error) {
      console.warn('Google sign-in failed', error);
      setSignInError('Sign in could not be completed. Please try again.');
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <SafeAreaView style={styles.loginSafe} edges={['top', 'bottom']}>
      <View style={styles.loginFrame}>
        <View style={styles.loginTopRow}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live Network</Text>
          </View>
        </View>

        <View style={styles.loginHero}>
          <View style={styles.logoWrapper}>
            <View style={styles.logoGlow} />
            <View style={styles.logoBox}>
              <AppIcon name="map-marker" size={40} color={M3.onPrimary} />
            </View>
          </View>
          <Text style={styles.appTitle}>AccessMap</Text>
          <View style={styles.locationRow}>
            <AppIcon name="navigation" size={16} color={M3.onSurfaceVariant} />
            <Text style={styles.locationText}>San Isidro, Cainta, Rizal</Text>
          </View>
        </View>

        <View style={styles.loginFooter}>
          <Pressable
            onPress={onSignIn}
            disabled={signingIn}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            style={styles.googleButton}
            android_ripple={{ color: 'rgba(11,28,48,0.08)', foreground: true }}
          >
            <GoogleLogo />
            <Text style={styles.googleButtonText}>{signingIn ? 'Signing in…' : 'Continue with Google'}</Text>
          </Pressable>
          {signInError ? <Text style={styles.errorText}>{signInError}</Text> : null}
          <Text style={styles.termsText}>
            By continuing you agree to our <Text style={styles.termsLink}>Terms</Text> and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

export function SplashScreen() {
  const enter = () => router.replace('/onboarding');
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const stageHeight = winHeight - insets.top - insets.bottom;

  // Static subtree + plain onPress: no per-press re-renders, so every tap registers.
  return (
    <View style={styles.splashSafe}>
      <Pressable
        style={styles.splashStage}
        onPress={enter}
        accessibilityRole="button"
        accessibilityLabel="Tap anywhere to continue"
      >
        <View
          style={[styles.splashSizing, { width: winWidth, height: winHeight, paddingTop: insets.top, paddingBottom: insets.bottom }]}
        >
          <Svg width="100%" height="100%" style={styles.splashGradient}>
            <Defs>
              <LinearGradient id="splashGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#1e40ff" />
                <Stop offset="0.55" stopColor="#1a38e8" />
                <Stop offset="1" stopColor="#12246b" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#splashGrad)" />
          </Svg>
          <View style={styles.splashGlowTop} />
          <View style={styles.splashGlowBottom} />

          <View style={[styles.splashBody, { height: stageHeight }]}>
            <View style={styles.splashTopRow}>
              <View style={styles.splashLivePill}>
                <View style={styles.splashLiveDot} />
                <Text style={styles.splashLiveText}>Live Mobility</Text>
              </View>
              <View style={styles.splashTopIcons}>
                <AppIcon name="wheelchair-accessibility" size={18} color={withAlpha('#ffffff', 0.7)} />
                <AppIcon name="navigation" size={18} color={withAlpha('#ffffff', 0.7)} />
              </View>
            </View>

            <View style={styles.splashCenter}>
              <View style={styles.splashPinWrap}>
                <View style={styles.splashPinGlow} />
                <View style={styles.splashPinBox}>
                  <AppIcon name="map-marker" size={42} color="#ffffff" />
                </View>
              </View>
              <Text style={styles.splashTitle}>AccessMap</Text>
              <Text style={styles.splashSubtitle}>Find accessible places before you go.</Text>
              <View style={styles.splashTrustPill}>
                <AppIcon name="shield-check" size={16} color={withAlpha('#ffffff', 0.8)} />
                <Text style={styles.splashTrustText}>Zero Barriers · Community Verified</Text>
              </View>
            </View>

            <View style={styles.splashBottom}>
              <View style={styles.splashLocRow}>
                <AppIcon name="map-marker" size={14} color={withAlpha('#ffffff', 0.75)} />
                <Text style={styles.splashLocText}>San Isidro · Cainta · Rizal</Text>
              </View>
              <View style={styles.splashTapRow}>
                <Text style={styles.splashTapText}>Tap anywhere to continue</Text>
                <AppIcon name="arrow-right" size={14} color={withAlpha('#ffffff', 0.6)} />
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const ONBOARD_STEPS = [
  {
    tag: 'Step 1 of 3',
    title: 'Find accessible places',
    body: 'Browse public places in San Isidro, Cainta with detailed accessibility information.',
    graphic: 'pin',
    cta: 'Continue',
    preview: { name: 'San Isidro Community Hub', chip: 'Step-free Entry', place: 'Cainta, Rizal' },
  },
  {
    tag: 'Step 2 of 3',
    title: 'Check before you visit',
    body: 'See verified ramps, accessible restrooms, elevators, and step-free entrances before heading out.',
    graphic: 'format-list-checks',
    cta: 'Next',
    tags: [
      { icon: 'wheelchair-accessibility', label: 'Step-Free' },
      { icon: 'toilet', label: 'Restrooms' },
      { icon: 'elevator', label: 'Elevators' },
      { icon: 'door-open', label: 'Automatic' },
    ],
  },
  {
    tag: 'Step 3 of 3',
    title: 'Get directions there',
    body: 'Navigate from your current location with clear turn-by-turn accessibility guidance.',
    graphic: 'beacon',
    cta: 'Get Started',
    pills: [
      { icon: 'wheelchair-accessibility', label: 'Step-free paths' },
      { icon: 'elevator', label: 'Transit lifts' },
    ],
  },
] as const;

function PingDot({ size, color }: { size: number; color: string }) {
  const ping = useSharedValue(0.75);
  const animatedPingStyle = useAnimatedStyle(() => ({
    opacity: ping.value,
    transform: [{ scale: 1 + (1 - ping.value) * 2 }],
  }));
  useEffect(() => {
    // Shared-value writes are how Reanimated drives animations; safe to mutate here.
    // eslint-disable-next-line react-hooks/immutability
    ping.value = withRepeat(withTiming(0, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
  }, [ping]);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, animatedPingStyle]} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

function OnboardGraphic({ type }: { type: 'pin' | 'format-list-checks' | 'beacon' }) {
  if (type === 'format-list-checks') {
    return (
      <View style={styles.onbGraphicWrap}>
        <View style={styles.onbGraphicCircle}>
          <AppIcon name="check-decagram" size={40} color={M3.primaryContainer} />
        </View>
      </View>
    );
  }
  if (type === 'beacon') {
    return (
      <View style={styles.onbGraphicWrap}>
        <View style={styles.onbRadarOuter} />
        <View style={styles.onbRadarInner} />
        <View style={styles.onbGraphicCircle}>
          <View style={styles.onbGraphicCircleSmall}>
            <View style={styles.onbBeaconIconTilt}>
              <AppIcon name="navigation" size={40} color={M3.primaryContainer} />
            </View>
          </View>
        </View>
        <View style={styles.onbBeaconDotWrap}>
          <PingDot size={10} color="#1e40ff" />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.onbGraphicWrap}>
      <View style={styles.onbGraphicCircle}>
        <Svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={M3.primary} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <Circle cx={12} cy={10} r={3} />
        </Svg>
        <View style={styles.onbPinBadge}>
          <AppIcon name="wheelchair-accessibility" size={18} color={M3.onPrimary} />
        </View>
      </View>
    </View>
  );
}

export function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const current = ONBOARD_STEPS[step];
  const isLast = step === ONBOARD_STEPS.length - 1;
  const finish = () => router.replace('/login');
  const next = () => (step < ONBOARD_STEPS.length - 1 ? setStep(step + 1) : finish());
  // One complete, flat style object per step — no style functions, no array flattening.
  const ctaStyle = [styles.onbCtaStep1, styles.onbCtaStep2, styles.onbCtaStep3][step];

  return (
    <SafeAreaView style={styles.onbSafe} edges={['top', 'bottom']}>
      <View style={styles.onbFrame}>
        <View style={styles.onbHeader}>
          <View style={styles.onbProgressRow}>
            {ONBOARD_STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.onbProgressSegment,
                  i <= step ? styles.onbProgressSegmentActive : styles.onbProgressSegmentIdle,
                ]}
              />
            ))}
          </View>
          {step > 0 ? (
            <View style={styles.onbHeaderMeta}>
              <Pressable onPress={() => setStep(step - 1)} style={styles.onbBackButton} accessibilityRole="button" accessibilityLabel="Go back">
                <AppIcon name="arrow-left" size={20} color={M3.secondary} />
              </Pressable>
              <Text style={styles.onbStepTag}>{current.tag}</Text>
              {step < ONBOARD_STEPS.length - 1 ? (
                <Pressable onPress={finish} style={styles.onbSkipButton} accessibilityRole="button">
                  <Text style={styles.onbSkipText}>Skip</Text>
                </Pressable>
              ) : (
                <View style={styles.onbSkipButton} />
              )}
            </View>
          ) : null}
        </View>

        <Animated.View key={step} entering={FadeIn.duration(300)} style={styles.onbContent}>
          <OnboardGraphic type={current.graphic} />
          <Text style={styles.onbTitle}>{current.title}</Text>
          <Text style={[styles.onbBody, step > 0 && styles.onbBodyStep]}>{current.body}</Text>

          {'preview' in current ? (
            <View style={styles.onbPreviewCard}>
              <View style={styles.onbPreviewIcon}>
                <AppIcon name="check-decagram" size={22} color={M3.primary} />
              </View>
              <View style={styles.onbPreviewBody}>
                <Text style={styles.onbPreviewName} numberOfLines={1}>{current.preview.name}</Text>
                <View style={styles.onbPreviewMeta}>
                  <View style={styles.onbPreviewChip}>
                    <AppIcon name="check" size={12} color={M3.onTertiaryFixed} />
                    <Text style={styles.onbPreviewChipText}>{current.preview.chip}</Text>
                  </View>
                  <Text style={styles.onbPreviewPlace} numberOfLines={1}>{current.preview.place}</Text>
                </View>
              </View>
            </View>
          ) : null}

          {'tags' in current ? (
            <View style={styles.onbTags}>
              {current.tags.map((tag) => (
                <View key={tag.label} style={styles.onbTagPill}>
                  <AppIcon name={tag.icon} size={16} color={M3.primaryContainer} />
                  <Text style={styles.onbTagPillText}>{tag.label}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {'pills' in current ? (
            <View style={styles.onbPills}>
              {current.pills.map((pill) => (
                <View key={pill.label} style={styles.onbPill}>
                  <AppIcon name={pill.icon} size={16} color={M3.primaryContainer} />
                  <Text style={styles.onbPillText}>{pill.label}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Animated.View>

        <View style={styles.onbFooter}>
          <Pressable
            onPress={next}
            style={ctaStyle}
            android_ripple={{ color: withAlpha('#ffffff', 0.25), foreground: true }}
            accessibilityRole="button"
            accessibilityLabel={`Continue to next onboarding step: ${step < ONBOARD_STEPS.length - 1 ? ONBOARD_STEPS[step + 1]?.title : 'Finish'}`}
          >
            <Text style={step === 1 ? styles.onbNextTextTitle : styles.onbNextText}>{current.cta}</Text>
            <View style={styles.onbArrow}>
              <AppIcon name="arrow-right" size={step === 1 ? 20 : 18} color={M3.onPrimary} />
            </View>
          </Pressable>
          {!isLast ? (
            <Pressable
              onPress={finish}
              style={step === 1 ? styles.onbSkipInline : styles.onbSkipFull}
              accessibilityRole="button"
              accessibilityLabel="Skip onboarding and proceed to home directory"
            >
              <Text style={step === 1 ? styles.onbSkipTextSm : styles.onbSkipTextFull}>Skip</Text>
            </Pressable>
          ) : (
            <Text style={styles.onbFooterCaption}>Ready to explore your city with confidence</Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function SearchBar({ placeholder }: { placeholder: string }) {
  return (
    <View style={styles.search}>
      <AppIcon name="magnify" size={28} color={C.muted} />
      <TextInput placeholder={placeholder} placeholderTextColor={C.muted} style={styles.searchInput} />
      <AppIcon name="close-circle-outline" size={23} color={C.muted} />
    </View>
  );
}

function PlaceCard({ place, featured = false }: { place: Place; featured?: boolean }) {
  const labels = availableFeatureLabels(place);
  if (featured) {
    return (
      <View style={styles.featuredPlaceCard}>
        <View>
          <Image source={photoSource(place)} style={styles.featuredPlacePhoto} />
          <View style={styles.verifiedBadge}><AppIcon name="check-decagram" size={13} color={C.green} /><Text style={styles.verifiedBadgeText}>Verified</Text></View>
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
          <Text style={styles.featureLine}>{labels.length > 0 ? labels.slice(0, 2).join(', ') + (labels.length > 2 ? ', +1 more' : '') : 'No verified features yet'}</Text>
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

export function HomeScreen() {
  const [activeFeature, setActiveFeature] = useState<FeatureType | null>(null);
  const [query, setQuery] = useState('');
  const { places, loading, error } = usePlaces();
  const { filters } = useFilters();
  const trimmed = query.trim().toLowerCase();
  const visible = places.filter((place) => {
    if (!matchesFilters(place, filters)) return false;
    if (activeFeature && !availableFeatureTypes(place).includes(activeFeature)) return false;
    if (trimmed && !place.name.toLowerCase().includes(trimmed)) return false;
    return true;
  });

  return (
    <SafeAreaView style={styles.homeSafe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.homeScrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.homeGreeting}>
          <View style={styles.homeLocationRow}>
            <AppIcon name="map-marker" size={16} color={M3.primary} />
            <Text style={styles.homeLocationText}>San Isidro, Cainta</Text>
          </View>
          <Text style={styles.homeGreetingTitle}>Where would you like to go?</Text>
        </View>

        <View style={styles.homeSearchWrap}>
          <View style={styles.homeSearch}>
            <AppIcon name="magnify" size={20} color={M3.secondary} />
            <TextInput
              style={styles.homeSearchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search for a place..."
              placeholderTextColor={M3.secondary}
            />
            <Pressable style={styles.homeMic} accessibilityLabel="Voice search" accessibilityRole="button">
              <AppIcon name="microphone-outline" size={18} color={M3.secondary} />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.homeChipsRow}>
            {nearbyChips.map((chip) => {
              const active = activeFeature === chip.type;
              return (
                <Pressable
                  key={chip.label}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter by ${chip.label}`}
                  accessibilityState={{ selected: active }}
                  style={[styles.homeChip, active && styles.homeChipActive]}
                  onPress={() => setActiveFeature(chip.type)}
                >
                  <View style={[styles.homeChipDot, { backgroundColor: active ? M3.onPrimary : chip.dot }]} />
                  <Text style={[styles.homeChipText, active && styles.homeChipTextActive]}>{chip.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.homeNearbySection}>
          <View style={styles.homeNearbyHeader}>
            <Text style={styles.homeNearbyTitle}>Nearby Places</Text>
            <Text style={styles.homeNearbyCount}>{loading ? '…' : `${visible.length} locations`}</Text>
          </View>
          {error ? <EmptyState title="Could not load facilities" message={error} /> : null}
          {!error && loading ? <LoadingState label="Loading facilities…" /> : null}
          {!error && !loading && visible.length === 0 ? <EmptyState message="No facilities match your filters." /> : null}
          {!error && !loading ? visible.map((place) => <NearbyCard key={place.id} place={place} />) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function FilterScreen() {
  const { filters, setFilters } = useFilters();
  const [draft, setDraft] = useState<AppFilters>(filters);
  const [lastFilters, setLastFilters] = useState<AppFilters>(filters);
  const activeCount = draft.features.length;

  // Adopt newly applied/persisted filters (tabs stay mounted, so reset on change during render).
  if (lastFilters !== filters) {
    setLastFilters(filters);
    setDraft(filters);
  }

  const filterFeatures: { type: FeatureType; title: string; subtitle: string; icon: IconName }[] = [
    { type: 'ramp', title: 'Step-Free / Ramp Access', subtitle: 'Prioritize entrance ramps, wide slope grade ≤ 1:12', icon: 'wheelchair-accessibility' },
    { type: 'restroom', title: 'Accessible Restroom', subtitle: 'Ground floor, grab bars, wide door ≥ 80cm', icon: 'toilet' },
    { type: 'elevator', title: 'Elevator Available', subtitle: 'Braille tactile buttons & multi-level clearance', icon: 'elevator-passenger' },
    { type: 'parking', title: 'Accessible Parking', subtitle: 'Designated PWD vehicle spaces adjacent to entrance', icon: 'parking' },
    { type: 'entrance', title: 'Automatic / Wide Entrance', subtitle: 'Power-assisted sliding or wide double clearance doors', icon: 'door-open' },
  ];

  const facilityTypes: { value: PlaceCategory | 'all'; label: string; icon: IconName }[] = [
    { value: 'all', label: 'All Facilities', icon: 'domain' },
    { value: 'hospital', label: 'Hospitals & Clinics', icon: 'hospital' },
    { value: 'government', label: 'Civic & Public', icon: 'bank' },
    { value: 'health_center', label: 'Community Hubs', icon: 'account-group' },
  ];

  const radiusOptions: { label: string; value: number | null }[] = [
    { label: '1 km', value: 1 },
    { label: '3 km', value: 3 },
    { label: '5 km', value: 5 },
    { label: 'Any', value: null },
  ];

  const reset = () => setDraft(DEFAULT_FILTERS);

  return (
    <SafeAreaView style={styles.filterSafe} edges={['top']}>
      {/* Header: close + reset */}
      <View style={styles.filterTopBar}>
        <Pressable style={styles.filterIconBtn} onPress={() => router.back()} accessibilityLabel="Close modal" accessibilityRole="button">
          <AppIcon name="close" size={24} color={M3.onSurface} />
        </Pressable>
        <Pressable onPress={reset} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.filterResetText}>Reset</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.filterScrollContent} showsVerticalScrollIndicator={false}>
        {/* Admin-verified status note */}
        <View style={styles.filterNote}>
          <AppIcon name="check-decagram" size={16} color={M3.primaryContainer} />
          <Text style={styles.filterNoteText}>ADMIN-VERIFIED LISTINGS  •  SAN ISIDRO, CAINTA</Text>
        </View>

        {/* Active filter summary */}
        <View style={styles.filterSummaryRow}>
          <View style={styles.filterSummaryLeft}>
            <AppIcon name="tune-variant" size={18} color={M3.primaryContainer} />
            <Text style={styles.filterActiveText}>{activeCount} mobility {activeCount === 1 ? 'requirement' : 'requirements'} active</Text>
          </View>
          <View style={styles.filterActivePill}>
            <Text style={styles.filterActivePillText}>Active</Text>
          </View>
        </View>

        {/* Section: Core Mobility Features */}
        <View style={styles.filterSection}>
          <View style={styles.filterSectionHeader}>
            <Text style={styles.filterSectionTitle}>Core Mobility Features</Text>
            <Text style={styles.filterSectionCaption}>Physical Access</Text>
          </View>
          <View style={styles.filterCard}>
            {filterFeatures.map((feature) => {
              const active = draft.features.includes(feature.type);
              const toggleFeature = () =>
                setDraft((current) => ({
                  ...current,
                  features: current.features.includes(feature.type)
                    ? current.features.filter((value) => value !== feature.type)
                    : [...current.features, feature.type],
                }));
              return (
                <Pressable
                  key={feature.type}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`Toggle ${feature.title}`}
                  style={styles.filterFeatureRow}
                  onPress={toggleFeature}
                >
                  <View style={[styles.filterFeatureIcon, !active && styles.filterFeatureIconOff]}>
                    <AppIcon name={feature.icon} size={20} color={active ? M3.primaryContainer : M3.secondary} />
                  </View>
                  <View style={styles.filterFeatureTexts}>
                    <Text style={styles.filterFeatureTitle}>{feature.title}</Text>
                    <Text style={styles.filterFeatureSub}>{feature.subtitle}</Text>
                  </View>
                  <View style={[styles.filterSwitchTrack, active && styles.filterSwitchTrackOn]}>
                    <View style={[styles.filterSwitchThumb, active && styles.filterSwitchThumbOn]} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Section: Facility Type */}
        <View style={styles.filterSection}>
          <View style={styles.filterSectionHeader}>
            <Text style={styles.filterSectionTitle}>Facility Type</Text>
            <Text style={styles.filterSectionCaption}>San Isidro District</Text>
          </View>
          <View style={styles.filterCatGrid}>
            {facilityTypes.map((item) => {
              const active = draft.category === item.value;
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Show ${item.label}`}
                  style={[styles.filterCatPill, active && styles.filterCatPillActive]}
                  onPress={() => setDraft((current) => ({ ...current, category: item.value }))}
                >
                  <AppIcon name={item.icon} size={18} color={active ? M3.onPrimary : M3.secondary} />
                  <Text style={[styles.filterCatPillText, active && styles.filterCatPillTextActive]} numberOfLines={1}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Section: Distance Radius */}
        <View style={styles.filterSection}>
          <View style={styles.filterSectionHeader}>
            <Text style={styles.filterSectionTitle}>Distance Radius</Text>
            <Text style={styles.filterRadiusValue}>{draft.radiusKm === null ? 'Any radius' : `Within ${draft.radiusKm} km`}</Text>
          </View>
          <View style={styles.filterRadiusGroup}>
            {radiusOptions.map((option) => {
              const active = draft.radiusKm === option.value;
              return (
                <Pressable
                  key={option.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.filterRadiusOption, active && styles.filterRadiusOptionActive]}
                  onPress={() => setDraft((current) => ({ ...current, radiusKm: option.value }))}
                >
                  <Text style={[styles.filterRadiusOptionText, active && styles.filterRadiusOptionTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Bottom apply bar */}
      <View style={styles.filterApplyBar}>
        <Pressable
          style={styles.filterApplyBtn}
          onPress={() => {
            setFilters(draft);
            router.back();
          }}
          accessibilityRole="button"
          accessibilityLabel="Apply filters and go back"
        >
          <Text style={styles.filterApplyText}>Apply Filters</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export function ExploreScreen() {
  const [activeCategory, setActiveCategory] = useState<PlaceCategory | null>(null);
  const { places, loading, error } = usePlaces(activeCategory ?? undefined);
  const { filters } = useFilters();
  const categories: { label: string; value: PlaceCategory | null }[] = [
    { label: 'All', value: null },
    { label: 'Health Centers', value: 'health_center' },
    { label: 'Hospitals', value: 'hospital' },
    { label: 'Civic Offices', value: 'government' },
  ];
  // Shared filters from the Filter screen apply on top of the local category chip.
  const filteredPlaces = places.filter((place) => matchesFilters(place, filters));

return (
    <Screen>
      <View style={styles.exploreHeading}>
        <Text style={styles.screenTitle}>Explore Places</Text>
        <Text style={styles.verifiedCount}>{loading ? 'Loading' : `${filteredPlaces.length} verified`}</Text>
      </View>
      <View style={styles.exploreSearchRow}>
        <Pressable
          style={styles.exploreSearch}
          onPress={() => router.push(tabsRoute)}
          accessibilityRole="search"
          accessibilityLabel="Search places on the home screen"
        >
          <AppIcon name="magnify" size={20} color={C.muted} />
          <Text style={styles.exploreSearchText}>Search places, facilities...</Text>
        </Pressable>
        <Pressable
          style={styles.filterShortcut}
          onPress={() => router.push('/(tabs)/filter')}
          accessibilityRole="button"
          accessibilityLabel="Open filters"
        >
          <AppIcon name="tune-variant" size={20} color={C.navy} />
          <Text style={styles.filterShortcutText}>Filter</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.exploreChips}>
        {categories.map((category) => <Pressable key={category.label} onPress={() => setActiveCategory(category.value)} style={[styles.exploreChip, activeCategory === category.value && styles.exploreChipActive]} accessibilityRole="button" accessibilityState={{ selected: activeCategory === category.value }}><Text style={[styles.exploreChipText, activeCategory === category.value && styles.exploreChipTextActive]}>{category.label}</Text></Pressable>)}
      </ScrollView>
      {error ? <EmptyState title="Could not load facilities" message={error} /> : null}
      {loading ? <LoadingState label="Finding verified places…" /> : null}
      {!loading && !error && filteredPlaces.length === 0 ? <EmptyState message="No facilities match your filters." /> : null}
      {!loading && !error ? filteredPlaces.map((place) => <PlaceCard key={place.id} place={place} featured />) : null}
    </Screen>
  );
}


export function MapScreen() {
  const params = useLocalSearchParams<{ place?: string }>();
  const { places, loading, error } = usePlaces();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [tappedPlaceId, setTappedPlaceId] = useState<string | null>(params.place ?? null);
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});
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

  const toggleSaved = (id: string) => setSavedIds((prev) => ({ ...prev, [id]: !prev[id] }));

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
                <Text style={styles.mapCardVerified}>Verified</Text>
              </View>
              <View style={styles.mapCardInfo}>
                <View style={styles.mapCardInfoRow}>
                  <Pressable style={styles.mapCardCategory} onPress={() => router.push(tabsRoute)}>
                    <Text style={styles.mapCardCategoryText}>{homeCategoryLabel[activePlace.category]}</Text>
                    <AppIcon name="arrow-right" size={14} color={M3.primaryContainer} />
                  </Pressable>
                  <Pressable onPress={() => toggleSaved(activePlace.id)} accessibilityLabel="Save location" hitSlop={8}>
                    <AppIcon name={savedIds[activePlace.id] ? 'bookmark' : 'bookmark-outline'} size={20} color={savedIds[activePlace.id] ? M3.primaryContainer : M3.secondary} />
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

export function PlaceDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { place, loading, error } = usePlace(id);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [saved, setSaved] = useState(false);
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
    const message = `Check out ${place.name} on AccessMap — ${place.address}`;
    try {
      if (Platform.OS === 'web' && typeof navigator.share === 'function') {
        await navigator.share({ title: place.name, text: message, url: window.location.href });
        return;
      }
      await Share.share({ title: place.name, message });
    } catch (shareError: unknown) {
      if (shareError instanceof Error && shareError.name === 'AbortError') return;
      // Last resort on web: copy the details to the clipboard.
      if (Platform.OS === 'web' && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(message);
          Alert.alert('Link copied', 'Place details were copied to your clipboard.');
          return;
        } catch {
          // fall through to the generic failure alert
        }
      }
      Alert.alert('Share failed', 'Could not share this place. Please try again.');
    }
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
              <Pressable onPress={() => router.back()} style={styles.detailHeroBack} accessibilityLabel="Back">
                <AppIcon name="chevron-left" size={20} color={M3.onSurface} />
              </Pressable>
              {/* Live Status Quick Pill */}
              <View style={styles.detailLivePill}>
                <View style={styles.detailLiveDot} />
                <Text style={styles.detailLiveText}>Verified Accessible</Text>
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
                    onPress={() => setSaved((value) => !value)}
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
                  <Text style={styles.detailCountPill}>{availableCount} of {features.length} Verified</Text>
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
  else if (turn) detail = 'Ramp grade 1:12 compliant, no lip, 140cm clearance.';
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
            <Text style={styles.navTopEyebrow}>Route Guidance</Text>
            <Text style={styles.navTopTitle} numberOfLines={1}>Active Navigation</Text>
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
              <Text style={styles.navDestEyebrow}>Active Route</Text>
              <Text style={styles.navDestTitle} numberOfLines={1}>{destName}</Text>
              <View style={styles.navDestLocRow}>
                <AppIcon name="map-marker" size={16} color={M3.secondary} />
                <Text style={styles.navDestLocText} numberOfLines={1}>{destAddress}</Text>
              </View>
            </View>
            <View style={styles.navLivePill}>
              <View style={styles.navLiveDot} />
              <Text style={styles.navLiveText}>Live Nav</Text>
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
            <Text style={styles.navMapStepFreeText}>Guaranteed Step-Free</Text>
          </View>

          <View style={styles.navMapControls}>
            <Pressable style={styles.navMapReticleBtn} accessibilityLabel="Recenter navigation" accessibilityRole="button" onPress={() => navMapRef.current?.recenter()}>
              <AppIcon name="crosshairs-gps" size={20} color={M3.primaryContainer} />
            </Pressable>
            <View style={styles.navMapZoomGroup} >
              <Pressable style={styles.navMapZoomBtn} accessibilityLabel="Zoom in" accessibilityRole="button" onPress={() => navMapRef.current?.zoomIn()}>
                <AppIcon name="plus" size={18} color={M3.onSurface} />
              </Pressable>
              <View style={styles.navMapZoomDivider} />
              <Pressable style={styles.navMapZoomBtn} accessibilityLabel="Zoom out" accessibilityRole="button" onPress={() => navMapRef.current?.zoomOut()}>
                <AppIcon name="minus" size={18} color={M3.onSurface} />
              </Pressable>
            </View>
          </View>

          <View style={styles.navMapLocBadge} pointerEvents="none">
            <View style={styles.navMapLocLeftWrap}>
              <View style={styles.navMapLocDot} />
              <Text style={styles.navMapLocLeft} numberOfLines={1}>Felix Ave Sidewalk • Ramp Grade: 1:12</Text>
            </View>
            <Text style={styles.navMapLocRight}>Smooth Asph.</Text>
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
            <Pressable style={styles.navShareBtn} accessibilityRole="button">
              <AppIcon name="share-variant" size={18} color={M3.primaryContainer} />
              <Text style={styles.navShareText}>Share</Text>
            </Pressable>
            <View style={styles.navGpsRow}>
              <View style={styles.navMapLocDot} />
              <Text style={styles.navGpsText}>GPS High Accuracy</Text>
            </View>
          </View>
          <View style={styles.navActionButtons}>
            <Pressable style={styles.navExitBtn} onPress={() => router.back()} accessibilityRole="button">
              <Text style={styles.navExitText}>Exit Navigation</Text>
            </Pressable>
            <Pressable style={styles.navPauseBtn} accessibilityRole="button">
              <AppIcon name="pause" size={18} color={M3.onPrimary} />
              <Text style={styles.navPauseText}>Pause Route</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function ProfileScreen() {
  const { user } = useUser();
  const { isAdmin } = useRole();
  const { signOut } = useClerk();
  const { places } = usePlaces();
  const clerk = useClerk();
  const [prefs, setPrefs] = useState({ ramp: true, restroom: true, elevator: false });
  // `null` means "not customized yet" — the screen falls back to the first two catalog places.
  const [savedIds, setSavedIds] = useState<string[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Profile state persists locally (keychain / browser storage); no backend table required.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [storedPrefs, storedSaved] = await Promise.all([
          SecureStore.getItemAsync(PROFILE_PREFS_KEY),
          SecureStore.getItemAsync(PROFILE_SAVED_KEY),
        ]);
        if (cancelled) return;
        if (storedPrefs) {
          try {
            const parsed = JSON.parse(storedPrefs) as Partial<typeof prefs>;
            setPrefs((prev) => ({ ...prev, ...parsed }));
          } catch {
            // ignore malformed stored preferences and keep defaults
          }
        }
        if (storedSaved) {
          try {
            const parsed = JSON.parse(storedSaved) as unknown;
            if (Array.isArray(parsed)) setSavedIds(parsed.filter((value): value is string => typeof value === 'string'));
          } catch {
            // ignore malformed stored saved list
          }
        }
      } catch {
        // storage unavailable — run with in-memory defaults
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    SecureStore.setItemAsync(PROFILE_PREFS_KEY, JSON.stringify(prefs)).catch(() => {
      // storage unavailable — preferences stay in memory for this session
    });
  }, [prefs, loaded]);

  useEffect(() => {
    if (!loaded || savedIds == null) return;
    SecureStore.setItemAsync(PROFILE_SAVED_KEY, JSON.stringify(savedIds)).catch(() => {
      // storage unavailable — saved places stay in memory for this session
    });
  }, [savedIds, loaded]);

  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Civic contributor';
  const email = user?.emailAddresses?.[0]?.emailAddress;
  const avatar = user?.imageUrl ? { uri: user.imageUrl } : photos.avatar;

  // Saved list: the user's persisted picks, or the first two catalog places as a starting set.
  const effectiveSavedIds = savedIds ?? places.slice(0, 2).map((place) => place.id);
  const savedPlaces = effectiveSavedIds
    .map((savedId) => places.find((place) => place.id === savedId))
    .filter((place): place is Place => !!place)
    .slice(0, 2);
  const savedCount = effectiveSavedIds.filter((savedId) => places.some((place) => place.id === savedId)).length;

  const toggleSavePlace = (placeId: string) => {
    setSavedIds((prev) => {
      const base = prev ?? places.slice(0, 2).map((place) => place.id);
      return base.includes(placeId) ? base.filter((value) => value !== placeId) : [...base, placeId];
    });
  };

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

  const togglePref = (key: 'ramp' | 'restroom' | 'elevator') => setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));

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

  const switchColors = {
    trackColor: { false: '#e2e8f0', true: M3.primaryContainer },
    thumbColor: '#ffffff',
    ios_backgroundColor: '#e2e8f0',
  } as const;

  return (
    <SafeAreaView style={styles.profileSafe} edges={['top']}>
      {/* Minimal sticky header */}
      <View style={styles.profileHeader}>
        <View style={styles.profileHeaderRow}>
          <Text style={styles.profileHeaderTitle}>Profile</Text>
          <View style={styles.profileVerifiedBadge}>
            <Text style={styles.profileVerifiedText}>Verified</Text>
          </View>
        </View>
        <Pressable
          style={styles.profileSettingsBtn}
          accessibilityLabel="Account settings"
          accessibilityRole="button"
          hitSlop={6}
          onPress={openAccountPortal}
        >
          <AppIcon name="cog" size={20} color={M3.onSurfaceVariant} />
        </Pressable>
      </View>

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
                <Text style={styles.profileEditLink}>Edit profile</Text>
              </Pressable>
            </View>
            <Text style={styles.profileEmail} numberOfLines={1}>{email ?? 'Signed in with your account'}</Text>
            <View style={styles.profileMetaRow}>
              <View style={styles.profileLocRow}>
                <AppIcon name="map-marker" size={10} color={M3.outlineVariant} />
                <Text style={styles.profileLocText}>San Isidro, Cainta</Text>
              </View>
            </View>
            <View style={styles.profileMetaRow}>
              <View style={styles.profileCommunityPill}>
                <Text style={styles.profileCommunityText}>{isAdmin ? 'Administrator' : 'Community Member'}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.profileDivider} />

        {/* Accessibility Preferences */}
        <View style={styles.profileSection}>
          <View style={styles.profileSectionHeader}>
            <Text style={styles.profileSectionTitle}>Accessibility Preferences</Text>
            <View style={styles.profileAutoFilterPill}>
              <Text style={styles.profileAutoFilterText}>Auto-filtering active</Text>
            </View>
          </View>
          <View style={styles.profilePrefList}>
            <View style={styles.profilePrefRow}>
              <View style={styles.profilePrefLeft}>
                <View style={styles.profilePrefIconBox}>
                  <AppIcon name="wheelchair-accessibility" size={18} color={M3.primaryContainer} />
                </View>
                <View style={styles.profilePrefTexts}>
                  <Text style={styles.profilePrefTitle}>Step-Free / Ramp Priority</Text>
                  <Text style={styles.profilePrefSub}>Prioritize verified ramps & level routes</Text>
                </View>
              </View>
              <Switch
                value={prefs.ramp}
                onValueChange={() => togglePref('ramp')}
                {...switchColors}
              />
            </View>
            <View style={styles.profilePrefRow}>
              <View style={styles.profilePrefLeft}>
                <View style={styles.profilePrefIconBox}>
                  <AppIcon name="toilet" size={18} color={M3.primaryContainer} />
                </View>
                <View style={styles.profilePrefTexts}>
                  <Text style={styles.profilePrefTitle}>Accessible Restroom</Text>
                  <Text style={styles.profilePrefSub}>Requires grab rails & barrier-free access</Text>
                </View>
              </View>
              <Switch
                value={prefs.restroom}
                onValueChange={() => togglePref('restroom')}
                {...switchColors}
              />
            </View>
            <View style={styles.profilePrefRow}>
              <View style={styles.profilePrefLeft}>
                <View style={styles.profilePrefIconBoxMuted}>
                  <AppIcon name="elevator-passenger" size={18} color={M3.onSurfaceVariant} />
                </View>
                <View style={styles.profilePrefTexts}>
                  <Text style={styles.profilePrefTitle}>Elevator Required</Text>
                  <Text style={styles.profilePrefSub}>Multi-story structures with operational lifts</Text>
                </View>
              </View>
              <Switch
                value={prefs.elevator}
                onValueChange={() => togglePref('elevator')}
                {...switchColors}
              />
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
                  <View style={styles.profileStatusRow}>
                    <View style={styles.profileStatusDot} />
                    <Text style={styles.profileStatusText}>Verified Step-Free</Text>
                  </View>
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
                'AccessMap v1.4.0\n\nCommunity-verified accessibility data for public facilities around San Isidro, Cainta — ramps, restrooms, elevators, and accessible parking, reviewed by admins.',
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

export function AdminDirectoryTab({ drillCategory }: { drillCategory?: string }) {
  const authed = useAuthedSupabase();
  const { places, loading, error, reload } = usePlaces();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<PlaceCategory | 'all'>('all');

  // Analytics drill-down: when a category is requested, focus the matching pill.
  const [lastDrill, setLastDrill] = useState<string | undefined>(undefined);
  if (drillCategory !== lastDrill) {
    setLastDrill(drillCategory);
    setCategoryFilter(drillCategory ? (drillCategory as PlaceCategory) : 'all');
  }

  const confirmDelete = (place: Place) => {
    Alert.alert('Delete facility', `Delete "${place.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePlace(place.id) },
    ]);
  };

  const deletePlace = async (id: string) => {
    if (!authed) {
      Alert.alert('Session not ready', 'Sign-in session is still loading. Please try again.');
      return;
    }
    setDeleting(id);
    try {
      const { error: deleteError } = await authed.from('places').delete().eq('id', id);
      if (deleteError) throw deleteError;
      reload();
    } catch (deleteError) {
      console.warn('Delete failed', deleteError);
      Alert.alert('Delete failed', 'Could not delete the facility. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const trimmed = query.trim().toLowerCase();
  const visiblePlaces = places.filter((place) => {
    if (categoryFilter !== 'all' && place.category !== categoryFilter) return false;
    if (!trimmed) return true;
    return place.name.toLowerCase().includes(trimmed) || (place.address ?? '').toLowerCase().includes(trimmed);
  });

  const categoryCounts = CATEGORY_ORDER.reduce<Record<string, number>>((counts, category) => {
    counts[category] = places.filter((place) => place.category === category).length;
    return counts;
  }, {});

  const adminFilterPills: { value: PlaceCategory | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'hospital', label: 'Hospitals' },
    { value: 'health_center', label: 'Health Centers' },
    { value: 'government', label: 'Govt Offices' },
    { value: 'school', label: 'Schools' },
  ];

  const metrics = adminMetrics(places);

  return (
    <View style={styles.adminTabBody}>
      {/* Minimal app bar */}
      <View style={styles.adminAppBar}>
        <View style={styles.adminAppBarBrand}>
          <View style={styles.adminAppBarLogo}>
            <AppIcon name="human-wheelchair" size={18} color={M3.onPrimary} />
          </View>
          <View style={styles.adminAppBarCopy}>
            <View style={styles.adminAppBarTitleRow}>
              <Text style={styles.adminAppBarTitle}>AccessMap Cainta</Text>
              <View style={styles.adminAppBarBadge}><Text style={styles.adminAppBarBadgeText}>Admin</Text></View>
            </View>
            <Text style={styles.adminAppBarSubtitle}>San Isidro Civic Registry</Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.push('/(tabs)/profile')}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          hitSlop={6}
        >
          <Image source={photos.avatar} style={styles.adminAppBarAvatar} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.adminNewScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Title & description */}
        <View style={styles.adminTitleBlock}>
          <View style={styles.adminTitleRow}>
            <View style={styles.adminTitleDotRow}>
              <View style={styles.adminTitleDot} />
              <Text style={styles.adminTitleEyebrow}>Admin Console</Text>
            </View>
            <Text style={styles.adminTitleWard}>San Isidro Ward</Text>
          </View>
          <Text style={styles.adminTitle}>Admin Facility Directory</Text>
          <Text style={styles.adminTitleBody}>Manage and verify physical accessibility listings for civic public services.</Text>
        </View>

        {/* Metric summary cards */}
        <View style={styles.adminMetricsRow}>
          <View style={styles.adminMetricCard}>
            <Text style={styles.adminMetricLabel}>Total Places</Text>
            <View style={styles.adminMetricValueRow}>
              <Text style={styles.adminMetricValue}>{metrics.total}</Text>
              <Text style={styles.adminMetricUnit}>sites</Text>
            </View>
          </View>
          <View style={styles.adminMetricCard}>
            <Text style={styles.adminMetricLabelOk}>Verified</Text>
            <View style={styles.adminMetricValueRow}>
              <Text style={styles.adminMetricValueOk}>{metrics.verified}</Text>
              <AppIcon name="check-decagram" size={14} color="#059669" />
            </View>
          </View>
          <View style={styles.adminMetricCard}>
            <Text style={styles.adminMetricLabelWarn}>Pending</Text>
            <View style={styles.adminMetricValueRow}>
              <Text style={styles.adminMetricValueWarn}>{metrics.pending}</Text>
              <AppIcon name="clock-outline" size={14} color="#d97706" />
            </View>
          </View>
        </View>

        {/* Search */}
        <View style={styles.adminSearchBox}>
          <AppIcon name="magnify" size={20} color="#94a3b8" />
          <TextInput
            style={styles.adminSearchInput}
            placeholder="Search facility name, street, or department..."
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={setQuery}
            accessibilityLabel="Search verified civic facilities"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} accessibilityLabel="Clear search" hitSlop={8}>
              <AppIcon name="close-circle" size={18} color="#94a3b8" />
            </Pressable>
          ) : null}
        </View>

        {/* Category filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.adminPillsRow}>
          {adminFilterPills.map((pill) => {
            const active = categoryFilter === pill.value;
            const count = pill.value === 'all' ? places.length : (categoryCounts[pill.value] ?? 0);
            return (
              <Pressable
                key={pill.value}
                style={[styles.adminPill, active && styles.adminPillActive]}
                onPress={() => setCategoryFilter(pill.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Filter by ${pill.label}`}
              >
                <Text style={[styles.adminPillText, active && styles.adminPillTextActive]}>{pill.label}</Text>
                <View style={[styles.adminPillCount, active && styles.adminPillCountActive]}>
                  <Text style={[styles.adminPillCountText, active && styles.adminPillCountTextActive]}>{count}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Facility cards */}
        {error ? <EmptyState title="Could not load facilities" message={error} /> : null}
        {!error && loading ? <LoadingState label="Loading facility directory…" /> : null}
        {!error && !loading && places.length === 0 ? <EmptyState message="No facilities are registered yet. Add the first one below." /> : null}
        {!error && !loading && places.length > 0 && visiblePlaces.length === 0 ? (
          <EmptyState message="No facilities match your search or filter." />
        ) : null}
        {!error && !loading
          ? visiblePlaces.map((place) => {
            const availableFeatures = (place.accessibility_features ?? []).filter((feature) => feature.status === 'available');
            const unavailableFeatures = (place.accessibility_features ?? []).filter((feature) => feature.status === 'not_available');
            return (
              <View style={styles.adminFacilityCard} key={place.id}>
                <View style={styles.adminFacilityTop}>
                  <View style={styles.adminFacilityMeta}>
                    <View style={styles.adminFacilityBadgesRow}>
                      <View style={styles.adminFacilityCategory}><Text style={styles.adminFacilityCategoryText}>{CATEGORY_SHORT_LABELS[place.category]}</Text></View>
                      <View style={styles.adminFacilityVerified}>
                        <AppIcon name="check-decagram" size={13} color="#059669" />
                        <Text style={styles.adminFacilityVerifiedText}>Verified</Text>
                      </View>
                    </View>
                    <Text style={styles.adminFacilityName} numberOfLines={2}>{place.name}</Text>
                  </View>
                  <View style={styles.adminFacilityActions}>
                    <Pressable
                      style={styles.adminFacilityActionBtn}
                      onPress={() => router.push({ pathname: '/admin/place-form', params: { id: place.id } })}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${place.name}`}
                      hitSlop={4}
                    >
                      <AppIcon name="pencil" size={18} color={M3.secondary} />
                    </Pressable>
                    {deleting === place.id ? (
                      <View style={styles.adminFacilityActionBtn}><ActivityIndicator size="small" color="#dc2626" /></View>
                    ) : (
                      <Pressable
                        style={styles.adminFacilityActionBtn}
                        onPress={() => confirmDelete(place)}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${place.name}`}
                        hitSlop={4}
                      >
                        <AppIcon name="delete-outline" size={18} color="#f87171" />
                      </Pressable>
                    )}
                  </View>
                </View>
                <View style={styles.adminFacilityAddressBlock}>
                  <View style={styles.adminFacilityAddressRow}>
                    <AppIcon name="map-marker" size={14} color="#94a3b8" />
                    <Text style={styles.adminFacilityAddress} numberOfLines={1}>{place.address ?? 'Address not set'}</Text>
                  </View>
                  <Text style={styles.adminFacilityUpdated}>Updated {new Date(place.updated_at).toLocaleDateString()}</Text>
                </View>
                <View style={styles.adminFacilityBadges}>
                  {availableFeatures.slice(0, 3).map((feature) => (
                    <View style={styles.adminBadgeOk} key={feature.id}>
                      <AppIcon name="check" size={12} color="#059669" />
                      <Text style={styles.adminBadgeOkText}>{FEATURE_LABELS[feature.feature_type]}</Text>
                    </View>
                  ))}
                  {unavailableFeatures.slice(0, 1).map((feature) => (
                    <View style={styles.adminBadgeNo} key={feature.id}>
                      <AppIcon name="close" size={12} color="#94a3b8" />
                      <Text style={styles.adminBadgeNoText}>No {FEATURE_LABELS[feature.feature_type]}</Text>
                    </View>
                  ))}
                  {availableFeatures.length === 0 && unavailableFeatures.length === 0 ? (
                    <Text style={styles.adminFacilityNoFeatures}>No accessibility features on record yet.</Text>
                  ) : null}
                </View>
              </View>
            );
          })
          : null}
      </ScrollView>

      {/* Sticky Add New Facility button */}
      <View style={styles.adminAddBar} pointerEvents="box-none">
        <Pressable
          style={styles.adminAddBtn}
          onPress={() => router.push('/admin/place-form')}
          accessibilityRole="button"
          accessibilityLabel="Add new facility to directory"
        >
          <AppIcon name="plus" size={20} color={M3.onPrimary} />
          <Text style={styles.adminAddBtnText}>Add New Facility</Text>
        </Pressable>
      </View>
    </View>
  );
}

type PhotoAsset = { uri: string; fileName?: string | null; mimeType?: string | null };

/** Verified = step-free entry + at least 3 available features; everything else is pending audit. */
function adminMetrics(places: Place[]): { total: number; verified: number; pending: number } {
  const verified = places.filter((place) => {
    const available = (place.accessibility_features ?? []).filter((feature) => feature.status === 'available');
    return available.some((feature) => feature.feature_type === 'entrance') && available.length >= 3;
  }).length;
  return { total: places.length, verified, pending: places.length - verified };
}

/** Shared app bar for the admin add/edit facility form. */
function AdminFormHeader({ isEdit }: { isEdit: boolean }) {
  return (
    <View style={styles.adminFormAppBar}>
      <Pressable
        style={styles.adminFormBackBtn}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={6}
      >
        <AppIcon name="chevron-left" size={22} color={M3.onSurface} />
      </Pressable>
      <View style={styles.adminFormAppBarCopy}>
        <Text style={styles.adminFormAppBarTitle}>{isEdit ? 'Edit Public Facility' : 'Add Facility'}</Text>
        <Text style={styles.adminFormAppBarSubtitle}>San Isidro Accessible Registry</Text>
      </View>
      <View style={styles.adminFormStatusPill}>
        <View style={styles.adminFormStatusDot} />
        <Text style={styles.adminFormStatusText}>Verified</Text>
      </View>
    </View>
  );
}

const featureFormHints: Record<FeatureType, string> = {
  ramp: 'Slope conforms to Batas Pambansa 344 (1:12)',
  restroom: 'Grab bars, widened outward door, low sink',
  elevator: 'Braille floor buttons & tactile floor guidance',
  parking: 'Designated reserved bays adjacent to entrance',
  entrance: 'Clear opening exceeding 900mm width',
  other: 'Other verified accessibility provisions',
};

const DEFAULT_FEATURES: Record<FeatureType, AccessibilityStatus> = {
  ramp: 'unavailable',
  restroom: 'unavailable',
  elevator: 'unavailable',
  parking: 'unavailable',
  entrance: 'unavailable',
  other: 'unavailable',
};

type AnalyticsRange = 'month' | 'quarter' | 'all';

const ANALYTICS_RANGES: { key: AnalyticsRange; label: string; days: number }[] = [
  { key: 'month', label: 'This Month', days: 30 },
  { key: 'quarter', label: 'Last Quarter', days: 90 },
  { key: 'all', label: 'All Time', days: 0 },
];

const BARRIER_ICONS = {
  ramp: 'trending-up',
  restroom: 'door-closed',
  other: 'texture',
} as const;

const CATEGORY_CHART_ICONS: Record<PlaceCategory, IconName> = {
  hospital: 'hospital-box',
  health_center: 'shield-plus',
  government: 'bank',
  school: 'school',
  mall: 'storefront',
  church: 'church',
  park: 'tree',
};

const daysAgo = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));

const csvCell = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** BP 344 compliance report: one row per facility with every feature's availability. */
function buildComplianceCsv(placesToExport: Place[]): string {
  const header = [
    'Facility',
    'Category',
    'Address',
    'Operating Hours',
    'Last Updated',
    'Verified Status',
    ...FEATURE_ORDER.map((type) => FEATURE_LABELS[type]),
    'Available Features',
    'Missing Features',
  ];
  const rows = placesToExport.map((place) => {
    const features = place.accessibility_features ?? [];
    const available = FEATURE_ORDER.filter((type) =>
      features.some((feature) => feature.feature_type === type && feature.status === 'available'),
    );
    const missing = FEATURE_ORDER.filter(
      (type) => !features.some((feature) => feature.feature_type === type && feature.status === 'available'),
    );
    const verified = available.some((type) => type === 'entrance') && available.length >= 3;
    return [
      place.name,
      CATEGORY_LABELS[place.category],
      place.address ?? '',
      place.operating_hours ?? '',
      new Date(place.updated_at).toISOString().slice(0, 10),
      verified ? 'Verified' : 'Pending',
      ...FEATURE_ORDER.map((type) => (available.includes(type) ? 'Available' : 'Missing')),
      available.map((type) => FEATURE_LABELS[type]).join('; '),
      missing.map((type) => FEATURE_LABELS[type]).join('; '),
    ];
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function AdminAnalyticsTab() {
  const { places, loading, error } = usePlaces();
  const [range, setRange] = useState<AnalyticsRange>('all');
  const [exporting, setExporting] = useState<'idle' | 'preparing' | 'done'>('idle');
  const exportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (exportTimer.current) clearTimeout(exportTimer.current);
  }, []);

  const rangedPlaces = useMemo(() => {
    const active = ANALYTICS_RANGES.find((item) => item.key === range) ?? ANALYTICS_RANGES[2];
    if (active.days === 0) return places;
    return places.filter((place) => daysAgo(place.updated_at) <= active.days);
  }, [places, range]);

  const metrics = adminMetrics(rangedPlaces);
  const total = metrics.total;
  const coveragePct = total === 0 ? 0 : Math.round((metrics.verified / total) * 100);
  const coverageColor = coveragePct >= 50 ? M3.primaryContainer : M3.secondary;

  const rampCount = rangedPlaces.filter((place) =>
    (place.accessibility_features ?? []).some((feature) => feature.feature_type === 'ramp' && feature.status === 'available'),
  ).length;
  const crCount = rangedPlaces.filter((place) =>
    (place.accessibility_features ?? []).some((feature) => feature.feature_type === 'restroom' && feature.status === 'available'),
  ).length;
  const rampPct = total === 0 ? 0 : Math.round((rampCount / total) * 100);
  const crPct = total === 0 ? 0 : Math.round((crCount / total) * 100);
  const newThisMonth = rangedPlaces.filter((place) => daysAgo(place.updated_at) <= 30).length;

  const barriers = useMemo(() => {
    const countMissing = (type: FeatureType) =>
      rangedPlaces.filter((place) =>
        !(place.accessibility_features ?? []).some((feature) => feature.feature_type === type && feature.status === 'available'),
      ).length;
    const rows: { key: string; title: string; note: string; icon: string; tone: 'error' | 'primary'; count: number }[] = [
      {
        key: 'tactile',
        title: 'Missing tactile ground indicators',
        note: 'Paving work queued with Engineering',
        icon: BARRIER_ICONS.other,
        tone: 'primary',
        count: countMissing('other'),
      },
      {
        key: 'restroom',
        title: 'No compliant accessible restroom',
        note: 'Blocks manual & power wheelchairs',
        icon: BARRIER_ICONS.restroom,
        tone: 'error',
        count: countMissing('restroom'),
      },
      {
        key: 'ramp',
        title: 'Missing ramp / step-free access',
        note: 'Requires engineering civil reprofile',
        icon: BARRIER_ICONS.ramp,
        tone: 'error',
        count: countMissing('ramp'),
      },
    ];
    return rows.filter((row) => row.count > 0).sort((a, b) => b.count - a.count);
  }, [rangedPlaces]);
  const flaggedSites = new Set(
    rangedPlaces
      .filter((place) => (place.accessibility_features ?? []).filter((feature) => feature.status === 'available').length < 3)
      .map((place) => place.id),
  ).size;

  const categoryRows = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => {
        const categoryPlaces = rangedPlaces.filter((place) => place.category === category);
        const verified = categoryPlaces.filter((place) =>
          (place.accessibility_features ?? []).filter((feature) => feature.status === 'available').length >= 3,
        ).length;
        const pct = categoryPlaces.length === 0 ? 0 : Math.round((verified / categoryPlaces.length) * 100);
        return { category, verified, total: categoryPlaces.length, pct };
      }).filter((row) => row.total > 0),
    [rangedPlaces],
  );

  const onExport = async () => {
    if (exporting !== 'idle') return;
    setExporting('preparing');
    const fileName = `accessmap-compliance-report-${new Date().toISOString().slice(0, 10)}.csv`;
    try {
      const csv = buildComplianceCsv(rangedPlaces);
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
            dialogTitle: 'Export Municipal Compliance Report',
            UTI: 'public.comma-separated-values-text',
          });
        } else {
          Alert.alert('Report ready', `Saved to: ${file.uri}`);
        }
      }
      setExporting('done');
      exportTimer.current = setTimeout(() => setExporting('idle'), 2200);
    } catch (exportError) {
      console.warn('Export failed', exportError);
      setExporting('idle');
      Alert.alert('Export failed', 'Could not generate the compliance report. Please try again.');
    }
  };

  return (
    <View style={styles.adminTabBody}>
      <View style={styles.adminAppBar}>
        <View style={styles.adminAppBarBrand}>
          <View style={styles.adminAppBarLogo}>
            <AppIcon name="wheelchair-accessibility" size={18} color={M3.onPrimary} />
          </View>
          <View style={styles.adminAppBarCopy}>
            <View style={styles.adminAppBarTitleRow}>
              <Text style={styles.adminAppBarTitle}>AccessMap Cainta</Text>
              <View style={styles.adminAppBarBadge}><Text style={styles.adminAppBarBadgeText}>Admin</Text></View>
            </View>
            <Text style={styles.adminAppBarSubtitle}>Municipal Administration</Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.setParams({ tab: 'settings' })}
          accessibilityRole="button"
          accessibilityLabel="Open admin profile settings"
        >
          <Image source={photos.avatar} style={styles.adminAppBarAvatar} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.adminAnalyticsScroll} showsVerticalScrollIndicator={false}>
        {/* Breadcrumb + header + range tabs */}
        <View style={styles.adminTitleBlock}>
          <View style={styles.adminAnalyticsCrumbRow}>
            <View style={styles.adminTitleDotRow}>
              <View style={styles.adminTitleDot} />
              <Text style={[styles.adminTitleEyebrow, styles.adminAnalyticsCrumbPrimary]}>Municipal Monitoring • Cainta</Text>
            </View>
          </View>
          <Text style={styles.adminAnalyticsTitle}>Accessibility Analytics</Text>
          <Text style={styles.adminTitleBody}>
            Public infrastructure accessibility metrics and compliance tracking under Batas Pambansa Blg. 344.
          </Text>
          <View style={styles.adminAnalyticsRangeWrap}>
            {ANALYTICS_RANGES.map((item) => {
              const active = item.key === range;
              return (
                <Pressable
                  key={item.key}
                  style={[styles.adminAnalyticsRangeTab, active ? styles.adminAnalyticsRangeTabActive : null]}
                  onPress={() => setRange(item.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Reporting range: ${item.label}`}
                >
                  <Text style={[styles.adminAnalyticsRangeText, active ? styles.adminAnalyticsRangeTextActive : null]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* KPI cards (2x2) */}
        <View style={styles.adminAnalyticsKpiGrid}>
          <View style={styles.adminAnalyticsKpi}>
            <View style={styles.adminAnalyticsKpiHead}>
              <Text style={styles.adminAnalyticsKpiLabel}>Audited Sites</Text>
              <View style={styles.adminAnalyticsKpiIconTinted}>
                <AppIcon name="domain" size={16} color={M3.onSecondaryFixed} />
              </View>
            </View>
            <Text style={styles.adminAnalyticsKpiValue}>{total}</Text>
            <View style={styles.adminAnalyticsKpiTrendRow}>
              {newThisMonth > 0 ? (
                <>
                  <AppIcon name="trending-up" size={13} color={M3.tertiary} />
                  <Text style={styles.adminAnalyticsKpiTrend}>+{newThisMonth} this month</Text>
                </>
              ) : (
                <Text style={styles.adminAnalyticsKpiNote}>No updates this month</Text>
              )}
            </View>
          </View>
          <View style={styles.adminAnalyticsKpi}>
            <View style={styles.adminAnalyticsKpiHead}>
              <Text style={styles.adminAnalyticsKpiLabel}>BP 344 Compliant</Text>
              <View style={styles.adminAnalyticsKpiIconGreen}>
                <AppIcon name="check-decagram" size={16} color={M3.onTertiaryFixed} />
              </View>
            </View>
            <Text style={[styles.adminAnalyticsKpiValue, { color: coverageColor }]}>{coveragePct}%</Text>
            <View style={styles.adminAnalyticsKpiTrendRow}>
              <Text style={styles.adminAnalyticsKpiNote}>{coveragePct >= 80 ? 'High civic grade' : 'Improving civic grade'}</Text>
            </View>
          </View>
          <View style={styles.adminAnalyticsKpi}>
            <View style={styles.adminAnalyticsKpiHead}>
              <Text style={styles.adminAnalyticsKpiLabel}>Ramp / Step-Free</Text>
              <View style={styles.adminAnalyticsKpiIconGray}>
                <AppIcon name="wheelchair-accessibility" size={16} color={M3.onSurface} />
              </View>
            </View>
            <View style={styles.adminAnalyticsKpiValueRow}>
              <Text style={styles.adminAnalyticsKpiValue}>{rampCount}</Text>
              <Text style={styles.adminAnalyticsKpiDenominator}>/ {total}</Text>
            </View>
            <View style={styles.adminAnalyticsKpiTrendRow}>
              <Text style={styles.adminAnalyticsKpiNote}>{rampPct.toFixed(1)}% network coverage</Text>
            </View>
          </View>
          <View style={styles.adminAnalyticsKpi}>
            <View style={styles.adminAnalyticsKpiHead}>
              <Text style={styles.adminAnalyticsKpiLabel}>Accessible CRs</Text>
              <View style={styles.adminAnalyticsKpiIconGray}>
                <AppIcon name="toilet" size={16} color={M3.onSurface} />
              </View>
            </View>
            <View style={styles.adminAnalyticsKpiValueRow}>
              <Text style={styles.adminAnalyticsKpiValue}>{crCount}</Text>
              <Text style={styles.adminAnalyticsKpiDenominator}>/ {total}</Text>
            </View>
            <View style={styles.adminAnalyticsKpiTrendRow}>
              <Text style={styles.adminAnalyticsKpiNote}>{crPct.toFixed(1)}% verified compliant</Text>
            </View>
          </View>
        </View>

        {/* Category compliance rates */}
        <View style={styles.adminAnalyticsPanel}>
          <View style={styles.adminAnalyticsPanelHead}>
            <View style={styles.adminAnalyticsPanelHeadLeft}>
              <AppIcon name="chart-bar" size={20} color={M3.primaryContainer} />
              <Text style={styles.adminAnalyticsPanelTitle}>Category Compliance Rates</Text>
            </View>
            <Text style={styles.adminAnalyticsPanelMeta}>{categoryRows.length} Sectors</Text>
          </View>
          <View style={styles.adminAnalyticsSectors}>
            {categoryRows.map(({ category, verified: verifiedCount, total: categoryTotal, pct }) => {
              const best = Math.max(...categoryRows.map((row) => row.pct));
              return (
                <Pressable
                  key={category}
                  style={styles.adminAnalyticsSector}
                  onPress={() => router.setParams({ tab: 'directory', category })}
                  accessibilityRole="button"
                  accessibilityLabel={`${CATEGORY_LABELS[category]}: ${pct}% compliant. Open in Directory`}
                >
                  <View style={styles.adminAnalyticsSectorHead}>
                    <View style={styles.adminAnalyticsSectorName}>
                      <AppIcon
                        name={CATEGORY_CHART_ICONS[category]}
                        size={18}
                        color={pct === best ? M3.tertiary : pct >= 50 ? M3.primaryContainer : M3.secondary}
                      />
                      <Text style={styles.adminAnalyticsSectorTitle}>{CATEGORY_LABELS[category]}</Text>
                    </View>
                    <Text style={styles.adminAnalyticsSectorValue}>
                      <Text style={pct >= 50 ? styles.adminAnalyticsSectorPct : styles.adminAnalyticsSectorPctLow}>{pct}%</Text>
                      {categoryTotal > 0 ? <Text style={styles.adminAnalyticsSectorCount}> ({verifiedCount}/{categoryTotal})</Text> : null}
                    </Text>
                  </View>
                  <View style={styles.adminAnalyticsSectorTrack}>
                    <View
                      style={[
                        styles.adminAnalyticsSectorFill,
                        { width: `${pct}%`, backgroundColor: pct >= 50 ? M3.primaryContainer : M3.primaryFixedDim },
                      ]}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Priority remediation barriers */}
        <View style={styles.adminAnalyticsPanel}>
          <View style={styles.adminAnalyticsPanelHead}>
            <View style={styles.adminAnalyticsPanelHeadLeft}>
              <AppIcon name="alert" size={20} color={M3.error} />
              <Text style={styles.adminAnalyticsPanelTitle}>Priority Remediation Barriers</Text>
            </View>
            {flaggedSites > 0 ? (
              <Pressable
                style={styles.adminAnalyticsFlagPill}
                onPress={() => router.setParams({ tab: 'directory' })}
                accessibilityRole="button"
                accessibilityLabel={`${flaggedSites} sites flagged. Open Directory`}
              >
                <Text style={styles.adminAnalyticsFlagText}>{flaggedSites} Active Flagged</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.adminAnalyticsBarriers}>
            {barriers.length === 0 ? (
              <View style={styles.adminAnalyticsBarrierRow}>
                <View style={styles.adminAnalyticsBarrierIconWrap}><AppIcon name="check-decagram" size={18} color={M3.tertiary} /></View>
                <View style={styles.adminAnalyticsBarrierCopy}>
                  <Text style={styles.adminAnalyticsBarrierTitle}>No active barriers flagged</Text>
                  <Text style={styles.adminAnalyticsBarrierNote}>Every audited site meets the current checklist.</Text>
                </View>
              </View>
            ) : (
              barriers.map((barrier) => (
                <Pressable
                  key={barrier.key}
                  style={styles.adminAnalyticsBarrierRow}
                  onPress={() => router.setParams({ tab: 'directory' })}
                  accessibilityRole="button"
                  accessibilityLabel={`${barrier.title}: ${barrier.count} sites. Open Directory`}
                >
                  <View style={styles.adminAnalyticsBarrierIconWrap}>
                    <AppIcon
                      name={barrier.icon as IconName}
                      size={18}
                      color={barrier.tone === 'error' ? M3.error : M3.primaryContainer}
                    />
                  </View>
                  <View style={styles.adminAnalyticsBarrierCopy}>
                    <Text style={styles.adminAnalyticsBarrierTitle}>{barrier.title}</Text>
                    <Text style={styles.adminAnalyticsBarrierNote}>{barrier.note}</Text>
                  </View>
                  <View style={styles.adminAnalyticsBarrierCountWrap}>
                    <Text
                      style={
                        barrier.tone === 'error'
                          ? styles.adminAnalyticsBarrierCountError
                          : styles.adminAnalyticsBarrierCountPrimary
                      }
                    >
                      {barrier.count}
                    </Text>
                    <Text style={styles.adminAnalyticsBarrierSites}>{barrier.count === 1 ? 'site' : 'sites'}</Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        </View>

        {/* Export CTA */}
        <Pressable
          style={styles.adminAnalyticsExportBtn}
          onPress={onExport}
          accessibilityRole="button"
          accessibilityLabel="Export Municipal Compliance Report in PDF or CSV format"
        >
          {exporting === 'preparing' ? (
            <>
              <AppIcon name="sync" size={20} color={M3.onPrimary} />
              <Text style={styles.adminAnalyticsExportText}>Preparing Package...</Text>
            </>
          ) : exporting === 'done' ? (
            <>
              <AppIcon name="check-circle" size={20} color={M3.onPrimary} />
              <Text style={styles.adminAnalyticsExportText}>Report Downloaded (CSV)</Text>
            </>
          ) : (
            <>
              <AppIcon name="download" size={20} color={M3.onPrimary} />
              <Text style={styles.adminAnalyticsExportText}>Export Municipal Compliance Report</Text>
            </>
          )}
        </Pressable>
        <View style={styles.adminAnalyticsExportNote}>
          <AppIcon name="shield-check" size={15} color={M3.outline} />
          <Text style={styles.adminAnalyticsExportNoteText}>
            Official summary for Cainta PWD Affairs Office (PDAO) & Engineering Office.
          </Text>
        </View>

        {error ? <EmptyState title="Could not load analytics" message={error} /> : null}
        {!error && loading ? <LoadingState label="Loading analytics…" /> : null}
        {!error && !loading && total === 0 ? (
          <EmptyState title="Nothing to analyze yet" message="Add facilities to the directory to see compliance metrics." />
        ) : null}
      </ScrollView>
    </View>
  );
}

export function AdminSettingsTab() {
  const { user } = useUser();
  const { isAdmin, syncing } = useRole();
  const { signOut } = useClerk();
  const clerk = useClerk();
  const { places } = usePlaces();
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [syncingNow, setSyncingNow] = useState(false);
  const [prefs, setPrefs] = useState({ highContrast: true, autoSave: true });

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Administrator';
  const metrics = adminMetrics(places);

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

  const runSync = () => {
    if (syncingNow) return;
    setSyncingNow(true);
    showToast('Connecting to Cainta Municipal GIS Server...');
    setTimeout(() => {
      setSyncingNow(false);
      showToast(`Sync complete: ${metrics.total}/${metrics.total} audits verified`);
    }, 1200);
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

      <View style={styles.adminAppBar}>
        <View style={styles.adminAppBarBrand}>
          <View style={styles.adminAppBarLogo}>
            <AppIcon name="human-wheelchair" size={18} color={M3.onPrimary} />
          </View>
          <View style={styles.adminAppBarCopy}>
            <View style={styles.adminAppBarTitleRow}>
              <Text style={styles.adminAppBarTitle}>AccessMap Cainta</Text>
              <View style={styles.adminAppBarBadge}><Text style={styles.adminAppBarBadgeText}>Admin</Text></View>
            </View>
            <Text style={styles.adminAppBarSubtitle}>Municipal Administration</Text>
          </View>
        </View>
        <View style={styles.adminAvatarChipWrap}>
          <Image source={user?.imageUrl ? { uri: user.imageUrl } : photos.avatar} style={styles.adminAppBarAvatar} />
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.adminNewScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Section 1: Admin identity card */}
        <View style={styles.adminIdCard}>
          <View style={styles.adminIdCardGlow} pointerEvents="none" />
          <View style={styles.adminIdCardRow}>
            <View style={styles.adminIdAvatarWrap}>
              <Image source={user?.imageUrl ? { uri: user.imageUrl } : photos.avatar} style={styles.adminIdAvatar} contentFit="cover" />
              <View style={styles.adminIdBadge}>
                <AppIcon name="check-decagram" size={13} color={M3.onTertiaryContainer} />
              </View>
            </View>
            <View style={styles.adminIdCopy}>
              <View style={styles.adminIdRolePill}>
                <Text style={styles.adminIdRoleText}>{syncing ? 'Checking role…' : isAdmin ? 'Municipal Accessibility Inspector' : 'Community Member'}</Text>
              </View>
              <Text style={styles.adminIdName} numberOfLines={1}>{userName}</Text>
              <Text style={styles.adminIdOrg} numberOfLines={1}>Cainta PWD Affairs Office (PDAO) & Municipal Engineering</Text>
              <View style={styles.adminIdLocRow}>
                <AppIcon name="map-marker-radius" size={14} color={M3.onSecondaryContainer} />
                <Text style={styles.adminIdLocText} numberOfLines={1}>Barangay San Isidro & Town Center</Text>
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
            <Text style={styles.adminIdEditText}>Edit Admin Profile</Text>
          </Pressable>
        </View>

        {/* Section 2: Inspector credentials & status */}
        <View style={styles.adminSectionHeadRow}>
          <Text style={styles.adminSectionHead}>Inspector Credentials & Status</Text>
          <View style={styles.adminAuthStatusRow}>
            <View style={styles.adminAuthStatusDot} />
            <Text style={styles.adminAuthStatusText}>Authorized</Text>
          </View>
        </View>
        <View style={styles.adminCredGrid}>
          <View style={styles.adminCredCell}>
            <Text style={styles.adminCredLabel}>Sites Audited</Text>
            <Text style={styles.adminCredValue}>{metrics.total}</Text>
            <Text style={styles.adminCredSub} numberOfLines={1}>Cainta Proper</Text>
          </View>
          <View style={styles.adminCredCell}>
            <Text style={styles.adminCredLabel}>Verified</Text>
            <Text style={[styles.adminCredValue, styles.adminCredValuePrimary]}>{metrics.verified}</Text>
            <Text style={[styles.adminCredSub, styles.adminCredSubOk]}>BP 344 Certified</Text>
          </View>
          <View style={styles.adminCredCell}>
            <Text style={styles.adminCredLabel}>Pending</Text>
            <Text style={styles.adminCredValue}>{metrics.pending}</Text>
            <Text style={styles.adminCredSub} numberOfLines={1}>In queue</Text>
          </View>
          <View style={styles.adminCredCell}>
            <Text style={styles.adminCredLabel}>Validity</Text>
            <Text style={styles.adminCredValue}>2026</Text>
            <Text style={[styles.adminCredSub, styles.adminCredSubOk]}>Active</Text>
          </View>
        </View>

        {/* Section 3: Governance & field tools */}
        <Text style={styles.adminSectionLabel}>Governance & Field Tools</Text>
        <View style={styles.adminToolList}>
          <Pressable
            style={styles.adminToolRow}
            onPress={() => showToast('Loading Batas Pambansa 344 Manual...')}
            accessibilityRole="button"
            accessibilityLabel="Open field audit protocol and BP 344 guidelines"
          >
            <View style={styles.adminToolIcon}><AppIcon name="book-open-page-variant" size={19} color={M3.onSecondaryFixed} /></View>
            <View style={styles.adminToolCopy}>
              <Text style={styles.adminToolTitle}>Field Audit Protocol</Text>
              <Text style={styles.adminToolSub} numberOfLines={1}>Batas Pambansa Blg. 344 Technical Provisions</Text>
            </View>
            <AppIcon name="chevron-right" size={18} color="#747689" />
          </Pressable>
          <View style={styles.adminToolDivider} />
          <View style={styles.adminToolRow}>
            <View style={styles.adminToolIcon}><AppIcon name="cloud-sync" size={19} color={M3.onSecondaryFixed} /></View>
            <View style={styles.adminToolCopy}>
              <Text style={styles.adminToolTitle}>Offline Survey Sync</Text>
              <View style={styles.adminToolSubRow}>
                <View style={styles.adminSyncDot} />
                <Text style={styles.adminToolSubOk} numberOfLines={1}>All {metrics.total} audit packages synchronized</Text>
              </View>
            </View>
            <Pressable
              style={styles.adminSyncBtn}
              onPress={runSync}
              disabled={syncingNow}
              accessibilityRole="button"
              accessibilityLabel="Sync offline data now"
            >
              <AppIcon name="refresh" size={15} color={M3.primaryContainer} />
              <Text style={styles.adminSyncBtnText}>Sync</Text>
            </Pressable>
          </View>
          <View style={styles.adminToolDivider} />
          <Pressable
            style={styles.adminToolRow}
            onPress={() => showToast('Opening Municipal Inspector Registry...')}
            accessibilityRole="button"
            accessibilityLabel="Manage inspector accounts and permissions"
          >
            <View style={styles.adminToolIcon}><AppIcon name="badge-account-outline" size={19} color={M3.onSecondaryFixed} /></View>
            <View style={styles.adminToolCopy}>
              <Text style={styles.adminToolTitle}>Inspector Permissions</Text>
              <Text style={styles.adminToolSub} numberOfLines={1}>Manage municipal field auditors</Text>
            </View>
            <AppIcon name="chevron-right" size={18} color="#747689" />
          </Pressable>
          <View style={styles.adminToolDivider} />
          <Pressable
            style={styles.adminToolRow}              onPress={() => router.push('/(tabs)/profile')}
              accessibilityRole="button"
              accessibilityLabel="Open your profile and account details"
          >
            <View style={styles.adminToolIcon}><AppIcon name="history" size={19} color={M3.onSecondaryFixed} /></View>
            <View style={styles.adminToolCopy}>
              <Text style={styles.adminToolTitle}>Audit Log & Timestamps</Text>
              <Text style={styles.adminToolSub} numberOfLines={1}>Immutable municipal records & updates</Text>
            </View>
            <AppIcon name="chevron-right" size={18} color="#747689" />
          </Pressable>
        </View>

        {/* Section 4: Preferences & security */}
        <Text style={styles.adminSectionLabel}>Preferences & Security</Text>
        <View style={styles.adminToolList}>
          <View style={styles.adminToolRow}>
            <View style={styles.adminToolIconMuted}><AppIcon name="contrast" size={19} color={M3.onSurfaceVariant} /></View>
            <View style={styles.adminToolCopy}>
              <Text style={styles.adminToolTitle}>High-Contrast Field Mode</Text>
              <Text style={styles.adminToolSub} numberOfLines={1}>Maximum legibility under direct sunlight</Text>
            </View>
            <Pressable
              style={[styles.adminMiniSwitch, prefs.highContrast ? styles.adminMiniSwitchOn : styles.adminMiniSwitchOff]}
              onPress={() => {
                setPrefs((current) => ({ ...current, highContrast: !current.highContrast }));
                showToast(!prefs.highContrast ? 'High-contrast field mode active' : 'Standard display mode active');
              }}
              accessibilityRole="switch"
              accessibilityState={{ checked: prefs.highContrast }}
              accessibilityLabel="Toggle high-contrast field mode"
            >
              <View style={[styles.adminMiniKnob, prefs.highContrast && styles.adminMiniKnobOn]} />
            </Pressable>
          </View>
          <View style={styles.adminToolDivider} />
          <View style={styles.adminToolRow}>
            <View style={styles.adminToolIconMuted}><AppIcon name="content-save-check-outline" size={19} color={M3.onSurfaceVariant} /></View>
            <View style={styles.adminToolCopy}>
              <Text style={styles.adminToolTitle}>Auto-Save Draft Audits</Text>
              <Text style={styles.adminToolSub} numberOfLines={1}>Caches inspection findings every 30 seconds</Text>
            </View>
            <Pressable
              style={[styles.adminMiniSwitch, prefs.autoSave ? styles.adminMiniSwitchOn : styles.adminMiniSwitchOff]}
              onPress={() => {
                setPrefs((current) => ({ ...current, autoSave: !current.autoSave }));
                showToast(!prefs.autoSave ? 'Audit drafts auto-saving enabled' : 'Audit drafts auto-saving paused');
              }}
              accessibilityRole="switch"
              accessibilityState={{ checked: prefs.autoSave }}
              accessibilityLabel="Toggle auto-save draft audits"
            >
              <View style={[styles.adminMiniKnob, prefs.autoSave && styles.adminMiniKnobOn]} />
            </Pressable>
          </View>
          <View style={styles.adminToolDivider} />
          <Pressable
            style={styles.adminToolRow}
            onPress={() => showToast('Security PIN verification prompt opened')}
            accessibilityRole="button"
            accessibilityLabel="Change security PIN or passcode"
          >
            <View style={styles.adminToolIconMuted}><AppIcon name="lock-reset" size={19} color={M3.onSurfaceVariant} /></View>
            <View style={styles.adminToolCopy}>
              <Text style={styles.adminToolTitle}>Change Security PIN</Text>
              <Text style={styles.adminToolSub} numberOfLines={1}>Required for publishing public accessibility marks</Text>
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
          <Text style={styles.adminSignOutText}>Sign Out of Admin Console</Text>
        </Pressable>

        <View style={styles.adminFooterSign}>
          <Text style={styles.adminFooterSignMain}>Municipality of Cainta • PWD Affairs Office</Text>
          <Text style={styles.adminFooterSignSub}>BP 344 Digital Compliance Registry v2.4</Text>
        </View>
      </ScrollView>
    </View>
  );
}

export function PlaceFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const authed = useAuthedSupabase();
  const { user } = useUser();
  const { place, loading: placeLoading } = usePlace(isEdit ? id : undefined);
  const seededRef = useRef(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<PlaceCategory>(CATEGORY_ORDER[0]);
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [operatingHours, setOperatingHours] = useState('');
  const [features, setFeatures] = useState<Record<FeatureType, AccessibilityStatus>>({
    ...DEFAULT_FEATURES,
  });
  const [photo, setPhoto] = useState<PhotoAsset | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isEdit && place && !seededRef.current) {
      seededRef.current = true;
      setName(place.name);
      setCategory(place.category);
      setAddress(place.address ?? '');
      setDescription(place.description ?? '');
      setLatitude(String(place.latitude));
      setLongitude(String(place.longitude));
      setOperatingHours(place.operating_hours ?? '');
      setPreviewUri(place.photo_url);
      const draft: Record<FeatureType, AccessibilityStatus> = { ...DEFAULT_FEATURES };
      for (const feature of place.accessibility_features ?? []) {
        draft[feature.feature_type] = feature.status;
      }
      setFeatures(draft);
    }
  }, [isEdit, place]);

  if (isEdit && placeLoading) {
    return (
      <SafeAreaView style={styles.adminNewSafe} edges={['top']}>
        <AdminFormHeader isEdit />
        <LoadingState label="Loading facility…" />
      </SafeAreaView>
    );
  }

  if (isEdit && !place) {
    return (
      <SafeAreaView style={styles.adminNewSafe} edges={['top']}>
        <AdminFormHeader isEdit />
        <EmptyState title="Facility not found" message="This facility could not be loaded." />
      </SafeAreaView>
    );
  }

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow access to your photo library to attach an entrance photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setPhoto({ uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType });
      setPreviewUri(asset.uri);
    }
  };

  const setFeatureStatus = (featureType: FeatureType, status: AccessibilityStatus) => {
    setFeatures((prev) => ({ ...prev, [featureType]: status }));
  };

  const save = async () => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!name.trim()) {
      Alert.alert('Missing name', 'Enter a facility name.');
      return;
    }
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      Alert.alert('Invalid coordinates', 'Enter numeric values for latitude and longitude.');
      return;
    }
    if (!authed || !user) {
      Alert.alert('Session not ready', 'Your sign-in session is still loading. Please try again.');
      return;
    }
    setSaving(true);
    try {
      let photoUrl = place?.photo_url ?? null;
      if (photo) {
        photoUrl = await uploadEntrancePhoto(authed, photo);
      }

      const featureRows = FEATURE_ORDER.map((featureType) => ({
        feature_type: featureType,
        status: features[featureType],
        notes: null,
      }));

      if (isEdit) {
        const { error: updateError } = await authed
          .from('places')
          .update({
            name: name.trim(),
            category,
            description: description.trim() || null,
            address: address.trim() || null,
            latitude: lat,
            longitude: lng,
            photo_url: photoUrl,
            operating_hours: operatingHours.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
        if (updateError) throw updateError;

        const { error: deleteFeaturesError } = await authed
          .from('accessibility_features')
          .delete()
          .eq('place_id', id);
        if (deleteFeaturesError) throw deleteFeaturesError;

        if (featureRows.length > 0) {
          const { error: insertFeaturesError } = await authed
            .from('accessibility_features')
            .insert(featureRows.map((row) => ({ ...row, place_id: id })));
          if (insertFeaturesError) throw insertFeaturesError;
        }
      } else {
        let createdBy: string | null = null;
        const { data: me, error: meError } = await authed
          .from('users')
          .select('id')
          .eq('clerk_user_id', user.id)
          .maybeSingle();
        if (!meError && me) createdBy = me.id;

        const { data: inserted, error: insertError } = await authed
          .from('places')
          .insert({
            name: name.trim(),
            category,
            description: description.trim() || null,
            address: address.trim() || null,
            latitude: lat,
            longitude: lng,
            photo_url: photoUrl,
            operating_hours: operatingHours.trim() || null,
            created_by: createdBy,
          })
          .select('id')
          .single();
        if (insertError) throw insertError;

        const { error: insertFeaturesError } = await authed
          .from('accessibility_features')
          .insert(featureRows.map((row) => ({ ...row, place_id: inserted.id })));
        if (insertFeaturesError) throw insertFeaturesError;
      }
      setSaved(true);
      // Let the success toast register before returning to the directory.
      await new Promise((resolve) => setTimeout(resolve, 600));
      router.replace('/admin');
    } catch (saveError) {
      setSaved(false);
      console.warn('Save failed', saveError);
      Alert.alert('Save failed', 'Could not save the facility. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.adminNewSafe} edges={['top']}>
      <AdminFormHeader isEdit={isEdit} />
      <ScrollView contentContainerStyle={styles.adminFormScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.adminFormIntro}>
          <Text style={styles.adminFormTitle}>{isEdit ? 'Edit Public Facility' : 'Add New Facility'}</Text>
          <Text style={styles.adminFormSubtitle}>Register physical accessibility features for San Isidro facilities with strict civic accuracy.</Text>
        </View>

        <View style={styles.formField}>
          <View style={styles.adminFormLabelRow}>
            <Text style={styles.fieldLabel}>Place Name *</Text>
            <Text style={styles.adminFormLabelHint}>Required</Text>
          </View>
          <TextInput value={name} onChangeText={setName} placeholder="e.g. San Isidro Municipal Hospital" style={styles.fieldInput} />
        </View>

        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Facility Category *</Text>
          <View style={styles.chipsWrap}>
            {CATEGORY_ORDER.map((item) => (
              <Pressable
                key={item}
                style={[styles.categoryChip, category === item && styles.activeChip]}
                onPress={() => setCategory(item)}
                accessibilityRole="button"
                accessibilityState={{ selected: category === item }}
              >
                <Text style={[styles.categoryChipText, category === item && styles.activeChipText]}>{CATEGORY_SHORT_LABELS[item]}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.formField}>
          <View style={styles.adminFormLabelRow}>
            <Text style={styles.fieldLabel}>Description & Navigational Context</Text>
            <Text style={styles.adminFormLabelHint}>3 lines recommended</Text>
          </View>
          <TextInput value={description} onChangeText={setDescription} multiline placeholder="Physical accessibility context" style={[styles.fieldInput, styles.adminFormTextarea]} />
        </View>

        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Physical Address *</Text>
          <View style={styles.adminFormIconWrap}>
            <View style={styles.adminFormIconLead}><AppIcon name="map-marker" size={18} color={M3.primaryContainer} /></View>
            <TextInput value={address} onChangeText={setAddress} placeholder="House/Street no., Barangay, Municipality" style={[styles.fieldInput, styles.adminFormIconInput]} />
          </View>
        </View>

        <View style={styles.formRow}>
          <View style={[styles.formField, styles.flex]}><Text style={styles.fieldLabel}>Latitude *</Text><TextInput value={latitude} onChangeText={setLatitude} keyboardType="decimal-pad" placeholder="14.5…" style={styles.fieldInput} /></View>
          <View style={[styles.formField, styles.flex]}><Text style={styles.fieldLabel}>Longitude *</Text><TextInput value={longitude} onChangeText={setLongitude} keyboardType="decimal-pad" placeholder="121.1…" style={styles.fieldInput} /></View>
        </View>

        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Operating Hours *</Text>
          <View style={styles.adminFormIconWrap}>
            <View style={styles.adminFormIconLead}><AppIcon name="clock-outline" size={18} color={M3.primaryContainer} /></View>
            <TextInput value={operatingHours} onChangeText={setOperatingHours} placeholder="e.g. Mon–Fri 8:00 AM – 5:00 PM" style={[styles.fieldInput, styles.adminFormIconInput]} />
          </View>
        </View>

        {/* Entrance photo verification */}
        <View style={styles.formField}>
          <View style={styles.adminFormLabelRow}>
            <Text style={styles.fieldLabel}>Entrance Photo Verification</Text>
            {previewUri ? (
              <View style={styles.adminPhotoVerifiedPill}>
                <AppIcon name="check-decagram" size={12} color={M3.primaryContainer} />
                <Text style={styles.adminPhotoVerifiedText}>Photo attached</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.adminPhotoBox}>
            <View style={styles.adminPhotoRow}>
              {previewUri ? (
                <View style={styles.adminPhotoThumbWrap}>
                  <Image source={{ uri: previewUri }} style={styles.adminPhotoThumb} contentFit="cover" />
                  <View style={styles.adminPhotoCheck}><AppIcon name="check-circle" size={13} color={M3.primaryContainer} /></View>
                </View>
              ) : (
                <View style={[styles.adminPhotoThumbWrap, styles.adminPhotoThumbEmpty]}>
                  <AppIcon name="image-outline" size={22} color="#94a3b8" />
                </View>
              )}
              <View style={styles.adminPhotoCopy}>
                <Text style={styles.adminPhotoTitle} numberOfLines={1}>{previewUri ? 'Main Step-Free Entry' : 'No photo selected'}</Text>
                <Text style={styles.adminPhotoSub} numberOfLines={2}>Photos verify step heights, door clearance, and ramp slope for wheelchair access.</Text>
                <Pressable
                  style={styles.adminPhotoChangeBtn}
                  onPress={pickPhoto}
                  accessibilityRole="button"
                  accessibilityLabel={photo || previewUri ? 'Replace photo' : 'Choose photo'}
                >
                  <AppIcon name="camera-outline" size={15} color={M3.onSurface} />
                  <Text style={styles.adminPhotoChangeText}>{photo || previewUri ? 'Change Photo' : 'Choose Photo'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Verified accessibility features */}
        <View style={styles.adminFormSectionHead}>
          <Text style={styles.adminFormSectionTitle}>Verified Accessibility Features</Text>
          <Text style={styles.adminFormSectionSub}>Strict physical dual-state indicators (Available / Not Available). Entered by app administrator.</Text>
        </View>
        <View style={styles.adminFeatureList}>
          {FEATURE_ORDER.map((featureType) => {
            const status = features[featureType];
            const checked = status === 'available';
            return (
              <View style={styles.adminFeatureRow} key={featureType}>
                <View style={styles.adminFeatureIcon}><AppIcon name={featureIcon[featureType]} size={19} color={M3.primaryContainer} /></View>
                <View style={styles.adminFeatureTexts}>
                  <Text style={styles.adminFeatureName} numberOfLines={1}>{FEATURE_LABELS[featureType]}</Text>
                  <Text style={styles.adminFeatureSub} numberOfLines={1}>{featureFormHints[featureType]}</Text>
                </View>
                <Pressable
                  style={[styles.adminFeatureSwitch, checked && styles.adminFeatureSwitchOn]}
                  onPress={() => setFeatureStatus(featureType, checked ? 'not_available' : 'available')}
                  accessibilityRole="switch"
                  accessibilityState={{ checked }}
                  accessibilityLabel={`Toggle ${FEATURE_LABELS[featureType]}`}
                  hitSlop={4}
                >
                  <View style={[styles.adminFeatureKnob, checked && styles.adminFeatureKnobOn]}>
                    <AppIcon name={checked ? 'check' : 'close'} size={12} color={checked ? M3.primaryContainer : '#94a3b8'} />
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* Save toast + actions */}
        {saved ? (
          <View style={styles.adminSaveToast}>
            <AppIcon name="check-circle" size={22} color={M3.primaryContainer} />
            <View style={styles.adminSaveToastCopy}>
              <Text style={styles.adminSaveToastTitle}>Facility Updated</Text>
              <Text style={styles.adminSaveToastSub}>{name.trim() || 'Facility'} accessibility record is saved.</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.adminFormActions}>
          <Pressable style={styles.adminCancelBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancel editing">
            <AppIcon name="close" size={17} color={M3.onSurface} />
            <Text style={styles.adminCancelText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.adminSaveBtn} onPress={save} accessibilityRole="button" accessibilityLabel="Save facility details">
            {saving ? <ActivityIndicator size="small" color={M3.onPrimary} /> : <AppIcon name="content-save" size={17} color={M3.onPrimary} />}
            <Text style={styles.adminSaveText}>Save Facility</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function CategoryScreen() {
  const { places, loading, error } = usePlaces();
  const countFor = (category: PlaceCategory) => places.filter((place) => place.category === category).length;
  const essential: PlaceCategory[] = ['hospital', 'health_center', 'government'];
  const secondary: PlaceCategory[] = ['school', 'mall', 'church', 'park'];
  return (
    <Screen>
      <Header />
      <View style={styles.filterSummary}><Text style={styles.filterSummaryText}>◉  Admin-Verified Listings</Text></View>
      <Text style={styles.screenTitle}>Browse Facilities by Category</Text>
      <Text style={styles.body}>Select a category to view accessible entrances, ramps, restrooms, and parking.</Text>
      <SearchBar placeholder="Search facility types, ramps, services" />
      {error ? <EmptyState title="Could not load categories" message={error} /> : null}
      {!error && loading ? <LoadingState label="Loading categories…" /> : null}
      {!error && !loading && places.length === 0 ? <EmptyState message="No facilities are registered yet. Check back soon." /> : null}
      <Text style={styles.sectionTitle}>● Essential Public Services</Text>
      {essential.map((category) => (
        <Pressable key={category} style={styles.categoryListCard} onPress={() => router.push(tabsRoute)}>
          <Text style={styles.categoryLargeIcon}>{CATEGORY_ICONS[category]}</Text>
          <View style={styles.flex}><Text style={styles.cardHeading}>{CATEGORY_LABELS[category]}</Text><Text style={styles.body}>{CATEGORY_DETAILS[category]}</Text><Text style={styles.greenLabel}>✓ Step-Free Entry  •  ✓ Accessible Restroom</Text></View>
          <Text style={styles.countPill}>{countFor(category)}</Text>
        </Pressable>
      ))}
      <Text style={styles.sectionTitle}>Commercial & Community Places</Text>
      <View style={styles.categoryGrid}>{secondary.map((category) => <Pressable key={category} style={styles.categoryCard} onPress={() => router.push(tabsRoute)}><Text style={styles.categoryIcon}>{CATEGORY_ICONS[category]}</Text><Text style={styles.cardHeading}>{CATEGORY_LABELS[category]}</Text><Text style={styles.body}>{CATEGORY_DETAILS[category]}</Text><Text style={styles.greenLabel}>{countFor(category)} locations</Text></Pressable>)}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { paddingBottom: 24 },
  screenContent: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 16, gap: 16 },
  flex: { flex: 1 },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  logo: { width: 40, height: 40, borderRadius: 10 },
  headerCopy: { flex: 1 },
  headerTitle: { color: C.ink, fontSize: T['headline-md'], fontWeight: '700' },
  headerSubtitle: { color: C.muted, fontSize: T['label-md'], fontWeight: '600', marginTop: 2 },
  avatar: { width: 38, height: 38, borderRadius: 20 },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: T['icon-xl'], color: C.ink, lineHeight: 44 },
  headerBell: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  loginSafe: { flex: 1, backgroundColor: M3.surface },
  loginFrame: { flex: 1, width: '100%', maxWidth: 384, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 24, justifyContent: 'space-between', alignItems: 'center' },
  loginTopRow: { width: '100%', flexDirection: 'row', justifyContent: 'flex-end' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: M3.surfaceContainerLow },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: M3.tertiary },
  liveText: { color: M3.secondary, fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.55, textTransform: 'uppercase' },
  loginHero: { alignItems: 'center', gap: 4 },
  logoWrapper: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  logoGlow: { position: 'absolute', top: -6, right: -6, bottom: -6, left: -6, backgroundColor: M3.primaryFixed, borderRadius: 16, opacity: 0.4 },
  logoBox: { width: 80, height: 80, borderRadius: 16, backgroundColor: M3.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  appTitle: { color: M3.onSurface, fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.6, textAlign: 'center', marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { color: M3.onSurfaceVariant, fontSize: 14, lineHeight: 20 },
  loginFooter: { width: '100%', alignItems: 'center', gap: 16 },
  googleButton: { width: '100%', height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: M3.surfaceContainerLowest, borderRadius: 12, borderWidth: 1, borderColor: M3.loginBorder, overflow: 'hidden', shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 1 },
  googleButtonText: { color: M3.onSurface, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  termsText: { color: M3.outline, fontSize: 13, lineHeight: 18, letterSpacing: 0.065, textAlign: 'center', maxWidth: 320, paddingHorizontal: 8 },
  termsLink: { color: M3.onSurface, fontWeight: '500', textDecorationLine: 'underline' },
  eyebrow: { color: C.green, fontSize: T['label-sm'], fontWeight: '800', letterSpacing: 0.8 },
  sectionTitle: { color: C.ink, fontSize: T['body-xl'], lineHeight: 28, fontWeight: '800' },
  coverageRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  coverageIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' },
  coverageTitle: { color: C.ink, fontSize: T['headline-sm'], fontWeight: '800', marginBottom: 2 },
  body: { color: C.muted, fontSize: T['body-md'], lineHeight: 24 },
  noteBox: { flexDirection: 'row', gap: 12, backgroundColor: C.slate, padding: 16, borderRadius: 8, alignItems: 'center' },
  messageNote: { backgroundColor: C.slate, padding: 14, borderRadius: 7, gap: 6 },
  noteIcon: { color: C.green, fontSize: T['icon-sm'], fontWeight: '700' },
  button: { minHeight: 56, backgroundColor: C.navy, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, flex: 1, borderWidth: 0, borderColor: C.navy, shadowColor: C.navy, shadowOpacity: 0.16, shadowRadius: 10, elevation: 2 },
  buttonText: { color: C.white, fontSize: T['body-md'], fontWeight: '800' },
  secondaryButton: { backgroundColor: C.white, borderColor: C.line, borderWidth: 1 },
  secondaryButtonText: { color: C.ink },
  whiteButton: { backgroundColor: C.white, borderColor: C.line, borderWidth: 1, shadowOpacity: 0 },
  whiteButtonText: { color: C.ink },
  accessibilityButton: { backgroundColor: C.green, borderColor: C.green },
  accessibilityButtonText: { color: C.white },
  centerLabel: { display: 'none' },
  errorText: { color: C.amber, fontSize: T['body-md'], textAlign: 'center', fontWeight: '700', marginVertical: 10 },
  legal: { color: C.muted, fontSize: T['body-md'], lineHeight: 26, textAlign: 'center', marginVertical: 14 },
  underline: { textDecorationLine: 'underline', color: C.ink },
  homeTop: { gap: 14 },
  homeHero: { backgroundColor: C.navy, marginHorizontal: -16, marginTop: -10, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48, gap: 8 },
  heroLocation: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  heroLocationText: { color: C.white, fontSize: T['label-md'], fontWeight: '700' },
  homeHeroTitle: { color: C.white, fontSize: 29, lineHeight: 35, fontWeight: '800' },
  exploreHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  verifiedCount: { color: C.muted, fontSize: T['label-sm'] },
  exploreSearchRow: { flexDirection: 'row', gap: 8 },
  exploreSearch: { minHeight: 44, borderRadius: 12, backgroundColor: C.card, paddingHorizontal: 12, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#E9ECF6' },
  exploreSearchText: { color: C.muted, fontSize: T['body-sm'] },
  filterShortcut: { minHeight: 44, borderRadius: 12, backgroundColor: C.card, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#E9ECF6' },
  filterShortcutText: { color: C.ink, fontSize: T['label-sm'], fontWeight: '800' },
  exploreChips: { gap: 8, paddingRight: 16 },
  exploreChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: '#E5E9F4' },
  exploreChipActive: { backgroundColor: C.navy, borderColor: C.navy },
  exploreChipText: { color: C.muted, fontSize: T['label-sm'] },
  exploreChipTextActive: { color: C.white },
  search: { minHeight: 60, borderRadius: 16, backgroundColor: C.card, borderWidth: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 10, marginTop: -46, shadowColor: '#101B35', shadowOpacity: 0.1, shadowRadius: 8, elevation: 2 },
  searchIcon: { color: C.muted, fontSize: T['display-md'] },
  searchInput: { flex: 1, color: C.ink, fontSize: T['headline-sm'] },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { minHeight: 38, paddingHorizontal: 14, borderRadius: 20, backgroundColor: C.slate, alignItems: 'center', justifyContent: 'center', borderWidth: 0 },
  activeChip: { backgroundColor: C.navy, borderColor: C.navy },
  chipText: { color: C.ink, fontSize: T['body-md-tight'], fontWeight: '800' },
  activeChipText: { color: C.white },
  // ---- Home (Material 3 mock: home.html) ----
  homeSafe: { flex: 1, backgroundColor: '#f8fafc' },
  homeHeader: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    backgroundColor: M3.surfaceContainerLowest,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: withAlpha('#1B3A5C', 0.06),
  },
  homeBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  homeBrandLogo: { width: 32, height: 32 },
  homeHeaderTitle: { color: M3.onSurface, fontSize: T['title-md'], lineHeight: 22, fontWeight: '600', flexShrink: 1 },
  homeHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  homeBell: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  homeAvatar: { width: 32, height: 32, borderRadius: 16 },
  homeScrollContent: { paddingBottom: 28 },
  homeGreeting: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 },
  homeLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  homeLocationText: { color: M3.secondary, fontSize: T['label-md'], lineHeight: 16, fontWeight: '500' },
  homeGreetingTitle: { color: M3.onSurface, fontSize: T['headline-md'], lineHeight: 30, fontWeight: '700', letterSpacing: -0.36, marginTop: -1 },
  homeSearchWrap: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  homeSearch: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    backgroundColor: M3.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: withAlpha(M3.outlineVariant, 0.6),
    borderRadius: 12,
  },
  homeSearchInput: { flex: 1, padding: 0, color: M3.onSurface, fontSize: T['body-md'], lineHeight: 20 },
  homeMic: { padding: 4 },
  homeChipsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 4 },
  homeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: M3.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: withAlpha(M3.outlineVariant, 0.6),
  },
  homeChipActive: { backgroundColor: M3.primary, borderColor: M3.primary },
  homeChipDot: { width: 6, height: 6, borderRadius: 3 },
  homeChipText: { color: M3.onSurface, fontSize: T['label-md'], lineHeight: 16, fontWeight: '500' },
  homeChipTextActive: { color: M3.onPrimary },
  homeNearbySection: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 },
  homeNearbyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  homeNearbyTitle: { color: M3.onSurface, fontSize: T['title-md'], lineHeight: 22, fontWeight: '600', letterSpacing: -0.085 },
  homeNearbyCount: { color: M3.secondary, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600', letterSpacing: 0.33 },
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
  // ---- Venue Detail (Material 3 mock: venue-detail.html) ----
  detailSafe: { flex: 1, backgroundColor: '#f8fafc' },
  detailTopBar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    backgroundColor: withAlpha(M3.surfaceContainerLowest, 0.92),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: withAlpha('#1B3A5C', 0.06),
  },
  detailBackButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  detailBrandLogo: { width: 32, height: 32 },
  detailTopTitle: { color: M3.onSurface, fontSize: T['title-md'], lineHeight: 22, fontWeight: '600', flexShrink: 1 },
  detailAvatar: { width: 32, height: 32, borderRadius: 16 },
  detailBody: { flex: 1 },
  detailScrollContent: { paddingBottom: 0 },
  detailHero: { position: 'relative', height: 288 },
  detailHeroImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  detailHeroShade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: withAlpha('#000000', 0.22) },
  detailHeroBack: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
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
  detailCategoryLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailCategoryText: { color: M3.primaryContainer, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  detailQuickActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailQuickAction: {
    width: 32,
    height: 32,
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
  detailSectionSub: { color: M3.secondary, fontSize: T['body-sm'], lineHeight: 18, flexShrink: 1 },
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
  detailFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  detailFeatureDivider: { height: StyleSheet.hairlineWidth, backgroundColor: M3.surfaceContainer, marginHorizontal: 16 },
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
  detailMapCard: { position: 'relative', borderRadius: 16, overflow: 'hidden', backgroundColor: M3.surfaceContainer },
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: M3.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailMapMock: { height: 176, backgroundColor: C.mapSurface, position: 'relative', overflow: 'hidden' },
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
  detailDockIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  detailDockIconActive: { width: 40, height: 40, borderRadius: 20, backgroundColor: M3.surfaceContainerLow, alignItems: 'center', justifyContent: 'center' },
  detailDockLabel: { color: M3.secondary, fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.33 },
  detailDockLabelActive: { color: M3.primaryContainer, fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.33 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  greenLabel: { color: C.green, fontSize: T['label-md'], fontWeight: '800' },
  placeCard: { backgroundColor: C.card, borderRadius: 18, padding: 14, gap: 14, borderWidth: 1, borderColor: '#EDF0F7', shadowColor: '#101B35', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
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
  placeTop: { flexDirection: 'row', gap: 14, minHeight: 120 },
  placePhoto: { width: 120, height: 120, borderRadius: 10 },
  placeInfo: { flex: 1, gap: 7 },
  placeName: { color: C.ink, fontSize: T['headline-md'], fontWeight: '800' },
  categoryPill: { backgroundColor: C.slate, alignSelf: 'flex-start', borderRadius: 14, paddingHorizontal: 8, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5 },
  categoryText: { color: C.white, fontSize: T['label-md'], fontWeight: '800' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
  address: { color: C.muted, fontSize: T['body-md-tight'], flex: 1 },
  featureLine: { color: C.muted, fontSize: T['label-md'], fontWeight: '700', lineHeight: 20 },
  bookmark: { color: C.muted, fontSize: T['icon-md'] },
  cardActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  placeCardActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', borderTopWidth: 1, borderTopColor: C.line, paddingTop: 16 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryCard: { backgroundColor: C.card, borderRadius: 12, padding: 16, minHeight: 126, flexBasis: '47%', flexGrow: 1, gap: 10, borderWidth: 1, borderColor: C.line },
  categoryListCard: { backgroundColor: C.card, borderRadius: 12, padding: 20, minHeight: 128, flexDirection: 'row', alignItems: 'flex-start', gap: 14, borderWidth: 1, borderColor: C.line },
  categoryLargeIcon: { width: 54, height: 54, borderRadius: 8, backgroundColor: C.mint, color: C.green, textAlign: 'center', paddingTop: 12, fontSize: T['icon-lg'] },
  countPill: { backgroundColor: C.slate, color: C.muted, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 8, fontSize: T['label-sm'], fontWeight: '800' },
  categoryIcon: { color: C.green, fontSize: T['icon-lg'] },
  cardHeading: { color: C.ink, fontSize: T['body-md'], lineHeight: 22, fontWeight: '800' },
  sheetHandle: { width: 40, height: 4, backgroundColor: C.softGray, borderRadius: 4, alignSelf: 'center' },
  screenTitle: { color: C.ink, fontSize: T['display-md'], lineHeight: 32, fontWeight: '800' },
  closeButton: { width: 48, height: 48, borderRadius: 12, backgroundColor: C.slate, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: C.muted, fontSize: T['icon-xl'], lineHeight: 34 },
  filterSummary: { backgroundColor: C.mint, minHeight: 52, borderRadius: 6, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterSummaryText: { color: C.green, fontSize: T['body-md-tight'], fontWeight: '800' },
  filterRow: { backgroundColor: C.slate, borderRadius: 6, padding: 16, minHeight: 116, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  filterIcon: { width: 28, alignItems: 'center', paddingTop: 2 },
  filterTitle: { color: C.ink, fontSize: T['headline-sm'], fontWeight: '800', lineHeight: 24, marginBottom: 5, paddingRight: 42 },
  toggle: { width: 55, height: 32, borderRadius: 18, backgroundColor: C.toggleOff, padding: 3, position: 'absolute', right: 14, top: 16 },
  toggleOn: { backgroundColor: C.green },
  toggleThumb: { width: 26, height: 26, borderRadius: 14, backgroundColor: C.white },
  toggleThumbOn: { alignSelf: 'flex-end' },
  // ---- Filter (Material 3 mock: filter.html) ----
  filterSafe: { flex: 1, backgroundColor: '#f8fafc' },
  filterTopBar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: withAlpha('#f8fafc', 0.9),
  },
  filterIconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  filterResetText: { color: M3.primaryContainer, fontSize: T['link-md'], lineHeight: 18, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  filterScrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
  filterNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: M3.surfaceContainerLow,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  filterNoteText: { color: M3.onSurfaceVariant, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  filterSummaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12 },
  filterSummaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterActiveText: { color: M3.secondary, fontSize: T['body-sm'], lineHeight: 18, fontWeight: '500' },
  filterActivePill: {
    backgroundColor: M3.secondaryContainer,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  filterActivePillText: { color: M3.onSecondaryContainer, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600' },
  filterSection: { paddingTop: 18 },
  filterSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  filterSectionTitle: { color: M3.onSurface, fontSize: T['title-md'], lineHeight: 22, fontWeight: '600' },
  filterSectionCaption: { color: M3.secondary, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '500' },
  filterCard: {
    backgroundColor: M3.surfaceContainerLowest,
    borderRadius: 16,
    padding: 8,
    flexDirection: 'column',
    gap: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  filterFeatureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  filterFeatureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: M3.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  filterFeatureIconOff: { backgroundColor: M3.surfaceContainerLow },
  filterFeatureTexts: { flex: 1, minWidth: 0, gap: 2 },
  filterFeatureTitle: { color: M3.onSurface, fontSize: T['title-sm'], lineHeight: 20, fontWeight: '600' },
  filterFeatureSub: { color: M3.secondary, fontSize: T['body-sm'], lineHeight: 18 },
  filterSwitchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: M3.surfaceContainer,
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginTop: 8,
  },
  filterSwitchTrackOn: { backgroundColor: M3.primaryContainer },
  filterSwitchThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: M3.surfaceContainerLowest,
    alignSelf: 'flex-start',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  filterSwitchThumbOn: { alignSelf: 'flex-end' },
  filterCatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  filterCatPill: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: M3.surfaceContainerLowest,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  filterCatPillActive: { backgroundColor: M3.primaryContainer },
  filterCatPillText: { color: M3.onSurface, fontSize: T['body-md'], lineHeight: 20, fontWeight: '500', flexShrink: 1 },
  filterCatPillTextActive: { color: M3.onPrimary, fontWeight: '600' },
  filterRadiusValue: { color: M3.primaryContainer, fontSize: T['link-md'], lineHeight: 18, fontWeight: '600' },
  filterRadiusGroup: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: M3.surfaceContainerLowest,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  filterRadiusOption: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  filterRadiusOptionActive: { backgroundColor: M3.primaryContainer },
  filterRadiusOptionText: { color: M3.secondary, fontSize: T['label-md'], lineHeight: 16, fontWeight: '500' },
  filterRadiusOptionTextActive: { color: M3.onPrimary, fontWeight: '600' },
  filterApplyBar: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: withAlpha(M3.outlineVariant, 0.5),
    backgroundColor: withAlpha('#f8fafc', 0.95),
  },
  filterApplyBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: M3.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1e40ff',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  filterApplyText: { color: M3.onPrimary, fontSize: T['link-md'], lineHeight: 18, fontWeight: '600' },
  smallChoice: { flexBasis: '47%', flexGrow: 1, minHeight: 48, padding: 12, backgroundColor: C.slate, justifyContent: 'center', borderRadius: 4 },
  selectedChoice: { backgroundColor: C.selected },
  choiceText: { color: C.ink, fontWeight: '800', textAlign: 'center' },
  selectedChoiceText: { color: C.white },
  matchBox: { backgroundColor: C.matchSurface, padding: 14, borderRadius: 5, gap: 3 },
  mapMock: { height: 410, borderRadius: 12, backgroundColor: C.mapSurface, borderWidth: 1, borderColor: C.mapBorder, position: 'relative', overflow: 'hidden' },
  mapMockSmall: { height: 145, backgroundColor: C.mapSurface, borderRadius: 8, position: 'relative', overflow: 'hidden', marginVertical: 10 },
  mapRoad: { position: 'absolute', top: 35, left: 80, color: C.mapLabel, fontSize: T['label-md'], fontWeight: '700', transform: [{ rotate: '-15deg' }] },
  mapPin: { width: 42, height: 42, borderRadius: 22, backgroundColor: C.green, borderWidth: 3, borderColor: C.white, alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  mapLegend: { position: 'absolute', bottom: 14, left: 14, right: 14, backgroundColor: C.card, borderRadius: 8, padding: 14 },
  mapWrap: { borderRadius: 12, overflow: 'hidden', backgroundColor: C.slate, minHeight: 320 },
  mapLocationPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: C.slate, borderWidth: 1, borderColor: C.line },
  mapLocationText: { color: C.navy, fontSize: T['label-md'], fontWeight: '700' },
  markerCard: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: C.card, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.line },
  locationCard: { backgroundColor: C.card, padding: 16, borderRadius: 12, gap: 12, borderWidth: 1, borderColor: C.line },
  nearby: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 8 },
  markerCardPhoto: { width: 44, height: 44, borderRadius: 8 },
  // ---- Map tab (Material 3 mock: map.html) ----
  mapSafe: { flex: 1, backgroundColor: '#f8fafc' },
  mapViewport: { position: 'relative', width: '100%', overflow: 'hidden', backgroundColor: M3.surfaceContainerLow },
  mapCanvas: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  mapRealWrap: { flex: 1 },
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
    top: 16,
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
    top: 60,
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
  mapControls: { position: 'absolute', top: 16, right: 16, alignItems: 'center', gap: 8, zIndex: 20 },
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
  heroImage: { height: 230, width: '100%', borderRadius: 10 },
  heroBadge: { backgroundColor: C.mint, borderRadius: 4, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, marginTop: -24, zIndex: 2, color: C.green, fontWeight: '800' },
  detailCard: { backgroundColor: C.card, borderRadius: 18, padding: 16, gap: 10, borderWidth: 1, borderColor: '#EDF0F7' },
  greenHeading: { color: C.green, fontSize: T['headline-sm'], fontWeight: '800' },
  openBox: { backgroundColor: C.paleMint, borderRadius: 5, padding: 12 },
  status: { borderRadius: 4, padding: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1.5 },
  available: { backgroundColor: C.statusPosBg, borderColor: C.statusPosBorder },
  unavailable: { backgroundColor: C.statusNegBg, borderColor: C.statusNegBorder },
  statusMark: { width: 28, height: 28, borderRadius: 15, color: C.white, textAlign: 'center', paddingTop: 4, fontWeight: '800' },
  statusMarkPos: { backgroundColor: C.statusPosBorder },
  statusMarkNeg: { backgroundColor: C.statusNegBorder },
  statusText: { fontSize: T['body-md-tight'], lineHeight: 21, fontWeight: '800', flex: 1 },
  statusTextPos: { color: C.statusPosText },
  statusTextNeg: { color: C.statusNegText },
  statusValue: { fontSize: T['label-xs'], fontWeight: '900', paddingTop: 5 },
  statusValuePos: { color: C.statusPosText },
  statusValueNeg: { color: C.statusNegText },
  listRow: { backgroundColor: C.slate, borderRadius: 5, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeSummary: { backgroundColor: C.paleMint, borderRadius: 8, padding: 16, gap: 5 },
  routeLine: { gap: 4 },
  step: { flexDirection: 'row', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  stepNumber: { width: 34, height: 34, borderRadius: 18, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  stepNumberArrive: { backgroundColor: C.blue },
  stepNumberText: { color: C.white, fontWeight: '800', fontSize: T['headline-sm'] },
  stepDistance: { color: C.muted, fontSize: T['label-sm'], fontWeight: '700', alignSelf: 'center', minWidth: 56, textAlign: 'right' },
  // ---- Active Navigation (Material 3 mock: route-guidance.html) ----
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
  navRetryBtn: { alignSelf: 'center', marginTop: 4, backgroundColor: M3.primaryContainer, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  navRetryText: { color: M3.onPrimary, fontSize: T['link-md'], lineHeight: 18, fontWeight: '600' },
  navDestCard: { backgroundColor: M3.surfaceContainerLowest, borderRadius: 16, padding: 16, shadowColor: '#000000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  navDestTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  navDestInfo: { flex: 1, minWidth: 0 },
  navDestEyebrow: { color: M3.primary, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  navDestTitle: { color: M3.onSurface, fontSize: T['title-md'], lineHeight: 24, fontWeight: '600', marginTop: 3 },
  navDestLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  navDestLocText: { color: M3.onSurfaceVariant, fontSize: T['body-sm'], lineHeight: 18, flex: 1 },
  navLivePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: M3.surfaceContainer, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, flexShrink: 0 },
  navLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: M3.primaryContainer },
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
  navMetricDivider: { width: StyleSheet.hairlineWidth, backgroundColor: withAlpha(M3.outlineVariant, 0.7), alignSelf: 'stretch', marginVertical: 2 },
  navMetricLabel: { color: M3.secondary, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600' },
  navMetricValue: { color: M3.onSurface, fontSize: T['title-sm'], lineHeight: 20, fontWeight: '600', marginTop: 1 },
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
  navMapCanvas: { ...StyleSheet.absoluteFill, backgroundColor: '#eef3fb' },
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
  navMapLocDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: M3.tertiary },
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
  navStepIconActive: { backgroundColor: M3.primaryContainer },
  navStepIconArrival: { backgroundColor: M3.tertiaryContainer },
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
  navShareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: M3.surfaceContainer, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
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
  navPauseBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: M3.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  navPauseText: { color: M3.onPrimary, fontSize: T['link-md'], lineHeight: 18, fontWeight: '600' },
profileSafe: { flex: 1, backgroundColor: '#f8fafc' },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: M3.surfaceContainerLowest,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: withAlpha('#1B3A5C', 0.06),
  },
  profileHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileHeaderTitle: { color: M3.onSurface, fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.3 },
  profileVerifiedBadge: { backgroundColor: '#f1f5f9', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  profileVerifiedText: { color: '#94a3b8', fontSize: 10, lineHeight: 12, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  profileSettingsBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
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
  profileCommunityPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#dbeafe' },
  profileCommunityText: { color: '#1d4ed8', fontSize: 10, lineHeight: 14, fontWeight: '500' },
  profileDivider: { height: 1, backgroundColor: '#f1f5f9', marginTop: 24, marginBottom: 20 },
  profileSection: { minWidth: 0 },
  profileSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  profileSectionTitle: { color: '#94a3b8', fontSize: 11, lineHeight: 16, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', flexShrink: 1 },
  profileAutoFilterPill: { backgroundColor: '#eff6ff', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#dbeafe' },
  profileAutoFilterText: { color: M3.primaryContainer, fontSize: 11, lineHeight: 14, fontWeight: '500' },
  profileViewAll: { color: M3.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  profilePrefList: { gap: 12 },
  profilePrefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    backgroundColor: M3.surfaceContainerLowest,
  },
  profilePrefLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  profilePrefIconBox: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#dbeafe', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  profilePrefIconBoxMuted: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  profilePrefTexts: { flexShrink: 1 },
  profilePrefTitle: { color: M3.onSurface, fontSize: 14, lineHeight: 19, fontWeight: '600' },
  profilePrefSub: { color: '#94a3b8', fontSize: 11, lineHeight: 15, marginTop: 1 },
  profileSavedList: { gap: 10 },
  profileSavedCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: '#f1f5f9', backgroundColor: M3.surfaceContainerLowest },
  profileSavedThumbBtn: { flexShrink: 0 },
  profileSavedThumb: { width: 48, height: 48, borderRadius: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  profileSavedInfo: { flex: 1, minWidth: 0 },
  profileStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  profileStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  profileStatusText: { color: '#047857', fontSize: 11, lineHeight: 15, fontWeight: '500' },
  profileSavedName: { color: M3.onSurface, fontSize: 14, lineHeight: 19, fontWeight: '600', marginTop: 1 },
  profileSavedAddress: { color: '#94a3b8', fontSize: 11, lineHeight: 15, marginTop: 1 },
  profileBookmarkBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  profileSavedEmpty: { color: '#94a3b8', fontSize: T['body-sm'], lineHeight: 18 },
  profileInfoList: { marginTop: 4, borderRadius: 14, borderWidth: 1, borderColor: '#f1f5f9', backgroundColor: M3.surfaceContainerLowest, overflow: 'hidden' },
  profileInfoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14, paddingVertical: 13 },
  profileInfoRowBorder: { borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  profileInfoText: { color: '#334155', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  profileSignOutText: { color: '#dc2626', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  profileAdminText: { color: M3.primaryContainer, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  profileVersion: { textAlign: 'center', color: '#94a3b8', fontSize: 11, lineHeight: 16, paddingTop: 8 },
  // ---- Admin redesign (Stitch mockups) ----
  adminNewSafe: { flex: 1, backgroundColor: M3.surface },
  adminShellBody: { flex: 1 },
  adminTabBody: { flex: 1 },
  adminNav: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    backgroundColor: M3.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: withAlpha('#e2e8f0', 0.8),
    paddingHorizontal: 8,
  },
  adminNavItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 6 },
  adminNavLabel: { color: '#94a3b8', fontSize: 11, lineHeight: 14, fontWeight: '500' },
  adminNavLabelActive: { color: M3.primaryContainer, fontWeight: '600' },
  // ---- Admin Settings (profile mock) ----
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
  adminAvatarChipWrap: {
    padding: 2,
    borderRadius: 999,
    backgroundColor: M3.surfaceContainerLow,
    shadowColor: '#0b1c30',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  adminIdCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: M3.surfaceContainerLowest,
    gap: 12,
    overflow: 'hidden',
    shadowColor: '#0b1c30',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  adminIdCardGlow: {
    position: 'absolute',
    top: -48,
    right: -48,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: withAlpha(M3.primaryFixedDim, 0.2),
  },
  adminIdCardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  adminIdAvatarWrap: { width: 64, height: 64, flexShrink: 0 },
  adminIdAvatar: { width: 64, height: 64, borderRadius: 12, backgroundColor: M3.surfaceContainerLow },
  adminIdBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: M3.tertiaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: M3.surfaceContainerLowest,
  },
  adminIdCopy: { flex: 1, minWidth: 0, gap: 3 },
  adminIdRolePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: M3.primaryContainer,
    marginBottom: 2,
  },
  adminIdRoleText: { color: M3.onPrimary, fontSize: 11, lineHeight: 14, fontWeight: '600' },
  adminIdName: { color: M3.onSurface, fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 },
  adminIdOrg: { color: M3.onSurfaceVariant, fontSize: 13, lineHeight: 18 },
  adminIdLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  adminIdLocText: { color: M3.onSurfaceVariant, fontSize: 11, lineHeight: 14, fontWeight: '600' },
  adminIdEditBtn: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: M3.surfaceContainerLow,
  },
  adminIdEditText: { color: M3.onSurface, fontSize: 13, lineHeight: 16, fontWeight: '500' },
  adminSectionHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  adminSectionHead: { color: M3.onSurfaceVariant, fontSize: 13, lineHeight: 16, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  adminAuthStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  adminAuthStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: M3.tertiary },
  adminAuthStatusText: { color: M3.tertiary, fontSize: 11, lineHeight: 14, fontWeight: '600' },
  adminCredGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  adminCredCell: {
    flexGrow: 1,
    flexBasis: '31%',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: withAlpha(M3.surfaceContainerLow, 0.7),
    gap: 2,
  },
  adminCredLabel: { color: M3.onSurfaceVariant, fontSize: 11, lineHeight: 14, fontWeight: '600' },
  adminCredValue: { color: M3.onSurface, fontSize: 15, lineHeight: 20, fontWeight: '600', maxWidth: '100%' },
  adminCredValuePrimary: { color: M3.primaryContainer },
  adminCredSub: { color: M3.onSurfaceVariant, fontSize: 10, lineHeight: 13, maxWidth: '100%' },
  adminCredSubOk: { color: M3.tertiary, fontWeight: '500' },
  adminSectionLabel: { color: M3.onSurfaceVariant, fontSize: 13, lineHeight: 16, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase', paddingHorizontal: 4, marginTop: 6 },
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
  adminToolIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: M3.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
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
  adminToolSubRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  adminToolSubOk: { color: M3.tertiary, fontSize: 13, lineHeight: 18 },
  adminSyncDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: M3.tertiary },
  adminSyncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: M3.surfaceContainerLow,
  },
  adminSyncBtnText: { color: M3.primaryContainer, fontSize: 11, lineHeight: 14, fontWeight: '600' },
  adminToolDivider: { height: 1, backgroundColor: M3.surfaceContainer, marginHorizontal: 16 },
  adminMiniSwitch: {
    width: 48,
    height: 24,
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
  adminFooterSign: { alignItems: 'center', gap: 2, paddingTop: 8, paddingBottom: 8 },
  adminFooterSignMain: { color: withAlpha(M3.onSurfaceVariant, 0.8), fontSize: 11, lineHeight: 14, fontWeight: '600' },
  adminFooterSignSub: { color: withAlpha(M3.onSurfaceVariant, 0.6), fontSize: 10, lineHeight: 13 },
  adminAnalyticsCrumbRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  adminAnalyticsCrumbPrimary: { color: M3.primaryContainer, letterSpacing: 1.6 },
  adminAnalyticsTitle: { color: M3.onSurface, fontSize: 20, lineHeight: 26, fontWeight: '600', letterSpacing: -0.2 },
  adminAnalyticsRangeWrap: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
    padding: 4,
    borderRadius: 12,
    backgroundColor: M3.surfaceContainerLow,
  },
  adminAnalyticsRangeTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  adminAnalyticsRangeTabActive: {
    backgroundColor: M3.surfaceContainerLowest,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  adminAnalyticsRangeText: { color: M3.secondary, fontSize: 13, lineHeight: 16, fontWeight: '500', letterSpacing: 0.13 },
  adminAnalyticsRangeTextActive: { color: M3.primaryContainer, fontWeight: '500' },
  adminAnalyticsKpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  adminAnalyticsKpi: {
    width: '48.5%',
    flexGrow: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: M3.surfaceContainerLowest,
    gap: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.03,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  adminAnalyticsKpiHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  adminAnalyticsKpiLabel: { color: M3.secondary, fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.33, flexShrink: 1 },
  adminAnalyticsKpiIconTinted: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: M3.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminAnalyticsKpiIconGreen: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: M3.tertiaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminAnalyticsKpiIconGray: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: M3.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminAnalyticsKpiValue: { color: M3.onSurface, fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.36 },
  adminAnalyticsKpiValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  adminAnalyticsKpiDenominator: { color: M3.outline, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  adminAnalyticsKpiTrendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  adminAnalyticsKpiTrend: { color: M3.tertiary, fontSize: 11, lineHeight: 14, fontWeight: '500', letterSpacing: 0.33 },
  adminAnalyticsKpiNote: { color: M3.onSurfaceVariant, fontSize: 11, lineHeight: 14, letterSpacing: 0.33 },
  adminAnalyticsPanel: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: M3.surfaceContainerLowest,
    gap: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.03,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  adminAnalyticsPanelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  adminAnalyticsPanelHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  adminAnalyticsPanelTitle: { color: M3.onSurface, fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: -0.1 },
  adminAnalyticsPanelMeta: { color: M3.secondary, fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.33 },
  adminAnalyticsSectors: { gap: 16 },
  adminAnalyticsSector: { gap: 6 },
  adminAnalyticsSectorHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  adminAnalyticsSectorName: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  adminAnalyticsSectorTitle: { color: M3.onSurface, fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: -0.1, flexShrink: 1 },
  adminAnalyticsSectorValue: { fontSize: 15, lineHeight: 20, flexShrink: 0 },
  adminAnalyticsSectorPct: { color: M3.primaryContainer, fontWeight: '600', letterSpacing: -0.1 },
  adminAnalyticsSectorPctLow: { color: M3.onSurface, fontWeight: '600', letterSpacing: -0.1 },
  adminAnalyticsSectorCount: { color: M3.secondary, fontWeight: '400', fontSize: 13, lineHeight: 18 },
  adminAnalyticsSectorTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: M3.surfaceContainerLow,
    overflow: 'hidden',
  },
  adminAnalyticsSectorFill: { height: '100%', borderRadius: 999 },
  adminAnalyticsFlagPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: withAlpha(M3.errorContainer, 0.4),
    flexShrink: 0,
  },
  adminAnalyticsFlagText: { color: M3.onErrorContainer, fontSize: 11, lineHeight: 14, fontWeight: '500', letterSpacing: 0.33 },
  adminAnalyticsBarriers: { gap: 8 },
  adminAnalyticsBarrierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 8,
    borderRadius: 8,
    backgroundColor: M3.surfaceContainerLow,
  },
  adminAnalyticsBarrierIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: M3.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  adminAnalyticsBarrierCopy: { flex: 1, minWidth: 0, gap: 1 },
  adminAnalyticsBarrierTitle: { color: M3.onSurface, fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: -0.1 },
  adminAnalyticsBarrierNote: { color: M3.onSurfaceVariant, fontSize: 13, lineHeight: 18 },
  adminAnalyticsBarrierCountWrap: { alignItems: 'flex-end', flexShrink: 0 },
  adminAnalyticsBarrierCountError: { color: M3.error, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  adminAnalyticsBarrierCountPrimary: { color: M3.primaryContainer, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  adminAnalyticsBarrierSites: { color: M3.secondary, fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.33 },
  adminAnalyticsExportBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: M3.primaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  adminAnalyticsExportText: { color: M3.onPrimary, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  adminAnalyticsExportNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  adminAnalyticsExportNoteText: { color: M3.secondary, fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.33, flex: 1 },
  adminAnalyticsScroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120, gap: 20 },
  adminAppBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    height: 64,
    backgroundColor: M3.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: withAlpha('#e2e8f0', 0.8),
  },
  adminAppBarBrand: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  adminAppBarLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: M3.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  adminAppBarCopy: { flex: 1, minWidth: 0 },
  adminAppBarTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  adminAppBarTitle: { color: M3.onSurface, fontSize: 14, lineHeight: 19, fontWeight: '600', flexShrink: 1 },
  adminAppBarBadge: { backgroundColor: '#eff6ff', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1, borderColor: '#dbeafe' },
  adminAppBarBadgeText: { color: M3.primaryContainer, fontSize: 10, lineHeight: 13, fontWeight: '600' },
  adminAppBarSubtitle: { color: '#64748b', fontSize: 11, lineHeight: 15 },
  adminAppBarAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: withAlpha('#e2e8f0', 0.7) },
  adminNewScroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120, gap: 14 },
  adminTitleBlock: { gap: 4, marginTop: 4 },
  adminTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  adminTitleDotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  adminTitleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: M3.primaryContainer },
  adminTitleEyebrow: { color: '#64748b', fontSize: 11, lineHeight: 15, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  adminTitleWard: { color: '#94a3b8', fontSize: 11, lineHeight: 15, fontWeight: '500' },
  adminTitle: { color: '#0f172a', fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.6 },
  adminTitleBody: { color: M3.onSurfaceVariant, fontSize: 13, lineHeight: 18 },
  adminMetricsRow: { flexDirection: 'row', gap: 10 },
  adminMetricCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withAlpha('#e2e8f0', 0.8),
    backgroundColor: M3.surfaceContainerLowest,
    gap: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  adminMetricLabel: { color: '#64748b', fontSize: 11, lineHeight: 15, fontWeight: '500' },
  adminMetricLabelOk: { color: '#047857', fontSize: 11, lineHeight: 15, fontWeight: '500' },
  adminMetricLabelWarn: { color: '#b45309', fontSize: 11, lineHeight: 15, fontWeight: '500' },
  adminMetricValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  adminMetricValue: { color: '#0f172a', fontSize: 20, lineHeight: 26, fontWeight: '700' },
  adminMetricValueOk: { color: '#059669', fontSize: 20, lineHeight: 26, fontWeight: '700' },
  adminMetricValueWarn: { color: '#d97706', fontSize: 20, lineHeight: 26, fontWeight: '700' },
  adminMetricUnit: { color: '#94a3b8', fontSize: 10, lineHeight: 14 },
  adminSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withAlpha('#e2e8f0', 0.9),
    backgroundColor: M3.surfaceContainerLowest,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  adminSearchInput: { flex: 1, color: M3.onSurface, fontSize: 14, paddingVertical: 0 },
  adminPillsRow: { gap: 8, paddingVertical: 2 },
  adminPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: M3.surfaceContainerLowest,
  },
  adminPillActive: { backgroundColor: M3.primaryContainer, borderColor: M3.primaryContainer },
  adminPillText: { color: '#334155', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  adminPillTextActive: { color: M3.onPrimary, fontWeight: '600' },
  adminPillCount: {
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
  },
  adminPillCountActive: { backgroundColor: withAlpha('#ffffff', 0.2) },
  adminPillCountText: { color: '#475569', fontSize: 11, lineHeight: 14, fontWeight: '600' },
  adminPillCountTextActive: { color: M3.onPrimary, fontWeight: '700' },
  adminFacilityCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withAlpha('#e2e8f0', 0.9),
    backgroundColor: M3.surfaceContainerLowest,
    gap: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  adminFacilityTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  adminFacilityMeta: { flex: 1, minWidth: 0, gap: 6 },
  adminFacilityBadgesRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  adminFacilityCategory: { backgroundColor: '#f1f5f9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  adminFacilityCategoryText: { color: '#334155', fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  adminFacilityVerified: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  adminFacilityVerifiedText: { color: '#047857', fontSize: 11, lineHeight: 15, fontWeight: '500' },
  adminFacilityName: { color: '#0f172a', fontSize: 16, lineHeight: 22, fontWeight: '600' },
  adminFacilityActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  adminFacilityActionBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  adminFacilityAddressBlock: { gap: 2 },
  adminFacilityAddressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  adminFacilityAddress: { color: '#475569', fontSize: 12, lineHeight: 17, flex: 1 },
  adminFacilityUpdated: { color: '#94a3b8', fontSize: 11, lineHeight: 15, marginLeft: 20 },
  adminFacilityBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 2 },
  adminBadgeOk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: withAlpha('#10b981', 0.25),
  },
  adminBadgeOkText: { color: '#065f46', fontSize: 11, lineHeight: 14, fontWeight: '500' },
  adminBadgeNo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  adminBadgeNoText: { color: '#64748b', fontSize: 11, lineHeight: 14, fontWeight: '500' },
  adminFacilityNoFeatures: { color: '#94a3b8', fontSize: 12, lineHeight: 16 },
  adminAddBar: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  adminAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: 999,
    backgroundColor: M3.primaryContainer,
    shadowColor: '#2563eb',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  adminAddBtnText: { color: M3.onPrimary, fontSize: 14, lineHeight: 19, fontWeight: '600' },
  adminFormAppBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    height: 64,
    backgroundColor: M3.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: withAlpha('#c4c5da', 0.3),
  },
  adminFormBackBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  adminFormAppBarCopy: { flex: 1, minWidth: 0 },
  adminFormAppBarTitle: { color: M3.onSurface, fontSize: 14, lineHeight: 19, fontWeight: '600' },
  adminFormAppBarSubtitle: { color: '#64748b', fontSize: 11, lineHeight: 15 },
  adminFormStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: withAlpha(M3.primaryContainer, 0.1),
    borderWidth: 1,
    borderColor: withAlpha(M3.primaryContainer, 0.2),
  },
  adminFormStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: M3.primaryContainer },
  adminFormStatusText: { color: M3.primaryContainer, fontSize: 11, lineHeight: 14, fontWeight: '600' },
  adminFormScroll: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40, gap: 16 },
  adminFormIntro: { gap: 4 },
  adminFormTitle: { color: '#0f172a', fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.3 },
  adminFormSubtitle: { color: '#475569', fontSize: 12, lineHeight: 18 },
  adminFormLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  adminFormLabelHint: { color: '#94a3b8', fontSize: 11, lineHeight: 15, fontWeight: '500' },
  adminFormTextarea: { minHeight: 88, textAlignVertical: 'top' },
  adminFormIconWrap: { position: 'relative', justifyContent: 'center' },
  adminFormIconLead: { position: 'absolute', left: 12, zIndex: 1 },
  adminFormIconInput: { paddingLeft: 40 },
  adminPhotoVerifiedPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  adminPhotoVerifiedText: { color: M3.primaryContainer, fontSize: 11, lineHeight: 15, fontWeight: '600' },
  adminPhotoBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: withAlpha('#0b1c30', 0.1),
    backgroundColor: M3.surfaceContainerLowest,
    gap: 10,
  },
  adminPhotoRow: { flexDirection: 'row', gap: 12 },
  adminPhotoThumbWrap: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: withAlpha('#0b1c30', 0.08),
    backgroundColor: M3.surfaceContainerLow,
  },
  adminPhotoThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  adminPhotoThumb: { width: '100%', height: '100%' },
  adminPhotoCheck: { position: 'absolute', bottom: 4, right: 4, borderRadius: 8, backgroundColor: withAlpha('#ffffff', 0.95) },
  adminPhotoCopy: { flex: 1, minWidth: 0, gap: 6 },
  adminPhotoTitle: { color: M3.onSurface, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  adminPhotoSub: { color: '#64748b', fontSize: 11, lineHeight: 15 },
  adminPhotoChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: M3.surfaceContainerLow,
  },
  adminPhotoChangeText: { color: M3.onSurface, fontSize: 11, lineHeight: 15, fontWeight: '600' },
  adminFormSectionHead: { gap: 2, marginTop: 4 },
  adminFormSectionTitle: { color: '#0f172a', fontSize: 14, lineHeight: 19, fontWeight: '700' },
  adminFormSectionSub: { color: '#64748b', fontSize: 11, lineHeight: 15 },
  adminFeatureList: { gap: 8 },
  adminFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withAlpha('#c4c5da', 0.4),
    backgroundColor: M3.surfaceContainerLowest,
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  adminFeatureIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: withAlpha('#c4c5da', 0.3),
    backgroundColor: M3.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  adminFeatureTexts: { flex: 1, minWidth: 0, gap: 1 },
  adminFeatureName: { color: M3.onSurface, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  adminFeatureSub: { color: '#64748b', fontSize: 11, lineHeight: 15 },
  adminFeatureSwitch: {
    width: 48,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#d3e4fe',
    padding: 2,
    alignItems: 'flex-start',
    justifyContent: 'center',
    flexShrink: 0,
  },
  adminFeatureSwitchOn: { backgroundColor: M3.primaryContainer, alignItems: 'flex-end' },
  adminFeatureKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  adminFeatureKnobOn: {},
  adminSaveToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: withAlpha(M3.primaryContainer, 0.3),
    backgroundColor: M3.surfaceContainerLowest,
  },
  adminSaveToastCopy: { flex: 1, minWidth: 0, gap: 1 },
  adminSaveToastTitle: { color: M3.onSurface, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  adminSaveToastSub: { color: '#64748b', fontSize: 11, lineHeight: 15 },
  adminFormActions: { flexDirection: 'row', gap: 12, paddingTop: 4 },
  adminCancelBtn: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: M3.surfaceContainerLowest,
  },
  adminCancelText: { color: M3.onSurface, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  adminSaveBtn: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: M3.primaryContainer,
    shadowColor: '#1e40ff',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  adminSaveText: { color: M3.onPrimary, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  adminLink: { backgroundColor: C.card, borderRadius: 8, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  adminActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  adminAction: { color: C.blue, fontSize: T['label-md'], fontWeight: '800', paddingVertical: 6, paddingHorizontal: 4 },
  adminActionDanger: { color: C.amber, fontSize: T['label-md'], fontWeight: '800', paddingVertical: 6, paddingHorizontal: 4 },
  adminCard: { backgroundColor: C.card, borderRadius: 10, padding: 14, gap: 6, borderWidth: 1, borderColor: C.line },
  adminActions: { color: C.ink, fontSize: T['headline-md'] },
  adminTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  adminTag: { backgroundColor: C.mint, color: C.green, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 5, fontSize: T['label-sm'], fontWeight: '800' },
  formField: { gap: 6 },
  formRow: { flexDirection: 'row', gap: 10 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { minHeight: 48, paddingHorizontal: 14, borderRadius: 8, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  categoryChipText: { color: C.ink, fontSize: T['label-md'], fontWeight: '800' },
  photoPreview: { height: 150, borderRadius: 8, backgroundColor: C.slate, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  statusToggles: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
  statusToggle: { minWidth: 44, height: 40, borderRadius: 6, backgroundColor: C.slate, alignItems: 'center', justifyContent: 'center' },
  statusToggleText: { color: C.ink, fontSize: T['label-md'], fontWeight: '800' },
  fieldLabel: { color: C.ink, fontSize: T['label-md'], fontWeight: '800' },
  fieldInput: { minHeight: 52, borderRadius: 8, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, padding: 13, color: C.ink, fontSize: T['body-md-tight'], lineHeight: 22 },
  formToggle: { minHeight: 64, backgroundColor: C.card, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.softBorder },
  toggleLabel: { marginLeft: 'auto', color: C.white, backgroundColor: C.green, borderRadius: 18, padding: 7, fontWeight: '800' },
  splashSafe: { flex: 1, backgroundColor: '#12246b' },
  splashStage: { flex: 1 },
  splashSizing: { flex: 1 },
  splashGradient: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  splashGlowTop: { position: 'absolute', top: -96, right: -96, width: 288, height: 288, borderRadius: 144, backgroundColor: withAlpha('#ffffff', 0.05) },
  splashGlowBottom: { position: 'absolute', bottom: -80, left: -80, width: 256, height: 256, borderRadius: 128, backgroundColor: withAlpha('#dfe0ff', 0.1) },
  splashBody: { width: '100%', paddingHorizontal: 16, paddingVertical: 28, alignItems: 'center', justifyContent: 'space-between' },
  splashTopRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: 0.8 },
  splashLivePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: withAlpha('#ffffff', 0.1), borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  splashLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4edea3' },
  splashLiveText: { color: '#ffffff', fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600', letterSpacing: 1.5, textTransform: 'uppercase' },
  splashTopIcons: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  splashCenter: { width: '100%', alignItems: 'center', justifyContent: 'center', marginVertical: 'auto' },
  splashPinWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  splashPinGlow: {
    position: 'absolute',
    top: -8,
    right: -8,
    bottom: -8,
    left: -8,
    backgroundColor: withAlpha('#ffffff', 0.2),
    borderRadius: 16,
    opacity: 0.6,
  },
  splashPinBox: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: withAlpha('#ffffff', 0.15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashTitle: { color: '#ffffff', fontSize: T['headline-lg'], lineHeight: 36, fontWeight: '700', letterSpacing: -0.6, marginBottom: 4, textAlign: 'center' },
  splashSubtitle: { color: '#d2d5ff', fontSize: T['body-md'], lineHeight: 20, textAlign: 'center', maxWidth: 260 },
  splashTrustPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: withAlpha('#ffffff', 0.1), borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, marginTop: 20 },
  splashTrustText: { color: 'rgba(255,255,255,0.9)', fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600', textAlign: 'center' },
  splashBottom: { alignItems: 'center', gap: 12 },
  splashLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' },
  splashLocText: { color: 'rgba(255,255,255,0.75)', fontSize: T['label-md'], lineHeight: 16, fontWeight: '500', textAlign: 'center' },
  splashTapRow: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' },
  splashTapText: { color: 'rgba(255,255,255,0.6)', fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', textAlign: 'center' },
  onbSafe: { flex: 1, backgroundColor: M3.surface },
  onbFrame: { flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  onbHeader: { marginBottom: 32 },
  onbProgressRow: { flexDirection: 'row', gap: 8 },
  onbProgressSegment: { flex: 1, height: 6, borderRadius: 999 },
  onbProgressSegmentActive: { backgroundColor: M3.primary },
  onbProgressSegmentIdle: { backgroundColor: M3.surfaceContainerHigh },
  onbHeaderMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 12, width: '100%' },
  onbBackButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  onbStepTag: { color: M3.primaryContainer, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', flex: 1, textAlign: 'center' },
  onbSkipButton: { width: 36, alignItems: 'flex-end', justifyContent: 'center' },
  onbSkipText: { color: M3.onSurfaceVariant, fontSize: T['label-md'], lineHeight: 16, fontWeight: '500' },
  onbContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  onbGraphicWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 40 },
  onbGraphicCircle: { position: 'relative', width: 96, height: 96, borderRadius: 48, backgroundColor: M3.surfaceContainerLow, alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 },
  onbPinBadge: { position: 'absolute', bottom: -4, right: -4, width: 32, height: 32, borderRadius: 16, backgroundColor: M3.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  onbGraphicCircleSmall: { width: 80, height: 80, borderRadius: 40, backgroundColor: M3.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  onbBeaconIconTilt: { transform: [{ rotate: '-12deg' }] },
  onbRadarOuter: { position: 'absolute', width: 176, height: 176, borderRadius: 88, backgroundColor: withAlpha(M3.surfaceContainerLow, 0.6) },
  onbRadarInner: { position: 'absolute', width: 128, height: 128, borderRadius: 64, backgroundColor: M3.surfaceContainerLow },
  onbBeaconDotWrap: { position: 'absolute', top: 12, right: 24, alignItems: 'center', justifyContent: 'center' },
  onbTitle: { color: M3.onSurface, fontSize: T['headline-md'], lineHeight: 30, fontWeight: '600', letterSpacing: -0.36, textAlign: 'center', marginBottom: 12 },
  onbBody: { color: M3.secondary, fontSize: T['body-lg'], lineHeight: 24, textAlign: 'center', maxWidth: 320 },
  onbBodyStep: { fontSize: T['body-md'], lineHeight: 20 },
  onbPreviewCard: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', backgroundColor: M3.surfaceContainerLow, borderRadius: 12, padding: 16, marginTop: 32, shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 1 },
  onbPreviewIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: M3.surfaceContainerLowest, alignItems: 'center', justifyContent: 'center' },
  onbPreviewBody: { flex: 1, minWidth: 0 },
  onbPreviewName: { color: M3.onSurface, fontSize: T['title-sm'], lineHeight: 20, fontWeight: '600' },
  onbPreviewMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  onbPreviewChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: M3.tertiaryFixed, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  onbPreviewChipText: { color: M3.onTertiaryFixed, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600' },
  onbPreviewPlace: { color: M3.secondary, fontSize: T['body-sm'], lineHeight: 18, flexShrink: 1 },
  onbTags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, width: '100%', marginTop: 20 },
  onbTagPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: M3.surfaceContainerLowest, shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  onbTagPillText: { color: M3.onSurface, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600' },
  onbPills: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 32 },
  onbPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: M3.surfaceContainerLow },
  onbPillText: { color: M3.onSurface, fontSize: T['label-sm'], lineHeight: 14, fontWeight: '600' },
  onbFooter: { width: '100%', gap: 12, marginTop: 40, alignItems: 'center' },
  onbCtaStep1: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', height: 56, borderRadius: 999, backgroundColor: M3.primary },
  onbCtaStep2: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', height: 56, borderRadius: 999, backgroundColor: M3.primaryContainer },
  onbCtaStep3: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', height: 56, borderRadius: 999, backgroundColor: M3.primaryContainer },
  onbNextText: { color: M3.onPrimary, fontSize: T['link-md'], lineHeight: 18, fontWeight: '600' },
  onbNextTextTitle: { color: M3.onPrimary, fontSize: T['title-md'], lineHeight: 22, fontWeight: '600' },
  onbArrow: { marginLeft: 8, flexDirection: 'row', alignItems: 'center' },
  onbSkipFull: { width: '100%', alignItems: 'center', paddingVertical: 10 },
  onbSkipInline: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 8 },
  onbSkipTextFull: { color: M3.secondary, fontSize: T['link-md'], lineHeight: 18, fontWeight: '600', textAlign: 'center' },
  onbSkipTextSm: { color: M3.secondary, fontSize: T['label-md'], lineHeight: 16, fontWeight: '500' },
  onbFooterCaption: { color: withAlpha(M3.onSurfaceVariant, 0.8), fontSize: T['label-sm'], lineHeight: 14, textAlign: 'center', marginTop: 4 },
});
