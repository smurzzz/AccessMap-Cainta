import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RoleProvider } from '@/contexts/role-context';
import { FilterProvider } from '@/contexts/filter-context';
import { DesignColors as C } from '@/constants/design-tokens';
import { clerkPublishableKey } from '@/lib/clerk';

if (!clerkPublishableKey) {
  throw new Error(
    'Missing Clerk publishable key. Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to your .env file.',
  );
}

// Inter — the typeface used across the Stitch design system. Loaded once and
// injected as the base font for every Text/TextInput (per-instance styles win).
const INTER_FAMILY = 'Inter_400Regular';

function useInterAsDefaultFont(loaded: boolean) {
  const done = React.useRef(false);
  if (loaded && !done.current) {
    done.current = true;
    for (const Component of [Text, TextInput] as any[]) {
      const originalRender = Component.render as (...args: unknown[]) => React.ReactElement<{ style?: unknown }>;
      Component.render = function (this: unknown, ...args: unknown[]) {
        const element = originalRender.apply(this, args);
        const existing = (element.props as { style?: unknown }).style;
        return React.cloneElement(element, {
          style: [{ fontFamily: INTER_FAMILY }, ...(Array.isArray(existing) ? existing : existing ? [existing] : [])],
        } as { style?: unknown });
      };
    }
  }
}

function RootNavigator() {
  const { isLoaded, isSignedIn } = useAuth();
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  useInterAsDefaultFont(fontsLoaded);

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
      {(!isLoaded || !fontsLoaded) && (
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
          <FilterProvider>
            <RootNavigator />
          </FilterProvider>
        </RoleProvider>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}