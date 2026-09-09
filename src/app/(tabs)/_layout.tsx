import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { DesignColors as C, DesignType as T } from '@/constants/design-tokens';

function TabIcon({ symbol, color }: { symbol: string; color: ColorValue }) {
  return (
  <Text style={{ color, fontSize: T['icon-sm'] }}>{symbol}</Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.green,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: { height: 78, paddingTop: 8, backgroundColor: C.canvas, borderTopColor: C.softBorder },
        tabBarLabelStyle: { fontSize: T['label-sm'], fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <TabIcon color={color} symbol="▦" /> }} />
      <Tabs.Screen name="filter" options={{ title: 'Filter', tabBarIcon: ({ color }) => <TabIcon color={color} symbol="≡" /> }} />
      <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: ({ color }) => <TabIcon color={color} symbol="⌖" /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <TabIcon color={color} symbol="◎" /> }} />
    </Tabs>
  );
}
