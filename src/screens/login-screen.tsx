import GoogleLogo from '@/components/features/google-logo';
import { AppIcon } from '@/components/ui/app-icon';
import { DesignColors as C, DesignType as T, M3 } from '@/constants/design-tokens';
import { useSSO } from '@clerk/clerk-expo';
import * as Linking from 'expo-linking';
import React, { useState } from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

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
            <View style={styles.logoBox}>
              <Image source={require('@/assets/images/final_logo.png')} style={styles.loginLogoImage} contentFit="contain" />
            </View>
          </View>
          <Text style={styles.appTitle}>AccessMap</Text>
          <View style={styles.locationRow}>
            <AppIcon name="navigation" size={16} color={M3.onSurfaceVariant} />
            <Text style={styles.locationText}>San Isidro, Cainta, Rizal</Text>
          </View>
        </View>

        <View style={styles.loginFooter}>
          <View style={styles.loginActionGroup}>
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loginSafe: { flex: 1, backgroundColor: '#f1f6ff' },
  loginFrame: { flex: 1, width: '100%', maxWidth: 384, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 24, justifyContent: 'space-between', alignItems: 'center' },
  loginTopRow: { width: '100%', flexDirection: 'row', justifyContent: 'flex-end' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: M3.surfaceContainerLow },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: M3.tertiary },
  liveText: { color: M3.secondary, fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.55, textTransform: 'uppercase' },
  loginHero: { alignItems: 'center', gap: 4 },
  logoWrapper: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  logoBox: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowColor: '#2563eb', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.24, shadowRadius: 12, elevation: 6 },
  loginLogoImage: { width: '100%', height: '100%', borderRadius: 44 },
  appTitle: { color: M3.onSurface, fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.6, textAlign: 'center', marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { color: M3.onSurfaceVariant, fontSize: 14, lineHeight: 20 },
  loginFooter: { width: '100%', alignItems: 'center' },
  loginActionGroup: { width: '100%', alignItems: 'center', gap: 16, transform: [{ translateY: -48 }] },
  googleButton: { width: '100%', height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: M3.surfaceContainerLowest, borderRadius: 999, borderWidth: 1, borderColor: M3.loginBorder, overflow: 'hidden', shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 1 },
  googleButtonText: { color: M3.onSurface, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  errorText: { color: C.amber, fontSize: T['body-md'], textAlign: 'center', fontWeight: '700', marginVertical: 10 },
  termsText: { color: M3.outline, fontSize: 13, lineHeight: 18, letterSpacing: 0.065, textAlign: 'center', maxWidth: 320, paddingHorizontal: 8 },
  termsLink: { color: M3.onSurface, fontWeight: '500', textDecorationLine: 'underline' },
});
