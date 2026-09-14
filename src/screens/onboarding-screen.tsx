import { AppIcon } from '@/components/ui/app-icon';
import { DesignType as T, M3 } from '@/constants/design-tokens';
import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Svg, Circle, Path } from 'react-native-svg';
import { withAlpha } from '@/lib/display';

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
    body: 'See ramps, accessible restrooms, elevators, and step-free entrances before heading out.',
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

const styles = StyleSheet.create({
  onbGraphicWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 40 },
  onbGraphicCircle: { position: 'relative', width: 96, height: 96, borderRadius: 48, backgroundColor: M3.surfaceContainerLow, alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 },
  onbRadarOuter: { position: 'absolute', width: 176, height: 176, borderRadius: 88, backgroundColor: withAlpha(M3.surfaceContainerLow, 0.6) },
  onbRadarInner: { position: 'absolute', width: 128, height: 128, borderRadius: 64, backgroundColor: M3.surfaceContainerLow },
  onbGraphicCircleSmall: { width: 80, height: 80, borderRadius: 40, backgroundColor: M3.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  onbBeaconIconTilt: { transform: [{ rotate: '-12deg' }] },
  onbBeaconDotWrap: { position: 'absolute', top: 12, right: 24, alignItems: 'center', justifyContent: 'center' },
  onbPinBadge: { position: 'absolute', bottom: -4, right: -4, width: 32, height: 32, borderRadius: 16, backgroundColor: M3.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  onbCtaStep1: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', height: 56, borderRadius: 999, backgroundColor: M3.primary },
  onbCtaStep2: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', height: 56, borderRadius: 999, backgroundColor: M3.primaryContainer },
  onbCtaStep3: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', height: 56, borderRadius: 999, backgroundColor: M3.primaryContainer },
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
  onbNextTextTitle: { color: M3.onPrimary, fontSize: T['title-md'], lineHeight: 22, fontWeight: '600' },
  onbNextText: { color: M3.onPrimary, fontSize: T['link-md'], lineHeight: 18, fontWeight: '600' },
  onbArrow: { marginLeft: 8, flexDirection: 'row', alignItems: 'center' },
  onbSkipInline: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 8 },
  onbSkipFull: { width: '100%', alignItems: 'center', paddingVertical: 10 },
  onbSkipTextSm: { color: M3.secondary, fontSize: T['label-md'], lineHeight: 16, fontWeight: '500' },
  onbSkipTextFull: { color: M3.secondary, fontSize: T['link-md'], lineHeight: 18, fontWeight: '600', textAlign: 'center' },
  onbFooterCaption: { color: withAlpha(M3.onSurfaceVariant, 0.8), fontSize: T['label-sm'], lineHeight: 14, textAlign: 'center', marginTop: 4 },
});
