import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { DesignColors as C } from '@/constants/design-tokens';
import { useRole } from '@/contexts/role-context';

export default function AdminLayout() {
  const { isAdmin, syncing } = useRole();

  if (syncing) {
    return (
      <View style={{ flex: 1, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={C.green} />
      </View>
    );
  }

  if (!isAdmin) {
    return <Redirect href="/(tabs)" />;
  }

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.canvas } }} />;
}