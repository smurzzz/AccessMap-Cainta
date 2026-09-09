import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useClerk, useSSO, useUser } from '@clerk/clerk-expo';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import OSMMap from '@/components/osm-map';
import { useEffect, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EmptyState from '@/components/ui/empty-state';
import LoadingState from '@/components/ui/loading-state';
import { DesignColors as C, DesignType as T } from '@/constants/design-tokens';
import {
  CATEGORY_DETAILS,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CATEGORY_SHORT_LABELS,
  FEATURE_DETAILS,
  FEATURE_LABELS,
  FEATURE_ORDER,
} from '@/constants/catalog';
import { useAccessibilityFilter } from '@/hooks/useAccessibilityFilter';
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
  stepIcon,
  type DirectionsResult,
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

const featureIcon: Record<FeatureType, IconName> = {
  ramp: 'wheelchair-accessibility', restroom: 'human-male-female', elevator: 'elevator-passenger',
  parking: 'parking', entrance: 'door-open', other: 'checkbox-marked-circle-outline',
};

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

function Header({ title = 'AccessMap Cainta', back }: { title?: string; back?: boolean }) {
  return (
    <View style={styles.header}>
      {back ? (
        <Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityLabel="Go back">
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
      ) : (
        <Image source={require('@/assets/images/accessmap_pin_logo.png')} style={styles.logo} />
      )}
      <View style={styles.headerCopy}>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSubtitle}>San Isidro Accessible Public Directory</Text>
      </View>
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

function Status({ children, available = true }: { children: React.ReactNode; available?: boolean }) {
  return (
    <View style={[styles.status, available ? styles.available : styles.unavailable]}>
      <Text style={[styles.statusMark, available ? styles.statusMarkPos : styles.statusMarkNeg]}>{available ? '✓' : '×'}</Text>
      <Text style={[styles.statusText, available ? styles.statusTextPos : styles.statusTextNeg]}>{children}</Text>
      <Text style={[styles.statusValue, available ? styles.statusValuePos : styles.statusValueNeg]}>{available ? 'AVAILABLE' : 'NOT AVAILABLE'}</Text>
    </View>
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
      const { createdSessionId, setActive } = await startSSOFlow({ strategy: 'oauth_google' });
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
    <Screen>
      <View style={styles.loginHero}>
        <View style={styles.loginLogoBox}>
          <Image source={require('@/assets/images/accessmap_pin_logo.png')} style={styles.loginLogo} />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>✓</Text>
          </View>
        </View>
        <Text style={styles.eyebrow}>♿  CIVIC UTILITY • CAINTA</Text>
        <Text style={styles.loginTitle}>AccessMap Cainta</Text>
        <Text style={styles.loginLead}>
          Dedicated accessibility guide for public service facilities in Barangay San Isidro, Cainta, Rizal.
        </Text>
      </View>
      <View style={styles.loginCard}>
        <Text style={styles.sectionTitle}>▱  Verified Coverage Areas</Text>
        {([
          ['hospital-box-outline', 'Hospitals & Clinics', 'Emergency triage ramps, gurney elevators & tactile paths'],
          ['hospital-building', 'Barangay Health Centers', 'Step-free consultation zones & accessible restrooms'],
          ['bank-outline', 'Municipal & Barangay Offices', 'OSCA desks, low-counter helpdesks & PWD lanes'],
        ] as const).map(([icon, title, detail]) => (
          <View style={styles.coverageRow} key={title}>
            <View style={styles.coverageIcon}><AppIcon name={icon} size={22} color={C.green} /></View>
            <View style={styles.flex}>
              <Text style={styles.coverageTitle}>{title}</Text>
              <Text style={styles.body}>{detail}</Text>
            </View>
          </View>
        ))}
        <View style={styles.noteBox}>
          <Text style={styles.noteIcon}>♿</Text>
          <Text style={styles.body}>Empowering persons with disabilities, senior citizens, and companions with verified physical accessibility features.</Text>
        </View>
      </View>
      <Button white onPress={onSignIn}>{signingIn ? '⏳  Signing in…' : 'ⓖ  Continue with Google'}</Button>
      {signInError ? <Text style={styles.errorText}>{signInError}</Text> : null}
      <Text style={styles.centerLabel}>▣  No password needed • Secure civic SSO</Text>
      <Text style={styles.legal}>By continuing, you agree to our <Text style={styles.underline}>Terms of Service</Text> and <Text style={styles.underline}>Privacy Policy</Text>.</Text>
      <Text style={styles.centerLabel}>⌖  Built for the community of San Isidro, Cainta</Text>
    </Screen>
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

function PlaceCard({ place }: { place: Place }) {
  const labels = availableFeatureLabels(place);
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

export function HomeScreen() {
  const [activeCategory, setActiveCategory] = useState<PlaceCategory | null>(null);
  const { places, loading, error } = usePlaces(activeCategory ?? undefined);

  const chips: { value: PlaceCategory; label: string }[] = [
    { value: 'hospital', label: 'Hospitals' },
    { value: 'health_center', label: 'Health Centers' },
    { value: 'government', label: 'Government' },
  ];

  return (
    <Screen>
      <Header />
      <View style={styles.homeTop}>
        <SearchBar placeholder="Search hospitals, health centers, or offices" />
        <View style={styles.chips}>
          {chips.map((chip) => (
            <Pressable
              key={chip.value}
              accessibilityLabel={`Filter by ${chip.label}`}
              accessibilityRole="button"
              style={[styles.chip, activeCategory === chip.value && styles.activeChip]}
              onPress={() => setActiveCategory(activeCategory === chip.value ? null : chip.value)}
            >
              <AppIcon name={categoryIcon[chip.value]} size={22} color={activeCategory === chip.value ? C.white : C.green} />
              <Text style={[styles.chipText, activeCategory === chip.value && styles.activeChipText]}>{chip.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Public Facilities in San Isidro</Text>
          <Text style={styles.greenLabel}>{loading ? 'Loading…' : `${places.length} locations verified`}</Text>
        </View>
        {error ? <EmptyState title="Could not load facilities" message={error} /> : null}
        {!error && loading ? <LoadingState label="Loading facilities…" /> : null}
        {!error && !loading && places.length === 0 ? <EmptyState message="No facilities found for this category in San Isidro." /> : null}
        {!error && !loading ? places.map((place) => <PlaceCard key={place.id} place={place} />) : null}
        <Text style={styles.sectionTitle}>Browse by Category</Text>
        <View style={styles.categoryGrid}>
          {['Schools & DepEd Centers', 'Shopping Malls & Markets', 'Churches & Parishes', 'Public Parks & Plazas'].map((item) => (
            <Pressable key={item} style={styles.categoryCard} onPress={() => router.push('/category')}>
              <Text style={styles.categoryIcon}>▧</Text>
              <Text style={styles.cardHeading}>{item}</Text>
              <Text style={styles.greenLabel}>✓ Step-free access</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}

export function FilterScreen() {
  const [toggles, setToggles] = useState([true, true, false, true, true]);
  const [category, setCategory] = useState<PlaceCategory | 'all'>('all');
  const activeTypes = FEATURE_ORDER.filter((_, index) => toggles[index]);
  const { places, loading, error } = useAccessibilityFilter(activeTypes, category === 'all' ? undefined : category);
  const topMatch = places[0];

  return (
    <Screen>
      <Header />
      <View style={styles.sheetHandle} />
      <View style={styles.rowBetween}>
        <Text style={styles.screenTitle}>Filter Accessibility{'\n'}Features</Text>
        <Pressable style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable>
      </View>
      <Text style={styles.body}>Show only public places in San Isidro that have the selected accessibility provisions verified.</Text>
      <View style={styles.filterSummary}><Text style={styles.filterSummaryText}>◉  Admin-Verified Listings</Text><Text style={styles.greenLabel}>{activeTypes.length} of 5 Active</Text></View>
      {FEATURE_ORDER.map((featureType, index) => (
        <View style={styles.filterRow} key={featureType}>
          <View style={styles.filterIcon}><AppIcon name={featureIcon[featureType]} size={24} color={C.ink} /></View>
          <View style={styles.flex}><Text style={styles.filterTitle}>{FEATURE_LABELS[featureType]}</Text><Text style={styles.body}>{FEATURE_DETAILS[featureType]}</Text></View>
          <Pressable
            style={[styles.toggle, toggles[index] && styles.toggleOn]}
            accessibilityLabel={`Toggle ${FEATURE_LABELS[featureType]}`}
            accessibilityRole="switch"
            accessibilityState={{ checked: toggles[index] }}
            onPress={() => setToggles((current) => current.map((value, i) => i === index ? !value : value))}
          >
            <View style={[styles.toggleThumb, toggles[index] && styles.toggleThumbOn]} />
          </Pressable>
        </View>
      ))}
      <Text style={styles.sectionTitle}>Facility Category</Text>
      <View style={styles.categoryGrid}>
        {(['all', 'hospital', 'health_center', 'government'] as const).map((item) => (
          <Pressable
            key={item}
            accessibilityLabel={`Show ${item === 'all' ? 'all facilities' : CATEGORY_SHORT_LABELS[item]}`}
            accessibilityRole="button"
            style={[styles.smallChoice, category === item && styles.selectedChoice]}
            onPress={() => setCategory(item)}
          >
            <Text style={[styles.choiceText, category === item && styles.selectedChoiceText]}>{item === 'all' ? 'All Facilities' : CATEGORY_SHORT_LABELS[item] + 's Only'}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <EmptyState title="Could not load results" message={error} /> : null}
      {!error && loading ? <LoadingState label="Searching facilities…" /> : null}
      {!error && !loading && places.length === 0 ? <EmptyState message="No facilities match the selected accessibility filters." /> : null}
      {!error && !loading && topMatch ? (
        <View style={styles.matchBox}><Text style={styles.greenLabel}>Top Verified Match</Text><Text style={styles.cardHeading}>{topMatch.name}</Text><Text style={styles.body}>{topMatch.address}{places.length > 1 ? ` • ${places.length} matching facilities` : ''}</Text></View>
      ) : null}
      <View style={styles.cardActions}><Button secondary onPress={() => { setToggles([true, true, false, true, true]); setCategory('all'); }}>Clear All</Button><Button onPress={() => router.push(tabsRoute)}>✓  Apply Filters ({loading ? '…' : places.length})</Button></View>
    </Screen>
  );
}

export function MapScreen() {
  const params = useLocalSearchParams<{ place?: string }>();
  const { places, loading, error } = usePlaces();
  const [tappedPlaceId, setTappedPlaceId] = useState<string | null>(params.place ?? null);
  const activePlaceId = params.place ?? tappedPlaceId;
  const activePlace = places.find((place) => place.id === activePlaceId) ?? null;

  return (
    <Screen>
      <Header />
      <Text style={styles.screenTitle}>Map & Location View</Text>
      <Text style={styles.body}>Find verified accessible facilities around San Isidro.</Text>
      <SearchBar placeholder="Search an area or facility" />
      {Platform.OS === 'web' ? (
        <View style={styles.mapMock}>
          <Text style={styles.mapRoad}>QUEZON CITY</Text><Text style={[styles.mapRoad, { top: 90, left: 35 }]}>MARIKINA</Text><Text style={[styles.mapRoad, { top: 170, left: 120 }]}>CAINTA</Text>
          <View style={[styles.mapPin, { top: 125, left: 145 }]}><Text>⊞</Text></View>
          <View style={[styles.mapPin, { top: 65, left: 250 }]}><Text>⌖</Text></View>
          <View style={[styles.mapPin, { top: 210, left: 85 }]}><Text>♿</Text></View>
        </View>
      ) : (
        <View style={styles.mapWrap}>
          {error ? <EmptyState title="Could not load facilities" message={error} /> : null}
          {!error && loading ? <LoadingState label="Loading facilities…" /> : null}
          {!error && !loading && places.length === 0 ? <EmptyState message="No verified facilities to show on the map yet." /> : null}
          {!error && !loading && places.length > 0 ? (
            <OSMMap
              pins={places.map((place) => ({ id: place.id, latitude: place.latitude, longitude: place.longitude, title: place.name }))}
              focus={activePlace ? { latitude: activePlace.latitude, longitude: activePlace.longitude } : undefined}
              bounds={SAN_ISIDRO_BOUNDS}
              height={320}
              onPinPress={(id) => setTappedPlaceId(id)}
            />
          ) : null}
          {activePlace ? (
            <View style={styles.markerCard}>
              <Image source={photoSource(activePlace)} style={styles.markerCardPhoto} />
              <View style={styles.flex}>
                <Text style={styles.cardHeading} numberOfLines={2}>{activePlace.name}</Text>
                <Text style={styles.greenLabel}>√ {availableFeatureLabels(activePlace).length} verified features</Text>
              </View>
              <Button onPress={() => router.push({ pathname: '/place/[id]', params: { id: activePlace.id } })}>Details</Button>
            </View>
          ) : null}
        </View>
      )}
      <View style={styles.locationCard}><Text style={styles.sectionTitle}>Nearby verified facilities</Text>{!error && places.slice(0, 3).map((place) => <Pressable key={place.id} style={styles.nearby} onPress={() => router.push({ pathname: '/place/[id]', params: { id: place.id } })}><Text style={styles.greenLabel}>●</Text><View style={styles.flex}><Text style={styles.cardHeading}>{place.name}</Text><Text style={styles.body}>{place.address}</Text></View><Text>›</Text></Pressable>)}</View>
    </Screen>
  );
}

export function PlaceDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { place, loading, error } = usePlace(id);

  return (
    <Screen>
      <Header title="Place Details" back />
      {error ? <EmptyState title="Could not load this facility" message={error} /> : null}
      {!error && loading ? <LoadingState label="Loading facility details…" /> : null}
      {!error && !loading && !place ? <EmptyState message="This facility could not be found." /> : null}
      {!error && !loading && place ? (
        <>
          <Image source={photoSource(place)} style={styles.heroImage} />
          <Text style={styles.heroBadge}>♿ Public Service • Accessible Facility</Text>
          <View style={styles.detailCard}>
            <Text style={styles.eyebrow}>{CATEGORY_LABELS[place.category].toUpperCase()}</Text>
            <Text style={styles.screenTitle}>{place.name}</Text>
            {place.operating_hours ? <View style={styles.openBox}><Text style={styles.cardHeading}>● {place.operating_hours}</Text></View> : null}
            <Text style={styles.body}>⌖  {place.address}</Text>
            {place.description ? <Text style={styles.body}>{place.description}</Text> : null}
          </View>
          <View style={styles.detailCard}>
            <View style={styles.rowBetween}><Text style={styles.sectionTitle}>♧ Accessibility Audit</Text><Text style={styles.greenLabel}>Admin-Verified</Text></View>
            <Text style={styles.body}>Direct factual verification of physical mobility, navigation, and tactile features.</Text>
            {(place.accessibility_features ?? []).map((feature) => (
              <Status key={feature.id} available={feature.status === 'available'}>{FEATURE_LABELS[feature.feature_type]}{feature.notes ? ` — ${feature.notes}` : ''}</Status>
            ))}
          </View>
          <View style={styles.detailCard}><Text style={styles.sectionTitle}>▥ Key Desks & Locations</Text>{['PWD & Senior Citizen Priority Desk', 'Malasakit Center & PhilHealth', 'Pharmacy & Dispensary'].map((item) => <View style={styles.listRow} key={item}><View style={styles.coverageIcon}><AppIcon name="hospital-box-outline" size={22} color={C.green} /></View><View style={styles.flex}><Text style={styles.cardHeading}>{item}</Text><Text style={styles.body}>Ground floor • Direct step-free corridor</Text></View><Text>›</Text></View>)}</View>
          <View style={styles.detailCard}><Text style={styles.sectionTitle}>♧ Location & Access Point</Text>{Platform.OS === 'web' ? <View style={styles.mapMockSmall}><Text style={styles.mapRoad}>CAINTA</Text><Text style={[styles.mapRoad, { top: 55, left: 45 }]}>PAROLA ST.</Text><View style={[styles.mapPin, { top: 65, left: 140 }]}><Text>⊞</Text></View></View> : <OSMMap pins={[{ id: place.id, latitude: place.latitude, longitude: place.longitude, title: place.name }]} bounds={SAN_ISIDRO_BOUNDS} height={150} />}<Text style={styles.body}>Ramp entrance directly faces {place.address}</Text><View style={styles.cardActions}><Button secondary onPress={() => router.push({ pathname: '/(tabs)/map', params: { place: place.id } })}>◉  Open in Map</Button></View></View>
          <Button accessibility onPress={() => router.push({
            pathname: '/directions',
            params: { place: place.name, lat: String(place.latitude), lng: String(place.longitude) } })}>♿  Get Accessible Route</Button>
        </>
      ) : null}
    </Screen>
  );
}

export function DirectionsScreen() {
  const { place, lat, lng } = useLocalSearchParams<{ place?: string; lat?: string; lng?: string }>();
  const destLat = lat ? parseFloat(lat) : null;
  const destLng = lng ? parseFloat(lng) : null;
  const [attempt, setAttempt] = useState(0);
  const [routeState, setRouteState] = useState<'loading' | 'done' | 'error' | 'permission'>('loading');
  const [result, setResult] = useState<DirectionsResult | null>(null);
  const [message, setMessage] = useState('');

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

  const coordinateNote =
    destLat !== null && destLng !== null
      ? `One-time route preview: ${destLat.toFixed(5)}, ${destLng.toFixed(5)}`
      : 'This place does not have coordinates on record yet.';

  return (
    <Screen>
      <Header title="Directions" back />
      <Text style={styles.screenTitle}>Accessible Route</Text>
      <Text style={styles.body}>{place ?? 'Selected facility'}</Text>
      {routeState === 'loading' ? <LoadingState label="Fetching your walking route…" /> : null}
      {routeState === 'error' ? <EmptyState title="Could not load directions" message={message} /> : null}
      {routeState === 'permission' ? <EmptyState title="Location permission needed" message={message} /> : null}
      {routeState === 'done' && result ? (
        <>
          {Platform.OS !== 'web' && result.coords.length > 1 ? (
            <OSMMap
              pins={[
                { id: 'origin', latitude: result.coords[0].latitude, longitude: result.coords[0].longitude, title: 'Your location', color: '#2563EB' },
                { id: 'dest', latitude: result.coords[result.coords.length - 1].latitude, longitude: result.coords[result.coords.length - 1].longitude, title: place ?? 'Destination', color: '#059669' },
              ]}
              line={result.coords}
              height={190}
            />
          ) : null}
          <View style={styles.routeSummary}><Text style={styles.greenHeading}>{formatDuration(result.totalDuration)} • {formatDistance(result.totalDistance)}</Text><Text style={styles.body}>{coordinateNote}</Text></View>
          <View style={styles.routeLine}>
            {result.steps.map((step, index) => (
              <View style={styles.step} key={index}>
                <View style={[styles.stepNumber, step.type === 10 && styles.stepNumberArrive]}><Text style={styles.stepNumberText}>{stepIcon(step.type)}</Text></View>
                <Text style={[styles.flex, styles.cardHeading, { lineHeight: 22 }]}>{index + 1}. {step.instruction || (step.type === 10 ? 'Arrive at your destination' : 'Continue walking')}</Text>
                {step.distance > 0 ? <Text style={styles.stepDistance}>{formatDistance(step.distance)}</Text> : null}
              </View>
            ))}
          </View>
        </>
      ) : null}
      {routeState === 'permission' && <View style={styles.messageNote}><Text style={styles.body}>{message}</Text></View>}
      {routeState === 'permission' || routeState === 'error' ? <View style={styles.cardActions}><Button onPress={() => { setMessage(''); setAttempt((count) => count + 1); }}>↻  Try Again</Button></View> : null}
      <View style={styles.noteBox}><Text style={styles.noteIcon}>i</Text><Text style={styles.body}>This is a one-time static route preview. Moving the device will not change the route shown here.</Text></View>
      <Button secondary onPress={() => router.back()}>Back to Place Details</Button>
    </Screen>
  );
}

export function ProfileScreen() {
  const { user } = useUser();
  const { isAdmin, syncing } = useRole();
  const { signOut } = useClerk();
  const displayName = user?.firstName || user?.lastName || '';
  const userName = [displayName, user?.lastName].filter(Boolean).join(' ') || 'Civic contributor';
  const email = user?.emailAddresses?.[0]?.emailAddress;
  const avatar = user?.imageUrl ? { uri: user.imageUrl } : photos.avatar;

  const onSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.warn('Sign out failed', error);
    }
  };

  return (
    <Screen>
      <Header />
      <View style={styles.profileHero}><Image source={avatar} style={styles.profileAvatar} /><Text style={styles.screenTitle}>{userName}</Text>{email ? <Text style={styles.body}>{email}</Text> : null}<Text style={styles.greenLabel}>{syncing ? 'Syncing role…' : isAdmin ? 'Administrator' : 'Verified community user'}</Text></View>
      <View style={styles.profileCard}><Text style={styles.sectionTitle}>My Access Preferences</Text>{['Show step-free routes first', 'Show accessible restrooms', 'Use large text labels'].map((item) => <View style={styles.preference} key={item}><Text style={styles.cardHeading}>{item}</Text><Text style={styles.greenLabel}>ON</Text></View>)}</View>
      <View style={styles.profileCard}><Text style={styles.sectionTitle}>Saved Places</Text><Text style={styles.body}>Your saved facilities will appear here for quick access.</Text><Button secondary onPress={() => router.push(tabsRoute)}>Browse Place Directory</Button></View>
      {isAdmin ? (
        <Pressable style={styles.adminLink} onPress={() => router.push('/admin')}><Text style={styles.cardHeading}>Admin Console</Text><Text style={styles.body}>Manage the facility directory</Text><Text>›</Text></Pressable>
      ) : null}
      <Button secondary onPress={onSignOut}>Sign Out</Button>
    </Screen>
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
  safe: { flex: 1, backgroundColor: C.canvas },
  scrollContent: { paddingBottom: 24 },
  screenContent: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 16, gap: 14 },
  flex: { flex: 1 },
  header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  logo: { width: 38, height: 38, borderRadius: 10 },
  headerCopy: { flex: 1 },
  headerTitle: { color: C.ink, fontSize: T['headline-md'], fontWeight: '700' },
  headerSubtitle: { color: C.muted, fontSize: T['label-md'], fontWeight: '600', marginTop: 2 },
  avatar: { width: 38, height: 38, borderRadius: 20 },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: T['icon-xl'], color: C.ink, lineHeight: 44 },
  loginHero: { alignItems: 'center', paddingTop: 12, gap: 12 },
  loginLogoBox: { width: 158, height: 158, borderRadius: 16, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', position: 'relative', elevation: 1 },
  loginLogo: { width: 110, height: 110, borderRadius: 22 },
  badge: { position: 'absolute', right: -8, top: -8, width: 46, height: 46, borderRadius: 24, backgroundColor: C.green, textAlign: 'center', paddingTop: 10 },
  badgeText: { color: C.white, fontSize: T['icon-md'], fontWeight: '800' },
  eyebrow: { color: C.green, fontSize: T['label-sm'], fontWeight: '800', letterSpacing: 0.8 },
  loginTitle: { color: C.ink, fontSize: T['display-lg'], fontWeight: '800', textAlign: 'center' },
  loginLead: { color: C.muted, fontSize: T['body-xl'], lineHeight: 29, textAlign: 'center', maxWidth: 570 },
  loginCard: { backgroundColor: C.card, borderRadius: 16, padding: 24, marginTop: 22, gap: 20, borderWidth: 1, borderColor: C.line },
  sectionTitle: { color: C.ink, fontSize: T['body-xl'], lineHeight: 28, fontWeight: '800' },
  coverageRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  coverageIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' },
  coverageTitle: { color: C.ink, fontSize: T['headline-sm'], fontWeight: '800', marginBottom: 2 },
  body: { color: C.muted, fontSize: T['body-md'], lineHeight: 24 },
  noteBox: { flexDirection: 'row', gap: 12, backgroundColor: C.slate, padding: 16, borderRadius: 8, alignItems: 'center' },
  messageNote: { backgroundColor: C.slate, padding: 14, borderRadius: 7, gap: 6 },
  noteIcon: { color: C.green, fontSize: T['icon-sm'], fontWeight: '700' },
  button: { minHeight: 52, backgroundColor: C.green, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, flex: 1, borderWidth: 2, borderColor: C.green },
  buttonText: { color: C.white, fontSize: T['body-md'], fontWeight: '800' },
  secondaryButton: { backgroundColor: C.slate, borderColor: C.slate },
  secondaryButtonText: { color: C.ink },
  whiteButton: { backgroundColor: C.white, borderColor: C.line },
  whiteButtonText: { color: C.ink },
  accessibilityButton: { backgroundColor: C.green, borderColor: C.green },
  accessibilityButtonText: { color: C.white },
  centerLabel: { textAlign: 'center', color: C.muted, fontSize: T['body-md'], fontWeight: '700', paddingVertical: 5 },
  errorText: { color: C.amber, fontSize: T['body-md'], textAlign: 'center', fontWeight: '700', marginVertical: 10 },
  legal: { color: C.muted, fontSize: T['body-md'], lineHeight: 26, textAlign: 'center', marginVertical: 16 },
  underline: { textDecorationLine: 'underline', color: C.ink },
  homeTop: { gap: 14 },
  search: { minHeight: 64, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 12 },
  searchIcon: { color: C.muted, fontSize: T['display-md'] },
  searchInput: { flex: 1, color: C.ink, fontSize: T['headline-sm'] },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { minHeight: 56, paddingHorizontal: 16, borderRadius: 14, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  activeChip: { backgroundColor: C.green, borderColor: C.green },
  chipText: { color: C.ink, fontSize: T['body-md-tight'], fontWeight: '800' },
  activeChipText: { color: C.white },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  greenLabel: { color: C.green, fontSize: T['label-md'], fontWeight: '800' },
  placeCard: { backgroundColor: C.card, borderRadius: 12, padding: 20, gap: 16, borderWidth: 1, borderColor: C.line },
  placeTop: { flexDirection: 'row', gap: 14, minHeight: 120 },
  placePhoto: { width: 120, height: 120, borderRadius: 10 },
  placeInfo: { flex: 1, gap: 7 },
  placeName: { color: C.ink, fontSize: T['headline-md'], fontWeight: '800' },
  categoryPill: { backgroundColor: C.navy, alignSelf: 'flex-start', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5 },
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
  markerCard: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: C.card, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.line },
  locationCard: { backgroundColor: C.card, padding: 16, borderRadius: 12, gap: 12, borderWidth: 1, borderColor: C.line },
  nearby: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 8 },
  markerCardPhoto: { width: 44, height: 44, borderRadius: 8 },
  heroImage: { height: 230, width: '100%', borderRadius: 10 },
  heroBadge: { backgroundColor: C.mint, borderRadius: 4, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, marginTop: -24, zIndex: 2, color: C.green, fontWeight: '800' },
  detailCard: { backgroundColor: C.card, borderRadius: 12, padding: 16, gap: 10, borderWidth: 1, borderColor: C.line },
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
  profileHero: { alignItems: 'center', gap: 7, paddingVertical: 14 },
  profileAvatar: { width: 96, height: 96, borderRadius: 48 },
  profileCard: { backgroundColor: C.card, borderRadius: 12, padding: 16, gap: 12, borderWidth: 1, borderColor: C.line },
  preference: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.line },
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
});
