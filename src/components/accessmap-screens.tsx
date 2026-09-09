import { useClerk, useSSO, useUser } from '@clerk/clerk-expo';
import { Image } from 'expo-image';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import {
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
  CATEGORY_SHORT_LABELS,
  FEATURE_DETAILS,
  FEATURE_ICONS,
  FEATURE_LABELS,
  FEATURE_ORDER,
} from '@/constants/catalog';
import { useAccessibilityFilter } from '@/hooks/useAccessibilityFilter';
import { usePlace } from '@/hooks/usePlace';
import { usePlaces } from '@/hooks/usePlaces';
import { useRole } from '@/contexts/role-context';
import type { FeatureType, Place, PlaceCategory } from '@/types';

const tabsRoute = '/(tabs)' as Href;

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

type MockPlace = {
  id: string;
  name: string;
  category: string;
  address: string;
  photo: number;
  features: string[];
};

const mockPlaces: MockPlace[] = [
  {
    id: 'hospital',
    name: 'Cainta Municipal Hospital - San Isidro Health Annex',
    category: 'Hospital',
    address: 'Felix Avenue cor. Parola St., Barangay San Isidro, Cainta',
    photo: photos.hospital,
    features: ['Ramp Entrance', 'Accessible CR', 'PWD Parking'],
  },
  {
    id: 'health',
    name: 'San Isidro Barangay Health Center',
    category: 'Health Center',
    address: 'Parola St., San Isidro, Cainta',
    photo: photos.health,
    features: ['Step-Free Ramp', 'Wide Doors', 'Accessible Restroom'],
  },
  {
    id: 'hall',
    name: 'Cainta Municipal Hall Extension',
    category: 'Government',
    address: 'Imelda Ave. cor. Bonifacio Ave., Cainta',
    photo: photos.hall,
    features: ['Ramp', 'Elevator', 'Ground CR'],
  },
  {
    id: 'school',
    name: 'San Isidro Elementary School',
    category: 'School & Education',
    address: 'A. Bonifacio Ave., San Isidro',
    photo: photos.school,
    features: ['Ground Entrance', 'PWD Drop-off Zone'],
  },
];

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
}: {
  children: React.ReactNode;
  onPress?: () => void;
  secondary?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.button, secondary && styles.secondaryButton]}>
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{children}</Text>
    </Pressable>
  );
}

function Status({ children, available = true }: { children: React.ReactNode; available?: boolean }) {
  return (
    <View style={[styles.status, available ? styles.available : styles.unavailable]}>
      <Text style={styles.statusMark}>{available ? '✓' : '×'}</Text>
      <Text style={styles.statusText}>{children}</Text>
      <Text style={styles.statusValue}>{available ? 'AVAILABLE' : 'NOT AVAILABLE'}</Text>
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
        {[
          ['⊞', 'Hospitals & Clinics', 'Emergency triage ramps, gurney elevators & tactile paths'],
          ['⊞', 'Barangay Health Centers', 'Step-free consultation zones & accessible restrooms'],
          ['▤', 'Municipal & Barangay Offices', 'OSCA desks, low-counter helpdesks & PWD lanes'],
        ].map(([icon, title, detail]) => (
          <View style={styles.coverageRow} key={title}>
            <Text style={styles.coverageIcon}>{icon}</Text>
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
      <Button onPress={onSignIn}>{signingIn ? '⏳  Signing in…' : 'ⓖ  Continue with Google'}</Button>
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
      <Text style={styles.searchIcon}>⌕</Text>
      <TextInput placeholder={placeholder} placeholderTextColor={C.muted} style={styles.searchInput} />
      <Text style={styles.searchIcon}>⊗</Text>
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
          <View style={styles.categoryPill}><Text style={styles.categoryText}>{CATEGORY_SHORT_LABELS[place.category]}</Text></View>
          <Text style={styles.address} numberOfLines={1}>⌖  {place.address}</Text>
          <Text style={styles.featureLine}>{labels.length > 0 ? labels.slice(0, 2).join(', ') + (labels.length > 2 ? ', +1 more' : '') : 'No verified features yet'}</Text>
        </View>
        <Text style={styles.bookmark}>♧</Text>
      </View>
      <View style={styles.cardActions}>
        <Button secondary onPress={() => router.push({ pathname: '/place/[id]', params: { id: place.id } })}>View Details</Button>
        <Button onPress={() => router.push({ pathname: '/directions', params: { place: place.name } })}>⌖  Route</Button>
      </View>
    </View>
  );
}

export function HomeScreen() {
  const [activeCategory, setActiveCategory] = useState<PlaceCategory | null>(null);
  const { places, loading, error } = usePlaces(activeCategory ?? undefined);

  const chips: Array<{ value: PlaceCategory; label: string }> = [
    { value: 'hospital', label: '⊞  ' + CATEGORY_SHORT_LABELS.hospital + 's' },
    { value: 'health_center', label: '♙  ' + CATEGORY_SHORT_LABELS.health_center + 's' },
    { value: 'government', label: '▤  ' + CATEGORY_SHORT_LABELS.government },
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
          <Text style={styles.filterIcon}>{FEATURE_ICONS[featureType]}</Text>
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
  return (
    <Screen>
      <Header />
      <Text style={styles.screenTitle}>Map & Location View</Text>
      <Text style={styles.body}>Find verified accessible facilities around San Isidro.</Text>
      <SearchBar placeholder="Search an area or facility" />
      <View style={styles.mapMock}>
        <Text style={styles.mapRoad}>QUEZON CITY</Text><Text style={[styles.mapRoad, { top: 90, left: 35 }]}>MARIKINA</Text><Text style={[styles.mapRoad, { top: 170, left: 120 }]}>CAINTA</Text>
        <View style={[styles.mapPin, { top: 125, left: 145 }]}><Text>⊞</Text></View>
        <View style={[styles.mapPin, { top: 65, left: 250 }]}><Text>⌖</Text></View>
        <View style={[styles.mapPin, { top: 210, left: 85 }]}><Text>♿</Text></View>
        <View style={styles.mapLegend}><Text style={styles.cardHeading}>12 verified locations</Text><Text style={styles.body}>Tap a marker to view access details</Text></View>
      </View>
      <View style={styles.locationCard}><Text style={styles.sectionTitle}>Nearby verified facilities</Text>{mockPlaces.slice(0, 3).map((place) => <Pressable key={place.id} style={styles.nearby} onPress={() => router.push({ pathname: '/place/[id]', params: { id: place.id } })}><Text style={styles.greenLabel}>●</Text><View style={styles.flex}><Text style={styles.cardHeading}>{place.name}</Text><Text style={styles.body}>{place.address}</Text></View><Text>›</Text></Pressable>)}</View>
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
          <View style={styles.heroBadge}>♿ Public Service • Accessible Facility</View>
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
          <View style={styles.detailCard}><Text style={styles.sectionTitle}>▥ Key Desks & Locations</Text>{['PWD & Senior Citizen Priority Desk', 'Malasakit Center & PhilHealth', 'Pharmacy & Dispensary'].map((item) => <View style={styles.listRow} key={item}><Text style={styles.coverageIcon}>⊞</Text><View style={styles.flex}><Text style={styles.cardHeading}>{item}</Text><Text style={styles.body}>Ground floor • Direct step-free corridor</Text></View><Text>›</Text></View>)}</View>
          <View style={styles.detailCard}><Text style={styles.sectionTitle}>♧ Location & Access Point</Text><View style={styles.mapMockSmall}><Text style={styles.mapRoad}>CAINTA</Text><Text style={[styles.mapRoad, { top: 55, left: 45 }]}>PAROLA ST.</Text><View style={[styles.mapPin, { top: 65, left: 140 }]}><Text>⊞</Text></View></View><Text style={styles.body}>Ramp entrance directly faces {place.address}</Text></View>
          <Button onPress={() => router.push('/directions')}>♿  Get Accessible Route</Button>
        </>
      ) : null}
    </Screen>
  );
}

export function DirectionsScreen() {
  return (
    <Screen>
      <Header title="Directions" back />
      <Text style={styles.screenTitle}>Accessible Route</Text>
      <Text style={styles.body}>Cainta Municipal Hospital - San Isidro Health Annex</Text>
      <View style={styles.routeSummary}><Text style={styles.greenHeading}>12 min • 850 m</Text><Text style={styles.body}>One-time route preview from San Isidro Civic Center</Text></View>
      <View style={styles.routeLine}>
        {[
          ['1', 'Start at San Isidro Civic Center', 'Use the step-free sidewalk along Felix Avenue'],
          ['2', 'Turn right at Parola Street', 'Wide crossing with a lowered curb'],
          ['3', 'Arrive at the accessible entrance', 'Ramp entrance faces the street corner'],
        ].map(([number, title, detail]) => <View style={styles.step} key={number}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>{number}</Text></View><View style={styles.flex}><Text style={styles.cardHeading}>{title}</Text><Text style={styles.body}>{detail}</Text></View></View>)}
      </View>
      <View style={styles.noteBox}><Text style={styles.noteIcon}>i</Text><Text style={styles.body}>This is a static route preview. Check the facility details before you travel.</Text></View>
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
  return (
    <Screen>
      <Header title="Administrative Console" back />
      <Text style={styles.eyebrow}>ADMIN FACILITY REGISTRY</Text>
      <Text style={styles.screenTitle}>Facility Directory</Text>
      <Text style={styles.body}>Manage and maintain field-verified physical accessibility listings for civic public services.</Text>
      <View style={styles.chips}>{['All 12', 'Hospitals 4', 'Health Centers 3'].map((item, index) => <View key={item} style={[styles.chip, index === 0 && styles.activeChip]}><Text style={[styles.chipText, index === 0 && styles.activeChipText]}>{item}</Text></View>)}</View>
      {mockPlaces.map((place) => <View style={styles.adminCard} key={place.id}><View style={styles.rowBetween}><Text style={styles.eyebrow}>{place.category.toUpperCase()}</Text><Text style={styles.adminActions}>✎  ▫</Text></View><Text style={styles.cardHeading}>{place.name}</Text><Text style={styles.body}>⌖  {place.address}</Text><Text style={styles.body}>Verified: Today, 08:30 AM</Text><View style={styles.adminTags}>{place.features.map((feature) => <Text style={styles.adminTag} key={feature}>✓ {feature}</Text>)}</View></View>)}
      <Button onPress={() => router.push('/admin/place-form')}>＋  Add New Place</Button>
    </Screen>
  );
}

export function PlaceFormScreen() {
  const [saved, setSaved] = useState(false);
  return (
    <Screen>
      <Header title="Administrative Console" back />
      <View style={styles.rowBetween}><Text style={styles.eyebrow}>ADMIN FACILITY REGISTRY</Text><Text style={styles.greenLabel}>Verified Mode</Text></View>
      <Text style={styles.screenTitle}>{saved ? 'Facility Saved' : 'Edit Public Facility'}</Text>
      <Text style={styles.body}>Register physical accessibility features for San Isidro facilities with strict civic accuracy.</Text>
      {[
        ['Place Name *', 'Cainta Municipal Hospital - San Isidro Health Annex'],
        ['Facility Category *', 'Hospital (Selected)'],
        ['Description & Navigational Context', 'Primary public healthcare facility serving San Isidro residents, featuring dedicated PWD lane and accessible consultation rooms.'],
        ['Physical Address *', 'Felix Avenue cor. Parola St., Barangay San Isidro'],
      ].map(([label, value]) => <View style={styles.formField} key={label}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} editable={false} multiline style={styles.fieldInput} /></View>)}
      <Text style={styles.sectionTitle}>Verified Accessibility Features</Text>
      <Text style={styles.body}>Strict physical dual-state indicators. No percentages or speculative scores.</Text>
      {['Ramps & Step-Free Entry', 'Accessible Restroom / CR', 'Elevator / Lift Access', 'Accessible PWD Parking', 'Accessible Wide Entrance'].map((item) => <View style={styles.formToggle} key={item}><Text style={styles.coverageIcon}>✓</Text><Text style={styles.cardHeading}>{item}</Text><Text style={styles.toggleLabel}>✓</Text></View>)}
      <View style={styles.formField}><Text style={styles.fieldLabel}>Operating Hours *</Text><TextInput value="Open 24/7 (Emergency & Outpatient)" editable={false} style={styles.fieldInput} /></View>
      <View style={styles.cardActions}><Button secondary onPress={() => router.back()}>×  Cancel</Button><Button onPress={() => setSaved(true)}>▣  Save Facility</Button></View>
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
  loginCard: { backgroundColor: C.card, borderRadius: 14, padding: 20, marginTop: 18, gap: 16, borderWidth: 1, borderColor: C.softBorder },
  sectionTitle: { color: C.ink, fontSize: T['body-xl'], lineHeight: 28, fontWeight: '800' },
  coverageRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  coverageIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.mint, color: C.green, textAlign: 'center', paddingTop: 8, fontSize: T['icon-sm'], fontWeight: '700' },
  coverageTitle: { color: C.ink, fontSize: T['headline-sm'], fontWeight: '800', marginBottom: 2 },
  body: { color: C.muted, fontSize: T['body-md'], lineHeight: 24 },
  noteBox: { flexDirection: 'row', gap: 12, backgroundColor: C.slate, padding: 14, borderRadius: 7, alignItems: 'center' },
  noteIcon: { color: C.green, fontSize: T['icon-sm'], fontWeight: '700' },
  button: { minHeight: 52, backgroundColor: C.green, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, flex: 1 },
  buttonText: { color: C.white, fontSize: T['body-md'], fontWeight: '800' },
  secondaryButton: { backgroundColor: C.slate },
  secondaryButtonText: { color: C.ink },
  centerLabel: { textAlign: 'center', color: C.muted, fontSize: T['body-md'], fontWeight: '700', paddingVertical: 5 },
  errorText: { color: C.amber, fontSize: T['body-md'], textAlign: 'center', fontWeight: '700', marginVertical: 10 },
  legal: { color: C.muted, fontSize: T['body-md'], lineHeight: 26, textAlign: 'center', marginVertical: 16 },
  underline: { textDecorationLine: 'underline', color: C.ink },
  homeTop: { gap: 14 },
  search: { height: 56, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.softBorder, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  searchIcon: { color: C.muted, fontSize: T['display-md'] },
  searchInput: { flex: 1, color: C.ink, fontSize: T['headline-sm'] },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { minHeight: 48, paddingHorizontal: 16, borderRadius: 14, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.softBorder },
  activeChip: { backgroundColor: C.green, borderColor: C.green },
  chipText: { color: C.ink, fontSize: T['body-md-tight'], fontWeight: '800' },
  activeChipText: { color: C.white },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  greenLabel: { color: C.green, fontSize: T['label-md'], fontWeight: '800' },
  placeCard: { backgroundColor: C.card, borderRadius: 11, padding: 16, gap: 14, borderWidth: 1, borderColor: C.softBorder },
  placeTop: { flexDirection: 'row', gap: 14 },
  placePhoto: { width: 120, height: 120, borderRadius: 10 },
  placeInfo: { flex: 1, gap: 7 },
  placeName: { color: C.ink, fontSize: T['headline-md'], fontWeight: '800' },
  categoryPill: { backgroundColor: C.navy, alignSelf: 'flex-start', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  categoryText: { color: C.white, fontSize: T['label-md'], fontWeight: '800' },
  address: { color: C.muted, fontSize: T['body-md-tight'] },
  featureLine: { color: C.muted, fontSize: T['label-md'], fontWeight: '700', lineHeight: 20 },
  bookmark: { color: C.muted, fontSize: T['icon-md'] },
  cardActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryCard: { backgroundColor: C.card, borderRadius: 10, padding: 16, minHeight: 126, flexBasis: '47%', flexGrow: 1, gap: 10, borderWidth: 1, borderColor: C.softBorder },
  categoryListCard: { backgroundColor: C.card, borderRadius: 10, padding: 16, minHeight: 128, flexDirection: 'row', alignItems: 'flex-start', gap: 14, borderWidth: 1, borderColor: C.softBorder },
  categoryLargeIcon: { width: 54, height: 54, borderRadius: 8, backgroundColor: C.mint, color: C.green, textAlign: 'center', paddingTop: 12, fontSize: T['icon-lg'] },
  countPill: { backgroundColor: C.slate, color: C.muted, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 8, fontSize: T['label-sm'], fontWeight: '800' },
  categoryIcon: { color: C.green, fontSize: T['icon-lg'] },
  cardHeading: { color: C.ink, fontSize: T['body-md'], lineHeight: 22, fontWeight: '800' },
  sheetHandle: { width: 44, height: 5, backgroundColor: C.softGray, borderRadius: 4, alignSelf: 'center' },
  screenTitle: { color: C.ink, fontSize: T['display-md'], lineHeight: 32, fontWeight: '800' },
  closeButton: { width: 48, height: 48, borderRadius: 12, backgroundColor: C.slate, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: C.muted, fontSize: T['icon-xl'], lineHeight: 34 },
  filterSummary: { backgroundColor: C.mint, minHeight: 52, borderRadius: 4, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterSummaryText: { color: C.green, fontSize: T['body-md-tight'], fontWeight: '800' },
  filterRow: { backgroundColor: C.slate, borderRadius: 4, padding: 14, minHeight: 116, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  filterIcon: { color: C.ink, fontSize: T['icon-sm'], width: 24 },
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
  locationCard: { backgroundColor: C.card, padding: 16, borderRadius: 10, gap: 12 },
  nearby: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 8 },
  heroImage: { height: 230, width: '100%', borderRadius: 10 },
  heroBadge: { backgroundColor: C.mint, borderRadius: 20, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, marginTop: -24, zIndex: 2, color: C.green, fontWeight: '800' },
  detailCard: { backgroundColor: C.card, borderRadius: 10, padding: 16, gap: 10, borderWidth: 1, borderColor: C.softBorder },
  greenHeading: { color: C.green, fontSize: T['headline-sm'], fontWeight: '800' },
  openBox: { backgroundColor: C.paleMint, borderRadius: 5, padding: 12 },
  status: { borderRadius: 4, padding: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  available: { backgroundColor: C.paleMint },
  unavailable: { backgroundColor: C.statusGray },
  statusMark: { width: 28, height: 28, borderRadius: 15, backgroundColor: C.green, color: C.white, textAlign: 'center', paddingTop: 4, fontWeight: '800' },
  statusText: { color: C.ink, fontSize: T['body-md-tight'], lineHeight: 21, fontWeight: '800', flex: 1 },
  statusValue: { color: C.green, fontSize: T['label-xs'], fontWeight: '900', paddingTop: 5 },
  listRow: { backgroundColor: C.slate, borderRadius: 5, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeSummary: { backgroundColor: C.paleMint, borderRadius: 8, padding: 16, gap: 5 },
  routeLine: { gap: 4 },
  step: { flexDirection: 'row', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  stepNumber: { width: 34, height: 34, borderRadius: 18, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: C.white, fontWeight: '800', fontSize: T['headline-sm'] },
  profileHero: { alignItems: 'center', gap: 7, paddingVertical: 14 },
  profileAvatar: { width: 96, height: 96, borderRadius: 48 },
  profileCard: { backgroundColor: C.card, borderRadius: 10, padding: 16, gap: 12 },
  preference: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.line },
  adminLink: { backgroundColor: C.card, borderRadius: 8, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  adminCard: { backgroundColor: C.card, borderRadius: 8, padding: 14, gap: 6, borderWidth: 1, borderColor: C.softBorder },
  adminActions: { color: C.ink, fontSize: T['headline-md'] },
  adminTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  adminTag: { backgroundColor: C.mint, color: C.green, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 5, fontSize: T['label-sm'], fontWeight: '800' },
  formField: { gap: 6 },
  fieldLabel: { color: C.ink, fontSize: T['label-md'], fontWeight: '800' },
  fieldInput: { minHeight: 52, borderRadius: 7, borderWidth: 1, borderColor: C.softBorder, backgroundColor: C.card, padding: 13, color: C.ink, fontSize: T['body-md-tight'], lineHeight: 22 },
  formToggle: { minHeight: 58, backgroundColor: C.card, borderRadius: 7, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.softBorder },
  toggleLabel: { marginLeft: 'auto', color: C.white, backgroundColor: C.green, borderRadius: 18, padding: 7, fontWeight: '800' },
});
