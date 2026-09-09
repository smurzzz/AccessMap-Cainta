import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { DesignColors as C } from '@/constants/design-tokens';

export default function SSOCallback() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={C.green} />
      </View>
    );
  }

  return <Redirect href={isSignedIn ? '/(tabs)' : '/'} />;
}