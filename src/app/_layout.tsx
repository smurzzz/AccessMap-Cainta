import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RoleProvider } from '@/contexts/role-context';
import { DesignColors as C } from '@/constants/design-tokens';
import { clerkPublishableKey } from '@/lib/clerk';

if (!clerkPublishableKey) {
  throw new Error(
    'Missing Clerk publishable key. Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to your .env file.',
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments() as string[];

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={C.green} />
      </View>
    );
  }

  const atLogin = segments.length === 0 || segments[0] === 'index';

  if (!isSignedIn && !atLogin) {
    return <Redirect href="/" />;
  }

  if (isSignedIn && atLogin) {
    return <Redirect href="/(tabs)" />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <RoleProvider>
          <AuthGate>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.canvas } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="place/[id]" />
              <Stack.Screen name="directions" />
              <Stack.Screen name="admin/index" />
              <Stack.Screen name="admin/place-form" />
            </Stack>
          </AuthGate>
        </RoleProvider>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}