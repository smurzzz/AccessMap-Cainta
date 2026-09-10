import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { DesignColors as C } from '@/constants/design-tokens';

const COMPLETE_TIMEOUT_MS = 20000;

export default function SSOCallback() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), COMPLETE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      router.replace('/(tabs)');
    } else if (timedOut) {
      router.replace('/login');
    }
  }, [isLoaded, isSignedIn, timedOut, router]);

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={C.green} />
    </View>
  );
}