import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { IconName } from '@/lib/display';
import { DesignColors as C } from '@/constants/design-tokens';

export function AppIcon({ name, size = 22, color = C.ink }: { name: IconName; size?: number; color?: string }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}
