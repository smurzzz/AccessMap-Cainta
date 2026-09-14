import { uploadEntrancePhoto } from '@/components/features/photo-uploader';
import { AppIcon } from '@/components/ui/app-icon';
import {  CATEGORY_ORDER, FEATURE_LABELS, FEATURE_ORDER , CATEGORY_SHORT_LABELS } from '@/constants/catalog';
import { DesignColors as C, DesignType as T, M3 } from '@/constants/design-tokens';
import { withAlpha , featureIcon } from '@/lib/display';
import { PlaceCategory, FeatureType, AccessibilityStatus } from '@/types';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router , useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState , useRef } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthedSupabase } from '@/hooks/useAuthedSupabase';
import { useUser } from '@clerk/clerk-expo';
import { usePlace } from '@/hooks/usePlace';
import EmptyState from '@/components/ui/empty-state';
import LoadingState from '@/components/ui/loading-state';

type PhotoAsset = { uri: string; fileName?: string | null; mimeType?: string | null };

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
        <Text style={styles.adminFormAppBarSubtitle}>San Isidro Facility Listings</Text>
      </View>
      <View style={styles.adminFormStatusPill}>
        <AppIcon name="check-decagram" size={13} color={M3.primaryContainer} />
        <Text style={styles.adminFormStatusText}>Admin-Verified</Text>
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
  other: 'Other accessibility provisions',
};

const DEFAULT_FEATURES: Record<FeatureType, AccessibilityStatus> = {
  ramp: 'unavailable',
  restroom: 'unavailable',
  elevator: 'unavailable',
  parking: 'unavailable',
  entrance: 'unavailable',
  other: 'unavailable',
};

/** Facility data export: one row per facility with every feature's availability. */

/** Minimal analytics dashboard: live facility metrics for San Isidro, Cainta. */

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
            <Text style={styles.fieldLabel}>Entrance Photo</Text>
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
                <Text style={styles.adminPhotoSub} numberOfLines={2}>Photos document step heights, door clearance, and ramp slope for wheelchair access.</Text>
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
          <Text style={styles.adminFormSectionTitle}>Accessibility Features</Text>
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

const styles = StyleSheet.create({
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
  adminFormBackBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
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
  adminFormStatusText: { color: M3.primaryContainer, fontSize: 11, lineHeight: 14, fontWeight: '600' },
  adminNewSafe: { flex: 1, backgroundColor: M3.surface },
  adminFormScroll: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40, gap: 16 },
  adminFormIntro: { gap: 4 },
  adminFormTitle: { color: '#0f172a', fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.3 },
  adminFormSubtitle: { color: '#475569', fontSize: 12, lineHeight: 18 },
  formField: { gap: 6 },
  adminFormLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  fieldLabel: { color: C.ink, fontSize: T['label-md'], fontWeight: '800' },
  adminFormLabelHint: { color: '#94a3b8', fontSize: 11, lineHeight: 15, fontWeight: '500' },
  fieldInput: { minHeight: 52, borderRadius: 8, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, padding: 13, color: C.ink, fontSize: T['body-md-tight'], lineHeight: 22 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { minHeight: 48, paddingHorizontal: 14, borderRadius: 8, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  activeChip: { backgroundColor: C.navy, borderColor: C.navy },
  categoryChipText: { color: C.ink, fontSize: T['label-md'], fontWeight: '800' },
  activeChipText: { color: C.white },
  adminFormTextarea: { minHeight: 88, textAlignVertical: 'top' },
  adminFormIconWrap: { position: 'relative', justifyContent: 'center' },
  adminFormIconLead: { position: 'absolute', left: 12, zIndex: 1 },
  adminFormIconInput: { paddingLeft: 40 },
  formRow: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
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
  adminPhotoThumb: { width: '100%', height: '100%' },
  adminPhotoCheck: { position: 'absolute', bottom: 4, right: 4, borderRadius: 8, backgroundColor: withAlpha('#ffffff', 0.95) },
  adminPhotoThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
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
});
