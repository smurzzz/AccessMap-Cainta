import { Tabs } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { DesignColors as C, DesignType as T } from '@/constants/design-tokens';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

function TabIcon({ name, color }: { name: IconName; color: ColorValue }) {
  return (
    <MaterialCommunityIcons name={name} color={color} size={T['icon-sm']} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.green,
        tabBarInactiveTintColor: C.statusNegBorder,
        tabBarStyle: { height: 64, paddingTop: 6, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line },
        tabBarLabelStyle: { fontSize: T['label-sm'], fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <TabIcon color={color} name="office-building-outline" /> }} />
      <Tabs.Screen name="filter" options={{ title: 'Filter', tabBarIcon: ({ color }) => <TabIcon color={color} name="filter-variant" /> }} />
      <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: ({ color }) => <TabIcon color={color} name="map-marker-outline" /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <TabIcon color={color} name="account-circle-outline" /> }} />
    </Tabs>
  );
}
