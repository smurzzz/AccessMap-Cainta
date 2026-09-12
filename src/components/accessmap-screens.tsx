import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import { useClerk, useSSO, useUser } from '@clerk/clerk-expo';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import OSMMap from '@/components/osm-map';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useEffect, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
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
  Ellipse,
  G,
  LinearGradient,
  Path,
  Pattern,
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
    graphic: 'checklist',
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

function OnboardGraphic({ type }: { type: 'pin' | 'checklist' | 'beacon' }) {
  if (type === 'checklist') {
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
  const trimmed = query.trim().toLowerCase();
  const visible = places.filter((place) => {
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
  const [toggles, setToggles] = useState([true, true, false, true, true]);
  const [category, setCategory] = useState<PlaceCategory | 'all'>('all');
  const [radiusKm, setRadiusKm] = useState<number | null>(3);
  const activeCount = toggles.filter(Boolean).length;

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

  const reset = () => {
    setToggles([true, true, false, true, true]);
    setCategory('all');
    setRadiusKm(3);
  };

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
            {filterFeatures.map((feature, index) => {
              const active = toggles[index];
              return (
                <Pressable
                  key={feature.type}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`Toggle ${feature.title}`}
                  style={styles.filterFeatureRow}
                  onPress={() => setToggles((current) => current.map((value, i) => (i === index ? !value : value)))}
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
              const active = category === item.value;
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Show ${item.label}`}
                  style={[styles.filterCatPill, active && styles.filterCatPillActive]}
                  onPress={() => setCategory(item.value)}
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
            <Text style={styles.filterRadiusValue}>{radiusKm === null ? 'Any radius' : `Within ${radiusKm} km`}</Text>
          </View>
          <View style={styles.filterRadiusGroup}>
            {radiusOptions.map((option) => {
              const active = radiusKm === option.value;
              return (
                <Pressable
                  key={option.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.filterRadiusOption, active && styles.filterRadiusOptionActive]}
                  onPress={() => setRadiusKm(option.value)}
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
        <Pressable style={styles.filterApplyBtn} onPress={() => router.push(tabsRoute)} accessibilityRole="button">
          <Text style={styles.filterApplyText}>Apply Filters</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export function ExploreScreen() {
  const [activeCategory, setActiveCategory] = useState<PlaceCategory | null>(null);
  const { places, loading, error } = usePlaces(activeCategory ?? undefined);
  const categories: { label: string; value: PlaceCategory | null }[] = [
    { label: 'All', value: null },
    { label: 'Health Centers', value: 'health_center' },
    { label: 'Hospitals', value: 'hospital' },
    { label: 'Civic Offices', value: 'government' },
  ];

return (
    <Screen>
      <View style={styles.exploreHeading}>
        <Text style={styles.screenTitle}>Explore Places</Text>
        <Text style={styles.verifiedCount}>{loading ? 'Loading' : `${places.length} verified`}</Text>
      </View>
      <View style={styles.exploreSearchRow}>
        <View style={styles.exploreSearch}><AppIcon name="magnify" size={20} color={C.muted} /><Text style={styles.exploreSearchText}>Search places, facilities...</Text></View>
        <Pressable style={styles.filterShortcut} onPress={() => router.push('/(tabs)/filter')}><AppIcon name="tune-variant" size={20} color={C.navy} /><Text style={styles.filterShortcutText}>Filter</Text></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.exploreChips}>
        {categories.map((category) => <Pressable key={category.label} onPress={() => setActiveCategory(category.value)} style={[styles.exploreChip, activeCategory === category.value && styles.exploreChipActive]}><Text style={[styles.exploreChipText, activeCategory === category.value && styles.exploreChipTextActive]}>{category.label}</Text></Pressable>)}
      </ScrollView>
      {error ? <EmptyState title="Could not load facilities" message={error} /> : null}
      {loading ? <LoadingState label="Finding verified places…" /> : null}
      {!loading && !error ? places.map((place) => <PlaceCard key={place.id} place={place} featured />) : null}
    </Screen>
  );
}

function VectorMapCanvas() {
  return (
    <View style={styles.mapCanvas} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 400 700" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="routeGradient" x1="0%" x2="100%" y1="0%" y2="100%">
            <Stop offset="0%" stopColor="#1e40ff" />
            <Stop offset="100%" stopColor="#0028d2" />
          </LinearGradient>
          <Pattern id="streetGrid" width="120" height="120" patternUnits="userSpaceOnUse">
            <Path d="M 120 0 L 0 0 0 120" fill="none" opacity={0.6} stroke="#dce9ff" strokeWidth={1} />
          </Pattern>
        </Defs>
        <Rect width="400" height="700" fill="#eff4ff" />
        <Rect width="400" height="700" fill="url(#streetGrid)" />
        <Path d="M-20 80 Q 40 60 70 110 T 30 190 T -30 160 Z" fill="#d3e4fe" opacity={0.45} />
        <Path d="M290 280 C 340 260, 390 310, 420 330 L 420 440 C 370 410, 320 420, 280 370 Z" fill="#d3e4fe" opacity={0.45} />
        <G stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M -20 180 C 90 190, 160 210, 420 230" strokeWidth={12} />
          <Path d="M 80 -20 L 110 320 L 140 720" strokeWidth={14} />
          <Path d="M 270 -20 L 250 280 L 220 720" strokeWidth={10} />
          <Path d="M -10 460 C 120 450, 240 480, 420 510" strokeWidth={11} />
          <Path d="M -20 620 L 420 580" strokeWidth={8} />
          <Path d="M 0 60 L 400 90" opacity={0.9} strokeWidth={5} />
          <Path d="M 20 340 L 380 320" opacity={0.9} strokeWidth={6} />
          <Path d="M 110 320 L 250 280" opacity={0.9} strokeWidth={6} />
          <Path d="M 180 140 L 260 210" opacity={0.8} strokeWidth={4} />
          <Path d="M 30 400 L 230 430" opacity={0.8} strokeWidth={4.5} />
        </G>
        <G fill="none" opacity={0.8} stroke="#dce9ff" strokeWidth={1}>
          <Path d="M -20 174 C 90 184, 160 204, 420 224" />
          <Path d="M -20 186 C 90 196, 160 216, 420 236" />
          <Path d="M 73 -20 L 103 320 L 133 720" />
          <Path d="M 87 -20 L 117 320 L 147 720" />
        </G>
        <SvgText transform="rotate(3 12 174)" x="12" y="174" fill="#565e74" fontSize={11} fontWeight="600" letterSpacing={0.8}>ORTIGAS AVE EXT</SvgText>
        <SvgText transform="rotate(78 118 120)" x="118" y="120" fill="#565e74" fontSize={10} fontWeight="600" letterSpacing={0.8}>A. BONIFACIO AVE</SvgText>
        <SvgText transform="rotate(5 28 453)" x="28" y="453" fill="#565e74" fontSize={10} fontWeight="600" letterSpacing={0.8}>FELIX AVE / SAN ISIDRO</SvgText>
        <G opacity={0.8}>
          <Circle cx={95} cy={140} r={3.5} fill="#565e74" />
          <Circle cx={260} cy={380} r={3} fill="#565e74" />
          <Circle cx={170} cy={445} r={3} fill="#565e74" />
        </G>
        <G stroke="url(#routeGradient)" strokeLinecap="round" strokeLinejoin="round" strokeWidth={6} fill="none" fillOpacity={0}>
          <Path d="M 105 520 L 122 458 L 110 320 L 195 304 L 246 295 L 248 244" />
        </G>
        <Path d="M 105 520 L 122 458 L 110 320 L 195 304 L 246 295 L 248 244" fill="none" stroke="#bcc3ff" strokeDasharray="8 8" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        <G transform="translate(248, 240)">
          <Ellipse cx={0} cy={4} rx={8} ry={3.5} fill="#0b1c30" opacity={0.18} />
          <Path d="M 0 -22 C -8 -22 -14 -16 -14 -8 C -14 3 0 10 0 10 C 0 10 14 3 14 -8 C 14 -16 8 -22 0 -22 Z" fill="#0028d2" />
          <Circle cx={0} cy={-9} r={5} fill="#ffffff" />
          <Circle cx={0} cy={-9} r={2.5} fill="#1e40ff" />
        </G>
      </Svg>
    </View>
  );
}

export function MapScreen() {
  const params = useLocalSearchParams<{ place?: string }>();
  const { places, loading, error } = usePlaces();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [tappedPlaceId, setTappedPlaceId] = useState<string | null>(params.place ?? null);
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});
  const activePlaceId = params.place ?? tappedPlaceId ?? (places[0]?.id ?? null);
  const activePlace = places.find((place) => place.id === activePlaceId) ?? null;
  const mapHeight = Math.max(240, height - insets.top - insets.bottom - 68);

  const toggleSaved = (id: string) => setSavedIds((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <View style={styles.mapSafe}>
      {/* Map viewport */}
      <View style={[styles.mapViewport, { height: mapHeight }]}>
        {Platform.OS === 'web' ? (
          <VectorMapCanvas />
        ) : (
          <View style={styles.mapRealWrap}>
            {!error && loading ? <LoadingState label="Loading facilities…" /> : null}
            {!error && !loading && places.length > 0 ? (
              <OSMMap
                pins={places.map((place) => ({ id: place.id, latitude: place.latitude, longitude: place.longitude, title: place.name }))}
                focus={activePlace ? { latitude: activePlace.latitude, longitude: activePlace.longitude } : undefined}
                bounds={SAN_ISIDRO_BOUNDS}
                height={mapHeight}
                onPinPress={(id) => setTappedPlaceId(id)}
              />
            ) : null}
          </View>
        )}

        {error ? <View style={styles.mapOverlayCenter}><EmptyState title="Could not load facilities" message={error} /></View> : null}

        {/* Quick Location Badge (top-left) */}
        <View style={styles.mapLocBadge} pointerEvents="none">
          <AppIcon name="navigation" size={16} color={M3.primaryContainer} />
          <Text style={styles.mapLocBadgeText}>San Isidro, Cainta</Text>
        </View>

        {/* Top-right controls */}
        <View style={styles.mapControls}>
          <View style={styles.mapZoomGroup}>
            <Pressable style={styles.mapControlBtn} accessibilityLabel="Zoom In">
              <AppIcon name="plus" size={20} color={M3.onSurface} />
            </Pressable>
            <View style={styles.mapControlDivider} />
            <Pressable style={styles.mapControlBtn} accessibilityLabel="Zoom Out">
              <AppIcon name="minus" size={20} color={M3.onSurface} />
            </Pressable>
          </View>
          <Pressable style={styles.mapControlReticle} accessibilityLabel="Recenter Current Location">
            <AppIcon name="crosshairs-gps" size={22} color={M3.primaryContainer} />
          </Pressable>
          <Pressable style={styles.mapControlLayer} accessibilityLabel="Toggle Accessibility Layers">
            <AppIcon name="human-wheelchair" size={20} color={M3.secondary} />
          </Pressable>
        </View>

        {/* Pulsing current location marker (web mock only) */}
        {Platform.OS === 'web' ? (
          <View style={styles.mapPulseWrap} pointerEvents="none">
            <View style={styles.mapPulseRing} />
            <View style={styles.mapPulseRingSmall} />
            <View style={styles.mapPulseCore}><View style={styles.mapPulseDot} /></View>
          </View>
        ) : null}

        {/* Floating bottom card */}
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
                    const tail = (activePlace.address ?? '').split(',').map((part) => part.trim()).filter(Boolean).slice(-2).join(', ');
                    return tail ? `• ${tail}` : '• San Isidro, Cainta';
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

  const features = place?.accessibility_features ?? [];
  const availableCount = features.filter((feature) => feature.status === 'available').length;

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
                  <Pressable style={styles.detailQuickAction} accessibilityLabel="Share location">
                    <AppIcon name="share-variant" size={18} color={M3.secondary} />
                  </Pressable>
                  <Pressable style={styles.detailQuickAction} accessibilityLabel="Save location">
                    <AppIcon name="bookmark-outline" size={18} color={M3.secondary} />
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
              <View style={styles.detailSection}>
                <View style={styles.detailSectionHeader}>
                  <Text style={styles.detailSectionTitle}>Location</Text>
                  <Text style={styles.detailSectionSub}>{place.address}</Text>
                </View>
                <View style={styles.detailMapCard}>
                  {Platform.OS === 'web' ? (
                    <View style={styles.detailMapMock}>
                      <Text style={styles.mapRoad}>CAINTA</Text>
                      <Text style={[styles.mapRoad, { top: 60, left: 45 }]}>PAROLA ST.</Text>
                      <View style={[styles.mapPin, { top: 65, left: 140 }]}><Text>⊞</Text></View>
                    </View>
                  ) : (
                    <OSMMap pins={[{ id: place.id, latitude: place.latitude, longitude: place.longitude, title: place.name }]} focus={{ latitude: place.latitude, longitude: place.longitude }} height={176} />
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
          <View style={styles.detailBottomBar}>
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
          {Platform.OS === 'web' || stepsData.length === 0 ? (
            <VectorRouteCanvas />
          ) : (
            <OSMMap
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
            <Pressable style={styles.navMapReticleBtn} accessibilityLabel="Recenter navigation" accessibilityRole="button">
              <AppIcon name="crosshairs-gps" size={20} color={M3.primaryContainer} />
            </Pressable>
            <View style={styles.navMapZoomGroup} >
              <Pressable style={styles.navMapZoomBtn} accessibilityLabel="Zoom in" accessibilityRole="button">
                <AppIcon name="plus" size={18} color={M3.onSurface} />
              </Pressable>
              <View style={styles.navMapZoomDivider} />
              <Pressable style={styles.navMapZoomBtn} accessibilityLabel="Zoom out" accessibilityRole="button">
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
  const [prefs, setPrefs] = useState({ ramp: true, restroom: true, elevator: false });

  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Civic contributor';
  const email = user?.emailAddresses?.[0]?.emailAddress;
  const avatar = user?.imageUrl ? { uri: user.imageUrl } : photos.avatar;

  const named = ['Cainta Municipal Hall Annex', 'San Isidro Health Center'];
  const savedList = named.map((name) => places.find((place) => place.name === name)).filter((place): place is Place => !!place);
  const savedPlaces = savedList.length > 0 ? savedList : places.slice(0, 2);

  const onSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.warn('Sign out failed', error);
    }
  };

  const togglePref = (key: 'ramp' | 'restroom' | 'elevator') => setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <SafeAreaView style={styles.profileSafe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.profileScrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile header / user card */}
        <View style={styles.profileUserRow}>
          <View style={styles.profileAvatarWrap}>
            <Image source={avatar} style={styles.profileAvatar} contentFit="cover" />
            <View style={styles.profileOnlineDot} />
          </View>
          <View style={styles.profileUserInfo}>
            <View style={styles.profileNameRow}>
              <Text style={styles.profileName} numberOfLines={1}>{userName}</Text>
              <Pressable onPress={() => router.push(tabsRoute)} hitSlop={6}>
                <Text style={styles.profileEditLink}>Edit profile</Text>
              </Pressable>
            </View>
            <Text style={styles.profileEmail} numberOfLines={1}>{email ?? 'Signed in with your account'}</Text>
            <View style={styles.profileMetaRow}>
              <View style={styles.profileLocRow}>
                <AppIcon name="map-marker" size={10} color={M3.outlineVariant} />
                <Text style={styles.profileLocText}>San Isidro, Cainta</Text>
              </View>
              <Text style={styles.profileMetaSep}>•</Text>
              <View style={styles.profileCommunityPill}>
                <Text style={styles.profileCommunityText}>{isAdmin ? 'Administrator' : 'Community'}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.profileDivider} />

        {/* Accessibility Preferences */}
        <View style={styles.profileSection}>
          <View style={styles.profileSectionHeader}>
            <Text style={styles.profileSectionTitle}>Accessibility Preferences</Text>
            <Text style={styles.profileSectionHint}>Auto-filter</Text>
          </View>
          <View style={styles.profilePrefList}>
            <View style={styles.profilePrefRow}>
              <View style={styles.profilePrefLeft}>
                <View style={styles.profilePrefIconBox}>
                  <AppIcon name="human-wheelchair" size={16} color={M3.onSurface} />
                </View>
                <View style={styles.profilePrefTexts}>
                  <Text style={styles.profilePrefTitle}>Step-Free / Ramp Priority</Text>
                  <Text style={styles.profilePrefSub}>Prioritize ramps & level paths</Text>
                </View>
              </View>
              <Switch
                value={prefs.ramp}
                onValueChange={() => togglePref('ramp')}
                trackColor={{ false: '#e2e8f0', true: '#1e40ff' }}
                thumbColor="#ffffff"
                ios_backgroundColor="#e2e8f0"
              />
            </View>
            <View style={styles.profilePrefRow}>
              <View style={styles.profilePrefLeft}>
                <View style={styles.profilePrefIconBox}>
                  <AppIcon name="toilet" size={16} color={M3.onSurface} />
                </View>
                <View style={styles.profilePrefTexts}>
                  <Text style={styles.profilePrefTitle}>Accessible Restroom</Text>
                  <Text style={styles.profilePrefSub}>Grab rails & wide doorways</Text>
                </View>
              </View>
              <Switch
                value={prefs.restroom}
                onValueChange={() => togglePref('restroom')}
                trackColor={{ false: '#e2e8f0', true: '#1e40ff' }}
                thumbColor="#ffffff"
                ios_backgroundColor="#e2e8f0"
              />
            </View>
            <View style={styles.profilePrefRow}>
              <View style={styles.profilePrefLeft}>
                <View style={styles.profilePrefIconBox}>
                  <AppIcon name="elevator" size={16} color={M3.onSurface} />
                </View>
                <View style={styles.profilePrefTexts}>
                  <Text style={styles.profilePrefTitle}>Elevator Required</Text>
                  <Text style={styles.profilePrefSub}>For multi-story structures</Text>
                </View>
              </View>
              <Switch
                value={prefs.elevator}
                onValueChange={() => togglePref('elevator')}
                trackColor={{ false: '#e2e8f0', true: '#1e40ff' }}
                thumbColor="#ffffff"
                ios_backgroundColor="#e2e8f0"
              />
            </View>
          </View>
        </View>

        <View style={styles.profileDivider} />

        {/* Saved Places */}
        <View style={styles.profileSection}>
          <View style={styles.profileSectionHeader}>
            <Text style={styles.profileSectionTitle}>Saved Places</Text>
            <Pressable onPress={() => router.push(tabsRoute)} hitSlop={6}>
              <Text style={styles.profileViewAll}>View all ({savedPlaces.length})</Text>
            </Pressable>
          </View>
          <View style={styles.profileSavedList}>
            {savedPlaces.map((place) => (
              <View style={styles.profileSavedCard} key={place.id}>
                <Image source={photoSource(place)} style={styles.profileSavedThumb} contentFit="cover" />
                <View style={styles.profileSavedInfo}>
                  <View style={styles.profileStatusRow}>
                    <View style={styles.profileStatusDot} />
                    <Text style={styles.profileStatusText}>Available</Text>
                  </View>
                  <Text style={styles.profileSavedName} numberOfLines={1}>{place.name}</Text>
                  <Text style={styles.profileSavedAddress} numberOfLines={1}>{place.address}</Text>
                </View>
                <Pressable style={styles.profileBookmarkBtn} accessibilityLabel="Bookmarked" hitSlop={6}>
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
            <Pressable style={styles.profileInfoRow}>
              <Text style={styles.profileInfoText}>About AccessMap</Text>
              <AppIcon name="chevron-right" size={12} color={M3.outlineVariant} />
            </Pressable>
            <Pressable style={[styles.profileInfoRow, styles.profileInfoRowBorder]}>
              <Text style={styles.profileInfoText}>Privacy & Terms</Text>
              <AppIcon name="chevron-right" size={12} color={M3.outlineVariant} />
            </Pressable>
            <Pressable style={[styles.profileInfoRow, styles.profileInfoRowBorder]} onPress={onSignOut}>
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

export function AdminDashboardScreen() {
  const authed = useAuthedSupabase();
  const { places, loading, error, reload } = usePlaces();
  const [deleting, setDeleting] = useState<string | null>(null);

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

  return (
    <Screen>
      <Header title="Administrative Console" back />
      <Text style={styles.eyebrow}>ADMIN FACILITY REGISTRY</Text>
      <Text style={styles.screenTitle}>Facility Directory</Text>
      <Text style={styles.body}>Manage and maintain field-verified physical accessibility listings for civic public services.</Text>
      {error ? <EmptyState title="Could not load facilities" message={error} /> : null}
      {!error && loading ? <LoadingState label="Loading facility directory…" /> : null}
      {!error && !loading && places.length === 0 ? <EmptyState message="No facilities are registered yet. Add the first one below." /> : null}
      {!error && !loading
        ? places.map((place) => (
          <View style={styles.adminCard} key={place.id}>
            <View style={styles.rowBetween}>
              <Text style={styles.eyebrow}>{CATEGORY_SHORT_LABELS[place.category].toUpperCase()}</Text>
              <View style={styles.adminActionsRow}>
                <Text style={styles.adminAction} onPress={() => router.push({ pathname: '/admin/place-form', params: { id: place.id } })}>✎  Edit</Text>
                {deleting === place.id ? (
                  <ActivityIndicator size="small" color={C.green} />
                ) : (
                  <Text style={styles.adminActionDanger} onPress={() => confirmDelete(place)}>✕  Delete</Text>
                )}
              </View>
            </View>
            <Text style={styles.cardHeading}>{place.name}</Text>
            <Text style={styles.body}>⌖  {place.address ?? 'Address not set'}</Text>
            <Text style={styles.body}>Updated {new Date(place.updated_at).toLocaleDateString()}</Text>
            <View style={styles.adminTags}>
              {(place.accessibility_features ?? [])
                .filter((feature) => feature.status === 'available')
                .map((feature) => <Text style={styles.adminTag} key={feature.id}>✓ {FEATURE_LABELS[feature.feature_type]}</Text>)}
            </View>
          </View>
        ))
        : null}
      <Button onPress={() => router.push('/admin/place-form')}>＋  Add New Place</Button>
    </Screen>
  );
}

type PhotoAsset = { uri: string; fileName?: string | null; mimeType?: string | null };

const DEFAULT_FEATURES: Record<FeatureType, AccessibilityStatus> = {
  ramp: 'unavailable',
  restroom: 'unavailable',
  elevator: 'unavailable',
  parking: 'unavailable',
  entrance: 'unavailable',
  other: 'unavailable',
};

const STATUS_OPTIONS: AccessibilityStatus[] = ['available', 'not_available', 'unavailable'];

const STATUS_GLYPH: Record<AccessibilityStatus, string> = {
  available: '✓',
  not_available: '×',
  unavailable: '—',
};

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
      <Screen>
        <Header title="Administrative Console" back />
        <LoadingState label="Loading facility…" />
      </Screen>
    );
  }

  if (isEdit && !place) {
    return (
      <Screen>
        <Header title="Administrative Console" back />
        <EmptyState title="Facility not found" message="This facility could not be loaded." />
      </Screen>
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
      router.replace('/admin');
    } catch (saveError) {
      console.warn('Save failed', saveError);
      Alert.alert('Save failed', 'Could not save the facility. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Header title="Administrative Console" back />
      <View style={styles.rowBetween}><Text style={styles.eyebrow}>ADMIN FACILITY REGISTRY</Text><Text style={styles.greenLabel}>Verified Mode</Text></View>
      <Text style={styles.screenTitle}>{isEdit ? 'Edit Public Facility' : 'Add New Facility'}</Text>
      <Text style={styles.body}>Register physical accessibility features for San Isidro facilities with strict civic accuracy.</Text>

      <View style={styles.formField}><Text style={styles.fieldLabel}>Place Name *</Text><TextInput value={name} onChangeText={setName} placeholder="e.g. San Isidro Barangay Health Center" style={styles.fieldInput} /></View>

      <View style={styles.formField}>
        <Text style={styles.fieldLabel}>Facility Category *</Text>
        <View style={styles.chipsWrap}>
          {CATEGORY_ORDER.map((item) => (
            <Pressable key={item} style={[styles.categoryChip, category === item && styles.activeChip]} onPress={() => setCategory(item)}>
              <Text style={[styles.categoryChipText, category === item && styles.activeChipText]}>{CATEGORY_SHORT_LABELS[item]}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.formField}><Text style={styles.fieldLabel}>Description & Navigational Context</Text><TextInput value={description} onChangeText={setDescription} multiline placeholder="Physical accessibility context" style={styles.fieldInput} /></View>
      <View style={styles.formField}><Text style={styles.fieldLabel}>Physical Address</Text><TextInput value={address} onChangeText={setAddress} placeholder="Street, Barangay San Isidro, Cainta" style={styles.fieldInput} /></View>
      <View style={styles.formRow}>
        <View style={[styles.formField, styles.flex]}><Text style={styles.fieldLabel}>Latitude *</Text><TextInput value={latitude} onChangeText={setLatitude} keyboardType="decimal-pad" placeholder="14.5…" style={styles.fieldInput} /></View>
        <View style={[styles.formField, styles.flex]}><Text style={styles.fieldLabel}>Longitude *</Text><TextInput value={longitude} onChangeText={setLongitude} keyboardType="decimal-pad" placeholder="121.1…" style={styles.fieldInput} /></View>
      </View>
      <View style={styles.formField}><Text style={styles.fieldLabel}>Operating Hours</Text><TextInput value={operatingHours} onChangeText={setOperatingHours} placeholder="e.g. Mon–Fri 8AM–5PM" style={styles.fieldInput} /></View>

      <View style={styles.formField}>
        <Text style={styles.fieldLabel}>Entrance Photo Upload</Text>
        {previewUri ? <Image source={{ uri: previewUri }} style={styles.photoPreview} contentFit="cover" /> : <View style={styles.photoPreview}><Text style={styles.body}>No photo selected</Text></View>}
        <Button secondary onPress={pickPhoto}>{photo ? 'Replace Photo' : '＋  Choose Photo'}</Button>
      </View>

      <Text style={styles.sectionTitle}>Verified Accessibility Features</Text>
      <Text style={styles.body}>Strict physical binary-state indicators. No percentages or speculative scores.</Text>
      {FEATURE_ORDER.map((featureType) => (
        <View style={styles.formToggle} key={featureType}>
          <View style={styles.coverageIcon}><AppIcon name={featureIcon[featureType]} size={22} color={C.green} /></View>
          <Text style={[styles.cardHeading, styles.flex, { lineHeight: 22 }]}>{FEATURE_LABELS[featureType]}</Text>
          <View style={styles.statusToggles}>
            {STATUS_OPTIONS.map((status) => (
              <Pressable
                key={status}
                style={[styles.statusToggle, features[featureType] === status && styles.selectedChoice]}
                onPress={() => setFeatureStatus(featureType, status)}
                accessibilityLabel={`${FEATURE_LABELS[featureType]} ${status.replace('_', ' ')}`}
              >
                <Text style={[styles.statusToggleText, features[featureType] === status && styles.selectedChoiceText]}>{STATUS_GLYPH[status]}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      <View style={styles.cardActions}>
        <Button secondary onPress={() => router.back()}>×  Cancel</Button>
        <Button onPress={save}>{saving ? <ActivityIndicator size="small" color={C.white} /> : '▣  Save Facility'}</Button>
      </View>
    </Screen>
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
  detailScrollContent: { paddingBottom: 170 },
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
  mapLocBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: withAlpha(M3.surfaceContainerLowest, 0.95),
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
    zIndex: 10,
  },
  mapLocBadgeText: { color: M3.onSurface, fontSize: T['label-md'], lineHeight: 16, fontWeight: '500' },
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
  mapPulseWrap: {
    position: 'absolute',
    left: 105,
    top: 520,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  mapPulseRing: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: withAlpha(M3.primaryContainer, 0.2),
  },
  mapPulseRingSmall: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: withAlpha(M3.primaryContainer, 0.3),
  },
  mapPulseCore: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: M3.surfaceContainerLowest,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPulseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: M3.primaryContainer },
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
  profileSettingsBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  profileScrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  profileUserRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  profileAvatarWrap: { position: 'relative', width: 64, height: 64, flexShrink: 0 },
  profileAvatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: '#f1f5f9' },
  profileOnlineDot: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#10b981', borderWidth: 2, borderColor: '#ffffff' },
  profileUserInfo: { flex: 1, minWidth: 0, paddingTop: 2 },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  profileName: { color: M3.onSurface, fontSize: 18, lineHeight: 24, fontWeight: '700', flexShrink: 1 },
  profileEditLink: { color: M3.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  profileEmail: { color: M3.secondary, fontSize: T['body-sm'], lineHeight: 18, marginTop: 2 },
  profileMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, minWidth: 0 },
  profileLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  profileLocText: { color: M3.secondary, fontSize: T['label-sm'], lineHeight: 16, fontWeight: '500' },
  profileMetaSep: { color: M3.outlineVariant, fontSize: 12, lineHeight: 16 },
  profileCommunityPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#dbeafe' },
  profileCommunityText: { color: '#1d4ed8', fontSize: 10, lineHeight: 14, fontWeight: '500' },
  profileDivider: { height: 1, backgroundColor: '#f1f5f9', marginTop: 20, marginBottom: 18 },
  profileSection: { minWidth: 0 },
  profileSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  profileSectionTitle: { color: '#94a3b8', fontSize: 11, lineHeight: 16, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  profileSectionHint: { color: '#94a3b8', fontSize: 11, lineHeight: 16 },
  profileViewAll: { color: M3.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '500' },
  profilePrefList: { gap: 16 },
  profilePrefRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  profilePrefLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  profilePrefIconBox: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  profilePrefTexts: { flexShrink: 1 },
  profilePrefTitle: { color: M3.onSurface, fontSize: T['title-sm'], lineHeight: 20, fontWeight: '500' },
  profilePrefSub: { color: '#94a3b8', fontSize: 11, lineHeight: 15, marginTop: 1 },
  profileSavedList: { gap: 10 },
  profileSavedCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9', backgroundColor: M3.surfaceContainerLowest },
  profileSavedThumb: { width: 48, height: 48, borderRadius: 8, borderWidth: 1, borderColor: '#f1f5f9', flexShrink: 0 },
  profileSavedInfo: { flex: 1, minWidth: 0 },
  profileStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  profileStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  profileStatusText: { color: '#047857', fontSize: 11, lineHeight: 15, fontWeight: '500' },
  profileSavedName: { color: M3.onSurface, fontSize: T['title-sm'], lineHeight: 20, fontWeight: '600', marginTop: 1 },
  profileSavedAddress: { color: '#94a3b8', fontSize: 11, lineHeight: 15, marginTop: 1 },
  profileBookmarkBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  profileSavedEmpty: { color: '#94a3b8', fontSize: T['body-sm'], lineHeight: 18 },
  profileInfoList: { marginTop: 4 },
  profileInfoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 12 },
  profileInfoRowBorder: { borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  profileInfoText: { color: M3.onSurface, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  profileSignOutText: { color: '#dc2626', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  profileVersion: { textAlign: 'center', color: '#94a3b8', fontSize: 11, lineHeight: 16, paddingTop: 8 },
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
