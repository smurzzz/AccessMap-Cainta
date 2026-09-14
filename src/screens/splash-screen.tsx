import { AppIcon } from '@/components/ui/app-icon';
import { withAlpha } from '@/lib/display';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Svg, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { DesignType as T } from '@/constants/design-tokens';

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
                <Text style={styles.splashTrustText}>Admin-Verified Listings</Text>
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

const styles = StyleSheet.create({
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
});
