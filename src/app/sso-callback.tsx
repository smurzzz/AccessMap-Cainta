import { useAuth, useSSO } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { DesignColors as C } from '@/constants/design-tokens';

const COMPLETE_TIMEOUT_MS = 15000;

export default function SSOCallback() {
  // The screen that receives the OAuth deep link MUST finish the flow:
  // startSSOFlow({}) exchanges the `code` param for a real session.
  // Merely waiting for isSignedIn leaves the handshake hanging, so users
  // time out and have to sign in again.
  const { startSSOFlow } = useSSO();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    void (async () => {
      try {
        // Official Clerk Expo pattern: the deep-linked callback screen completes
        // the flow. The browser briefly re-opens and auto-consents (Google is
        // already authorized), returning a fresh rotating_token_nonce that is
        // exchanged for a session here — no user interaction needed.
        const { createdSessionId, setActive } = await startSSOFlow({ strategy: 'oauth_google' });
        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
        }
      } catch (error) {
        console.warn('SSO callback failed', error);
        router.replace('/login');
      }
    })();
  }, [startSSOFlow, router]);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), COMPLETE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      router.replace('/(tabs)');
    } else if (timedOut) {
      router.replace('/login');
    }
  }, [isSignedIn, timedOut, router]);

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <ActivityIndicator size="large" color={C.green} />
      {timedOut ? <Text style={{ color: C.muted, fontSize: 13 }}>Still signing you in…</Text> : null}
    </View>
  );
}
