import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { DesignColors as C } from '@/constants/design-tokens';

interface LoadingStateProps {
  label?: string;
}

export default function LoadingState({ label = 'Loading…' }: LoadingStateProps) {
  return (
    <View style={styles.container} accessibilityLabel={label} accessibilityRole="progressbar">
      <ActivityIndicator size="large" color={C.green} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  label: {
    color: C.muted,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});