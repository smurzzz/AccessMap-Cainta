import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { Stack } from 'expo-router';
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

function RootNavigator() {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.canvas } }}>
        <Stack.Screen name="index" redirect={isLoaded ? !!isSignedIn : false} />
        <Stack.Screen name="onboarding" redirect={isLoaded ? !!isSignedIn : false} />
        <Stack.Screen name="login" redirect={isLoaded ? !!isSignedIn : false} />
        <Stack.Screen name="(tabs)" redirect={isLoaded && !isSignedIn} />
        <Stack.Screen name="place/[id]" redirect={isLoaded && !isSignedIn} />
        <Stack.Screen name="directions" redirect={isLoaded && !isSignedIn} />
        <Stack.Screen name="category" redirect={isLoaded && !isSignedIn} />
        <Stack.Screen name="explore" redirect={isLoaded && !isSignedIn} />
        <Stack.Screen name="sso-callback" />
        <Stack.Screen name="admin" redirect={isLoaded && !isSignedIn} />
      </Stack>
      {!isLoaded && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: C.canvas,
          }}
        >
          <ActivityIndicator size="large" color={C.green} />
        </View>
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <RoleProvider>
          <RootNavigator />
        </RoleProvider>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}